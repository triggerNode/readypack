import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  submissionId?: string
  section?: number
  answers?: unknown
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { submissionId, section, answers } = body
  if (!submissionId || typeof submissionId !== 'string') {
    return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
  }
  if (typeof section !== 'number' || section < 1 || section > 10) {
    return NextResponse.json({ error: 'section must be 1–10' }, { status: 400 })
  }
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'answers required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch existing submission (RLS enforces user_id = auth.uid())
  const { data: existing, error: fetchErr } = await supabase
    .from('intake_submissions')
    .select('id, raw_answers, section_completion, completion_status')
    .eq('id', submissionId)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (existing.completion_status === 'submitted') {
    return NextResponse.json({ error: 'Submission already submitted' }, { status: 409 })
  }

  const key = String(section)
  const mergedAnswers = {
    ...(existing.raw_answers ?? {}),
    [key]: answers,
  }
  const mergedCompletion = {
    ...(existing.section_completion ?? {}),
    [key]: { completed: true, completed_at: new Date().toISOString() },
  }

  const { error: updateErr } = await supabase
    .from('intake_submissions')
    .update({
      raw_answers: mergedAnswers,
      section_completion: mergedCompletion,
      last_saved: new Date().toISOString(),
      completion_status: 'in_progress',
    })
    .eq('id', submissionId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
