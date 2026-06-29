import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'readypack-logos'
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = new Set(['image/svg+xml', 'image/png', 'image/jpeg'])

// Verify the actual file CONTENT, not just the client-declared Content-Type
// (which is trivially forged). PNG/JPEG checked by magic bytes; SVG rejected if
// it carries scripts or event handlers — those would be stored XSS when the
// public logo URL is opened directly. Returns an error message, or null if OK.
function validateImageContent(bytes: Uint8Array, declaredType: string): string | null {
  if (declaredType === 'image/png') {
    const ok =
      bytes.length >= 4 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    return ok ? null : 'File is not a valid PNG.'
  }
  if (declaredType === 'image/jpeg') {
    const ok = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    return ok ? null : 'File is not a valid JPEG.'
  }
  if (declaredType === 'image/svg+xml') {
    const text = new TextDecoder().decode(bytes).toLowerCase()
    if (!text.includes('<svg')) return 'File is not a valid SVG.'
    // SVG can carry active content -> stored XSS if the logo URL is opened
    // directly. A logo never needs scripts, event handlers, or embedded
    // executable elements, so reject the practical execution vectors. (Best
    // effort: a full sanitizer / forced attachment-disposition is the proper
    // long-term fix — tracked as fast-follow.)
    const dangerous = [
      '<script', 'javascript:', '<foreignobject',
      '<iframe', '<embed', '<object', '<animate', '<set',
    ]
    if (/\son\w+\s*=/.test(text) || dangerous.some((p) => text.includes(p))) {
      return 'SVG must not contain scripts, event handlers, or embedded objects.'
    }
    return null
  }
  return 'Unsupported file type.'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json({ error: 'File must be SVG, PNG, or JPEG' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2MB' }, { status: 400 })
  }

  // Look up the user's active submission to derive the storage path
  const { data: submission, error: subErr } = await supabase
    .from('intake_submissions')
    .select('id')
    .eq('user_id', user.id)
    .neq('completion_status', 'submitted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subErr || !submission) {
    return NextResponse.json({ error: 'Active submission not found' }, { status: 404 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const safeExt = ['svg', 'png', 'jpg', 'jpeg'].includes(ext) ? ext : 'png'
  const path = `${submission.id}/logo-${Date.now()}.${safeExt}`

  const arrayBuffer = await file.arrayBuffer()
  const contentError = validateImageContent(new Uint8Array(arrayBuffer), file.type)
  if (contentError) {
    return NextResponse.json({ error: contentError }, { status: 400 })
  }
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: publicUrlData.publicUrl })
}
