// TODO: implement in Stage 5 — document generation
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, todo: 'Stage 5' })
}
