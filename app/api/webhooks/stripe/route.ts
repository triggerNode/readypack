// TODO: implement in Stage 4 — Stripe webhook handler
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: true, todo: 'Stage 4' })
}
