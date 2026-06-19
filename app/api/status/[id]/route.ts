// app/api/status/[id]/route.ts
// Polling endpoint for the customer Pack Progress screen. Owner-authorised;
// returns the computed PackStatus as JSON. No-store so each poll is fresh.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { computePackState } from '@/lib/documents/pack-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  if (!UUID_REGEX.test(orderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authenticate + authorise (same model as the portal page).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: submission } = await supabaseAdmin
    .from('intake_submissions')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle()

  let docsReady = 0
  let openInfoRequests = 0
  let jobStatus: string | null = null
  let jobStartedAt: string | null = null

  if (submission) {
    const [docsResult, infoResult, jobResult] = await Promise.all([
      supabaseAdmin
        .from('generated_documents')
        .select('id', { count: 'exact', head: true })
        .eq('submission_id', submission.id),
      supabaseAdmin
        .from('info_requests')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('status', 'open'),
      supabaseAdmin
        .from('document_generation_jobs')
        .select('status, started_at')
        .eq('submission_id', submission.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    docsReady = docsResult.count ?? 0
    openInfoRequests = infoResult.count ?? 0
    jobStatus = (jobResult.data?.status as string | undefined) ?? null
    jobStartedAt = (jobResult.data?.started_at as string | undefined) ?? null
  }

  const status = computePackState({
    deliveryStatus: order.delivery_status,
    jobStatus,
    jobStartedAt,
    docsReady,
    openInfoRequests,
  })

  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
