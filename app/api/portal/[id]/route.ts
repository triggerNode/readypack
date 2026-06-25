// app/api/portal/[id]/route.ts
//
// Single-source-of-truth poll for the UNIFIED customer portal (design brief 14).
// One owner-authorised DB read returns ONE PortalFeed: the phase tracker state,
// every document card's lifecycle state, and the open/submitted info-requests —
// all from the same read, so the tracker and the cards can never disagree.
//
// Returns freshly-signed URLs (inline preview + download disposition) so the
// client updates live without a full server refresh. no-store: every poll fresh.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withSignedUrls } from '@/lib/documents/storage'
import { buildPortalFeed, type PortalDocRow, type PortalInfoRequestFeed } from '@/lib/documents/portal-feed'
import { DOC_CATALOG } from '@/lib/documents/doc-catalog'
import type { DocumentType, QaStatus, DocDeliveryStatus } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

interface DocRow {
  id: string
  document_type: DocumentType
  qa_status: QaStatus | null
  delivery_status: DocDeliveryStatus | null
  page_count: number | null
  file_url: string | null
  render_metadata: Record<string, unknown> | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  if (!UUID_REGEX.test(orderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authenticate + authorise (same model as the portal page).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

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
      options: Array.isArray(r.options) ? (r.options as string[]) : [],
      status: r.status,
    }))
    jobStatus = (jobResult.data?.status as string | undefined) ?? null
    jobStartedAt = (jobResult.data?.started_at as string | undefined) ?? null
    released = (commsResult.count ?? 0) > 0
  }

  // Sign each document's storage path once (batch), then derive the download
  // (attachment-disposition) variant with a clean filename — same as the SSR page.
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

  const feed = buildPortalFeed({
    pack: {
      deliveryStatus: order.delivery_status,
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

  return NextResponse.json(feed, { headers: { 'Cache-Control': 'no-store' } })
}
