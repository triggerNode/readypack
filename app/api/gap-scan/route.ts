// TODO: implement in Stage 3 — gap scan endpoint
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, todo: 'Stage 3' })
}
