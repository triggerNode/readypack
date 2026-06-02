// TODO: implement in Stage 6 — QA layer
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, todo: 'Stage 6' })
}
