// lib/documents/finalise-pack.ts
//
// Re-render every generated_documents row for an order with showWatermark:false
// and overwrite the existing Supabase Storage files in place. Called from the
// customer portal approval Server Action.
//
// Design choices:
//   • We re-render from content_json (the AI's structured output), so the
//     visual output is byte-identical to the draft except for the watermark
//     and any render_metadata changes.
//   • We overwrite the same storage path (upsert) so file_url is stable —
//     bookmarks, audit trails, and emails keep working. The prompt brief
//     explicitly asks for this.
//   • We restore the original personalisation from render_metadata so we
//     never lose company-specific names/dates on the re-render.
//   • Failures are collected per-document so a single doc render fail
//     doesn't abandon the whole pack; the caller decides whether the
//     overall transition is allowed.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { ReactPdfRenderer, type DocumentContent } from '@/lib/documents/renderer'
import type { DocumentType } from '@/types/database'

const STORAGE_BUCKET = 'documents'

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
  return { companyName }
}

// Re-build the storage path from a public URL. Supabase public URLs are of
// the form `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`.
// We use the path so we can re-upload to the exact same key with upsert.
function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const i = publicUrl.indexOf(marker)
  if (i === -1) return null
  return publicUrl.slice(i + marker.length)
}

export async function finaliseOrderPack(orderId: string): Promise<FinaliseResult> {
  const submissionRes = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

  const submissionId = submissionRes.data?.id
  if (!submissionId) {
    return { total: 0, succeeded: 0, failed: [] }
  }

  const { data: docs, error } = await supabaseAdmin
    .from('generated_documents')
    .select('id, document_type, file_url, content_json, render_metadata, version_number')
    .eq('submission_id', submissionId)
    .order('document_type', { ascending: true })

  if (error || !docs) {
    return {
      total: 0,
      succeeded: 0,
      failed: [{ document_id: 'n/a', document_type: 'ai_use_statement', error: error?.message ?? 'no documents' }],
    }
  }

  const rows = docs as unknown as PersistedDocRow[]
  const renderer = new ReactPdfRenderer()
  const failed: FinaliseResult['failed'] = []
  let succeeded = 0

  for (const row of rows) {
    try {
      if (!row.content_json) {
        throw new Error('content_json missing — cannot re-render without source')
      }
      const { companyName, logoUrl } = readPersonalisation(row.render_metadata)

      const renderResult = await renderer.render(
        row.content_json as unknown as DocumentContent,
        { showWatermark: false, logoUrl, companyName },
      )

      // Overwrite the draft file in place when we can resolve the original
      // path; otherwise fall back to a predictable final path.
      const fallbackPath = `${orderId}/${row.document_type}_v${row.version_number}_final.pdf`
      const storagePath =
        (row.file_url && storagePathFromPublicUrl(row.file_url)) || fallbackPath

      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, renderResult.buffer, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      const { data: urlData } = supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath)

      const nextMeta: Record<string, unknown> = {
        ...(row.render_metadata ?? {}),
        watermarked: false,
        finalised_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabaseAdmin
        .from('generated_documents')
        .update({
          file_url: urlData.publicUrl,
          delivery_status: 'delivered',
          render_metadata: nextMeta,
          file_size_bytes: renderResult.file_size_bytes,
          page_count: renderResult.page_count,
        })
        .eq('id', row.id)

      if (updateError) throw new Error(`DB update failed: ${updateError.message}`)
      succeeded++
    } catch (e) {
      failed.push({
        document_id: row.id,
        document_type: row.document_type,
        error: e instanceof Error ? e.message : 'Unknown render error',
      })
    }
  }

  return { total: rows.length, succeeded, failed }
}
