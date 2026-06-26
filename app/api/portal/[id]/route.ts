// app/api/portal/[id]/route.ts
//
// Single-source-of-truth poll for the UNIFIED customer portal (design brief 14).
// One owner-authorised DB read returns ONE PortalFeed: the phase tracker state,
// every document card's lifecycle state, and the open/submitted info-requests —
// all from the same read (loadPortalFeed), so the tracker and the cards can
// never disagree, and the SSR page + this poll share one code path.
//
// Returns freshly-signed URLs (inline preview + download disposition) so the
// client updates live without a full server refresh. no-store: every poll fresh.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { loadPortalFeed } from '@/lib/documents/portal-feed-loader'

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

  const feed = await loadPortalFeed(orderId, order.delivery_status)

  return NextResponse.json(feed, { headers: { 'Cache-Control': 'no-store' } })
}
