// app/api/complaints/route.ts
// Statutory DUAA Section 103 complaints intake endpoint.
//
// Accepts an anonymous POST, validates the payload, calculates the 30-day
// statutory deadline, inserts the row via supabaseAdmin (bypassing RLS for
// the public intake path), and returns the logged complaint id plus the
// acknowledgement/deadline timestamps.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit, clientIpFrom } from '@/lib/rate-limit'
import { notifyAdmin } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STATUTORY_WINDOW_DAYS = 30

interface ComplaintPayload {
  complainant_name?: unknown
  complainant_email?: unknown
  complaint_text?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export async function POST(request: NextRequest) {
  const ip = clientIpFrom(request.headers)
  const limit = rateLimit(`complaints:${ip}`, { windowMs: 60_000, maxRequests: 5 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a moment.' },
      { status: 429 },
    )
  }

  let body: ComplaintPayload
  try {
    body = (await request.json()) as ComplaintPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { complainant_name, complainant_email, complaint_text } = body

  if (!isNonEmptyString(complainant_name)) {
    return NextResponse.json(
      { error: 'complainant_name is required' },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(complainant_email) || !isValidEmail(complainant_email)) {
    return NextResponse.json(
      { error: 'A valid complainant_email is required' },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(complaint_text)) {
    return NextResponse.json(
      { error: 'complaint_text is required' },
      { status: 400 },
    )
  }

  const receivedAt = new Date()
  const statutoryDeadline = new Date(
    receivedAt.getTime() + STATUTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .insert({
      complainant_name: complainant_name.trim(),
      complainant_email: complainant_email.trim(),
      complaint_text: complaint_text.trim(),
      status: 'received',
      received_at: receivedAt.toISOString(),
      acknowledged_at: receivedAt.toISOString(),
      statutory_deadline: statutoryDeadline.toISOString(),
    })
    .select('id, received_at, statutory_deadline')
    .single()

  if (error || !data) {
    return NextResponse.json(
      {
        error: 'Failed to log complaint',
        details: error?.message || 'unknown',
      },
      { status: 500 },
    )
  }

  await notifyAdmin(
    'New complaint',
    `<p>A complaint was filed by <strong>${escapeHtml(complainant_name.trim())}</strong> (${escapeHtml(complainant_email.trim())}).</p>
     <p>Complaint ID: ${escapeHtml(String(data.id))}</p>
     <p>Statutory deadline: ${escapeHtml(String(data.statutory_deadline))}</p>`,
  )

  return NextResponse.json({
    ok: true,
    id: data.id,
    statutory_deadline: data.statutory_deadline,
    acknowledged_at: data.received_at,
  })
}
