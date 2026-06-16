import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'readypack-logos'
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = new Set(['image/svg+xml', 'image/png', 'image/jpeg'])

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
