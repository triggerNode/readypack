// lib/documents/storage.ts
//
// Document storage access for the PRIVATE `documents` bucket.
//
// Compliance PDFs must never be world-readable, so the bucket is private and
// `getPublicUrl` links return HTTP 400. Every view/download therefore goes
// through a short-lived SIGNED url generated on demand. We persist the storage
// *path* in generated_documents.file_url (never a URL) and sign it at serve time.
//
// A signed url expires, so it must NOT be stored — only handed to the browser
// for the lifetime of a page view.

import { supabaseAdmin } from '@/lib/supabase/admin'

export const DOCUMENTS_BUCKET = 'documents'

// How long a signed document url stays valid. Long enough for a customer to
// open the portal and download their pack; short enough that a leaked link
// expires quickly.
export const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

// Resolve the storage object path from whatever is stored in file_url.
// New rows store the bare path. Older rows (pre-fix) may store a full public
// url (…/object/public/documents/<path>) or a signed url
// (…/object/sign/documents/<path>?token=…) — handle all three so existing
// generated packs keep working.
export function resolveStoragePath(stored: string | null | undefined): string | null {
  if (!stored) return null
  const trimmed = stored.trim()
  if (!trimmed) return null

  for (const marker of [
    `/storage/v1/object/public/${DOCUMENTS_BUCKET}/`,
    `/storage/v1/object/sign/${DOCUMENTS_BUCKET}/`,
  ]) {
    const i = trimmed.indexOf(marker)
    if (i !== -1) {
      const after = trimmed.slice(i + marker.length)
      const q = after.indexOf('?')
      return q === -1 ? after : after.slice(0, q)
    }
  }

  // Already a bare storage path.
  return trimmed.replace(/^\/+/, '')
}

// Return a copy of each row with file_url replaced by a freshly signed url
// (or null when there is nothing to sign / signing fails). Uses the batch
// signing endpoint so a page with many documents costs a single request.
export async function withSignedUrls<T extends { file_url: string | null }>(
  rows: readonly T[],
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<T[]> {
  const paths = rows.map((row) => resolveStoragePath(row.file_url))
  const uniquePaths = Array.from(new Set(paths.filter((p): p is string => p !== null)))

  if (uniquePaths.length === 0) {
    return rows.map((row) => ({ ...row, file_url: null }))
  }

  const signedByPath = new Map<string, string>()
  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(uniquePaths, ttlSeconds)

  if (!error && data) {
    for (const item of data) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl)
    }
  }

  return rows.map((row, i) => {
    const path = paths[i]
    return { ...row, file_url: path ? signedByPath.get(path) ?? null : null }
  })
}
