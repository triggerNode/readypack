// app/api/internal/fold-in-answer/route.ts
//
// Internal worker for the Stage 3d query loop: folds a customer's answer back into
// the affected document (regenerate + scoped re-QA + close the flag). Kicked via
// waitUntil from the portal answer action; runs as its own invocation so the
// customer's submit returns instantly. Internal-secret authed (same gate as the
// generation worker) — never externally callable.

import { NextResponse, type NextRequest } from 'next/server'
import { INTERNAL_SECRET_HEADER, verifyInternalSecret } from '@/lib/auth/internal-secret'
import { foldInAnswer } from '@/lib/documents/fold-in-answer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A regenerate + scoped QA can take up to ~90s; give the worker room.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if (!verifyInternalSecret(request.headers.get(INTERNAL_SECRET_HEADER))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    order_id?: string
    info_request_id?: string
  }
  if (!body.order_id || !body.info_request_id) {
    return NextResponse.json({ error: 'Missing order_id or info_request_id' }, { status: 400 })
  }

  const result = await foldInAnswer(body.order_id, body.info_request_id)
  // Always 200 — result.ok tells the story; the kicker ignores the body anyway.
  return NextResponse.json(result, { status: 200 })
}
