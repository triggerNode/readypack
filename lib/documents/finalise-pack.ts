// lib/documents/finalise-pack.ts
//
// Re-render generated_documents with showWatermark:false and overwrite the
// existing Supabase Storage files in place. Two entry points:
//   • finaliseDocument(documentId)  — a single document (per-document approval)
//   • finaliseOrderPack(orderId)    — every document (whole-pack "Approve all")
// Both leave each finalised doc at delivery_status 'delivered' and then roll the
// ORDER status up to 'delivered' only once ALL its documents are final.
//
// Design choices:
//   • We re-render from content_json (the AI's structured output), so the
//     visual output is byte-identical to the draft except for the watermark.
//   • We overwrite the same storage path (upsert) so file_url is stable —
//     bookmarks, audit trails, and emails keep working.
//   • We restore the original personalisation + logo from render_metadata so we
//     never lose company-specific names/dates/logo on the re-render.
//   • Failures are collected per-document so a single doc render fail doesn't
//     abandon the rest; the caller decides whether the transition is allowed.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { ReactPdfRenderer, type DocumentContent } from '@/lib/documents/renderer'
import { DOCUMENTS_BUCKET, resolveStoragePath } from '@/lib/documents/storage'
import type { DocumentType } from '@/types/database'

const STORAGE_BUCKET = DOCUMENTS_BUCKET

interface PersistedDocRow {
  id: string
  document_type: DocumentType
  file_url: string | null
  content_json: Record<string, unknown> | null
  render_metadata: Record<string, unknown> | null
  version_number: number
}

export interface FinaliseResult {
  total: number
  succeeded: number
  failed: Array<{ document_id: string; document_type: DocumentType; error: string }>
}

// Pull the personalisation snapshot back out of render_metadata so the
// re-render uses the same customer-facing values as the draft did.
function readPersonalisation(
  meta: Record<string, unknown> | null,
): { companyName: string; logoUrl?: string } {
  const personalisation =
    meta && typeof meta === 'object' && 'personalisation' in meta
      ? (meta.personalisation as Record<string, unknown> | undefined)
      : undefined
  const companyName =
    (personalisation && typeof personalisation.companyName === 'string'
      ? personalisation.companyName
      : '') || 'Your Company'
  const logoUrl =
    personalisation && typeof personalisation.logoUrl === 'string' && personalisation.logoUrl
      ? personalisation.logoUrl
      : undefined
  return { companyName, logoUrl }
}

// Re-render one document watermark-free, overwrite its storage file in place,
// and mark it delivered. Throws on any failure (the caller collects it).
async function finaliseDocRow(
  row: PersistedDocRow,
  ctx: { orderId: string; fallbackLogoUrl?: string },
): Promise<void> {
  if (!row.content_json) {
    throw new Error('content_json missing — cannot re-render without source')
  }
  const renderer = new ReactPdfRenderer()
  const { companyName, logoUrl } = readPersonalisation(row.render_metadata)

  const renderResult = await renderer.render(
    row.content_json as unknown as DocumentContent,
    { showWatermark: false, logoUrl: logoUrl ?? ctx.fallbackLogoUrl, companyName },
  )

  const fallbackPath = `${ctx.orderId}/${row.document_type}_v${row.version_number}_final.pdf`
  const storagePath = resolveStoragePath(row.file_url) || fallbackPath

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, renderResult.buffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const nextMeta: Record<string, unknown> = {
    ...(row.render_metadata ?? {}),
    watermarked: false,
    finalised_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabaseAdmin
    .from('generated_documents')
    .update({
      file_url: storagePath,
      delivery_status: 'delivered',
      render_metadata: nextMeta,
      file_size_bytes: renderResult.file_size_bytes,
      page_count: renderResult.page_count,
    })
    .eq('id', row.id)
  if (updateError) throw new Error(`DB update failed: ${updateError.message}`)
}

// Order-level logo fallback for packs generated before the logo was persisted
// in render_metadata — recover it from the questionnaire upload, exactly as
// the generation pipeline derives it.
function fallbackLogoFromNormalised(normalised: Record<string, unknown> | null): string | undefined {
  return typeof normalised?.logo_url === 'string' && normalised.logo_url ? normalised.logo_url : undefined
}

/**
 * Roll the ORDER status up from its per-document documents: set
 * delivery_status='delivered' only once every generated document is final.
 * Never downgrades — if some docs are still draft/in-revision the order keeps
 * its current state (qa_review / escalated). Returns whether the pack is now
 * fully delivered.
 */
export async function rollUpOrderDeliveryStatus(orderId: string): Promise<{ allFinal: boolean }> {
  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (!submission?.id) return { allFinal: false }

  const { data: docs } = await supabaseAdmin
    .from('generated_documents')
    .select('delivery_status')
    .eq('submission_id', submission.id)

  const rows = (docs ?? []) as Array<{ delivery_status: string }>
  const total = rows.length
  const finalCount = rows.filter((d) => d.delivery_status === 'delivered').length
  const allFinal = total > 0 && finalCount === total

  if (allFinal) {
    await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }
  return { allFinal }
}

/**
 * Finalise a SINGLE document (per-document approval). Re-renders it
 * watermark-free, marks it delivered, then rolls the order status up.
 */
export async function finaliseDocument(
  documentId: string,
): Promise<FinaliseResult & { allFinal: boolean }> {
  const { data: doc, error } = await supabaseAdmin
    .from('generated_documents')
    .select('id, document_type, file_url, content_json, render_metadata, version_number, submission_id')
    .eq('id', documentId)
    .maybeSingle()

  if (error || !doc) {
    return {
      total: 0,
      succeeded: 0,
      failed: [{ document_id: documentId, document_type: 'ai_use_statement', error: error?.message ?? 'document not found' }],
      allFinal: false,
    }
  }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id, order_id, normalised_answers')
    .eq('id', (doc as { submission_id: string }).submission_id)
    .maybeSingle()
  const orderId = (submission as { order_id?: string } | null)?.order_id
  if (!orderId) {
    return {
      total: 1,
      succeeded: 0,
      failed: [{ document_id: doc.id, document_type: doc.document_type, error: 'order not found for document' }],
      allFinal: false,
    }
  }

  const fallbackLogoUrl = fallbackLogoFromNormalised(
    (submission as { normalised_answers?: Record<string, unknown> }).normalised_answers ?? null,
  )

  const failed: FinaliseResult['failed'] = []
  let succeeded = 0
  try {
    await finaliseDocRow(doc as unknown as PersistedDocRow, { orderId, fallbackLogoUrl })
    succeeded = 1
  } catch (e) {
    failed.push({
      document_id: doc.id,
      document_type: doc.document_type,
      error: e instanceof Error ? e.message : 'Unknown render error',
    })
  }

  const { allFinal } = succeeded > 0 ? await rollUpOrderDeliveryStatus(orderId) : { allFinal: false }
  return { total: 1, succeeded, failed, allFinal }
}

/**
 * Finalise EVERY document in an order (whole-pack "Approve all"). Skips
 * documents already final or in revision is NOT applied here — "Approve all"
 * finalises everything still in draft; in-revision docs are excluded by the
 * caller's selection. Rolls the order status up at the end.
 */
export async function finaliseOrderPack(
  orderId: string,
): Promise<FinaliseResult & { allFinal: boolean }> {
  const submissionRes = await supabaseAdmin
    .from('intake_submissions')
    .select('id, normalised_answers')
    .eq('order_id', orderId)
    .maybeSingle()

  const submissionId = submissionRes.data?.id
  if (!submissionId) {
    return { total: 0, succeeded: 0, failed: [], allFinal: false }
  }

  const fallbackLogoUrl = fallbackLogoFromNormalised(
    (submissionRes.data?.normalised_answers ?? {}) as Record<string, unknown>,
  )

  const { data: docs, error } = await supabaseAdmin
    .from('generated_documents')
    .select('id, document_type, file_url, content_json, render_metadata, version_number, delivery_status')
    .eq('submission_id', submissionId)
    .order('document_type', { ascending: true })

  if (error || !docs) {
    return {
      total: 0,
      succeeded: 0,
      failed: [{ document_id: 'n/a', document_type: 'ai_use_statement', error: error?.message ?? 'no documents' }],
      allFinal: false,
    }
  }

  // "Approve all" acts on documents the customer can actually approve now —
  // anything still in revision is left for its own re-release/approve cycle.
  const rows = (docs as unknown as Array<PersistedDocRow & { delivery_status: string }>).filter(
    (r) => r.delivery_status !== 'in_revision',
  )
  const failed: FinaliseResult['failed'] = []
  let succeeded = 0

  for (const row of rows) {
    try {
      await finaliseDocRow(row, { orderId, fallbackLogoUrl })
      succeeded++
    } catch (e) {
      failed.push({
        document_id: row.id,
        document_type: row.document_type,
        error: e instanceof Error ? e.message : 'Unknown render error',
      })
    }
  }

  const { allFinal } = succeeded > 0 ? await rollUpOrderDeliveryStatus(orderId) : { allFinal: false }
  return { total: rows.length, succeeded, failed, allFinal }
}
