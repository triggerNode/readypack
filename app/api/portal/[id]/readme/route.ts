// app/api/portal/[id]/readme/route.ts
//
// Portal backup copy of the "What we noticed" read-me — the same one-pager attached
// to the completion email, rendered on demand in case a corporate mail server strips
// the attachment. Owner-authorised (same model as the portal poll route).

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { loadReadmeModel } from '@/lib/documents/readme-service'
import { renderReadmePdf } from '@/lib/documents/readme-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  if (!UUID_REGEX.test(orderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authenticate + authorise (owner only) — mirrors app/api/portal/[id]/route.ts.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const model = await loadReadmeModel(orderId)
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pdf = await renderReadmePdf(model)
  // Node Buffer is a Uint8Array at runtime but isn't in the DOM BodyInit type.
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="ReadyPack - What we noticed.pdf"',
      'Cache-Control': 'no-store',
    },
  })
}
