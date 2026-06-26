// lib/documents/portal-feed-loader.ts
//
// Server-side loader for the unified customer portal feed (design brief 14).
// ONE owner-agnostic data read (auth is the caller's job) produces the full
// PortalFeed: the phase tracker state, every document card's lifecycle state,
// and the open/submitted info-requests — with freshly-signed inline + download
// URLs. Shared by BOTH the SSR portal page (first paint) and the polling API
// route so the two can never drift.
//
// Imports supabaseAdmin / storage, so it is server-only by construction — never
// import this from a client component.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { withSignedUrls } from '@/lib/documents/storage'
import { DOC_CATALOG } from './doc-catalog'
import {
  buildPortalFeed,
  type PortalDocRow,
  type PortalFeed,
  type PortalInfoRequestFeed,
} from './portal-feed'
import type { DocumentType, QaStatus, DocDeliveryStatus } from '@/types/database'

interface DocRow {
  id: string
  document_type: DocumentType
  qa_status: QaStatus | null
  delivery_status: DocDeliveryStatus | null
  page_count: number | null
  file_url: string | null
  render_metadata: Record<string, unknown> | null
}

// Load + assemble the PortalFeed for one order. The caller has already
// authenticated/authorised; this only reads + maps. `orderDeliveryStatus` is the
// order's roll-up status (the caller already has the order row in hand).
export async function loadPortalFeed(
  orderId: string,
  orderDeliveryStatus: string,
): Promise<PortalFeed> {
  const { data: submission, error: submissionError } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  // Throw rather than silently return an empty feed: on a poll, a thrown error
  // makes the route 500, so the client keeps its last good feed instead of
  // flashing every card back to "queued" (coding-style: never swallow errors).
  if (submissionError) {
    throw new Error(`loadPortalFeed: submission lookup failed: ${submissionError.message}`)
  }

  let docRowsRaw: DocRow[] = []
  let infoRequests: PortalInfoRequestFeed[] = []
  let jobStatus: string | null = null
  let jobStartedAt: string | null = null
  let released = false

  if (submission) {
    const [docsResult, infoResult, jobResult, commsResult] = await Promise.all([
      supabaseAdmin
        .from('generated_documents')
        .select('id, document_type, qa_status, delivery_status, page_count, file_url, render_metadata')
        .eq('submission_id', submission.id),
      // Open + submitted requests both render on the feed (open → flagged card;
      // submitted → keeps the pack out of approve/revise until resolved).
      supabaseAdmin
        .from('info_requests')
        .select('id, document_type, prompt, options, status')
        .eq('order_id', orderId)
        .in('status', ['open', 'submitted'])
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('document_generation_jobs')
        .select('status, started_at')
        .eq('submission_id', submission.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('customer_communications')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('email_type', 'delivery'),
    ])

    // Surface any sub-query failure loudly instead of degrading to an empty feed.
    const subError =
      docsResult.error ?? infoResult.error ?? jobResult.error ?? commsResult.error
    if (subError) {
      throw new Error(`loadPortalFeed: feed query failed: ${subError.message}`)
    }

    docRowsRaw = (docsResult.data ?? []) as DocRow[]
    infoRequests = ((infoResult.data ?? []) as Array<{
      id: string
      document_type: DocumentType | null
      prompt: string
      options: unknown
      status: PortalInfoRequestFeed['status']
    }>).map((r) => ({
      id: r.id,
      documentType: r.document_type,
      prompt: r.prompt,
      // jsonb column — narrow to strings so non-string junk can't reach the UI.
      options: Array.isArray(r.options)
        ? r.options.filter((o): o is string => typeof o === 'string')
        : [],
      status: r.status,
    }))
    jobStatus = (jobResult.data?.status as string | undefined) ?? null
    jobStartedAt = (jobResult.data?.started_at as string | undefined) ?? null
    released = (commsResult.count ?? 0) > 0
  }

  // Sign each document's storage path once (batch), then derive the download
  // (attachment-disposition) variant with a clean filename.
  const signedDocs = await withSignedUrls(docRowsRaw)
  const docRows: PortalDocRow[] = signedDocs.map((row) => {
    const meta = DOC_CATALOG[row.document_type]
    const signed = row.file_url ?? null
    const downloadName = `${meta.ref}-${meta.title.replace(/[^a-z0-9]+/gi, '-')}.pdf`
    const downloadUrl = signed
      ? `${signed}${signed.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`
      : null
    const metadata = (row.render_metadata ?? null) as Record<string, unknown> | null
    return {
      documentType: row.document_type,
      qaStatus: row.qa_status,
      deliveryStatus: row.delivery_status,
      pageCount: row.page_count,
      isRevised: Boolean(metadata && metadata.revised === true),
      fileUrl: signed,
      downloadUrl,
    }
  })

  // Tally counts for the phase tracker from the same rows.
  const docsReady = docRowsRaw.length
  const docsFinal = docRowsRaw.filter((d) => d.delivery_status === 'delivered').length
  const docsInRevision = docRowsRaw.filter((d) => d.delivery_status === 'in_revision').length
  const openInfoRequests = infoRequests.filter((r) => r.status === 'open').length

  return buildPortalFeed({
    pack: {
      deliveryStatus: orderDeliveryStatus,
      jobStatus,
      jobStartedAt,
      docsReady,
      docsFinal,
      docsInRevision,
      openInfoRequests,
      released,
    },
    docRows,
    infoRequests,
    released,
    jobStatus,
  })
}
