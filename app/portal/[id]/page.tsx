// app/portal/[id]/page.tsx
//
// Customer Portal — magic-link-only entry point. This is now the ONE customer
// screen for the whole life of the pack (design brief 14): progress tracker +
// documents on one page. /status/[id] permanently redirects here.
//
// Server Component: authenticates, authorises, computes the initial PortalFeed
// (the SAME object the /api/portal/[id] poll returns, via the shared loader) so
// the first paint is real and the client just keeps it live by polling.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { loadPortalFeed } from '@/lib/documents/portal-feed-loader'
import { CustomerPortalClient } from './_components/CustomerPortalClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Your Compliance Pack' }

type Params = Promise<{ id: string }>

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export default async function CustomerPortalPage({ params }: { params: Params }) {
  const { id: orderId } = await params

  if (!UUID_REGEX.test(orderId)) notFound()

  // ── 1. Authenticate ─────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // No session (expired/one-time link, or returning on a different device).
    // Send them to the customer re-entry screen — "enter your email, we'll send a
    // fresh link" — NOT the admin login. It preserves `next` so the fresh link
    // lands them right back on this portal.
    redirect(`/resume?next=${encodeURIComponent(`/portal/${orderId}`)}`)
  }

  // ── 2. Authorise: order.user_id MUST equal user.id ──────────────
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status, display_reference')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    return (
      <div style={{ padding: 48, color: 'var(--danger)', background: 'var(--bg-primary)', minHeight: '100vh' }}>
        Failed to load pack: {orderError.message}
      </div>
    )
  }
  if (!order) notFound()

  if (order.user_id !== user.id) {
    // Signed in as someone else (e.g. an admin session in the same browser, or a
    // shared device). Send them to the customer re-entry screen to request a fresh
    // link for THEIR pack — never the admin login. `switch_account` tells /resume
    // NOT to bounce the wrong session straight back here (which would loop).
    redirect(`/resume?next=${encodeURIComponent(`/portal/${orderId}`)}&reason=switch_account`)
  }

  // ── 3. Customer identity (for the header) + the initial feed ────
  const [{ data: customerRow }, initialFeed] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, email, company_name, trading_name')
      .eq('id', user.id)
      .maybeSingle(),
    loadPortalFeed(order.id, order.delivery_status),
  ])

  const customerName =
    customerRow?.trading_name || customerRow?.company_name || customerRow?.email || 'Your business'
  const customerInitials = (() => {
    const seed: string = customerName.trim()
    const parts: string[] = seed.split(/\s+/).slice(0, 2)
    const initials = parts.map((p: string) => p.charAt(0).toUpperCase()).join('')
    const pad = parts[0]?.charAt(1)?.toUpperCase() || 'R'
    return initials.padEnd(2, pad).slice(0, 2)
  })()

  // Use the canonical, customer-facing reference (set by the Stripe webhook and
  // shown on the confirmation page + every email); fall back to the order-id
  // slice only for legacy orders without one.
  const packReference =
    order.display_reference ?? `RP-${order.id.slice(0, 8).toUpperCase()}`

  return (
    <CustomerPortalClient
      orderId={order.id}
      customerName={customerName}
      customerInitials={customerInitials}
      packReference={packReference}
      initialFeed={initialFeed}
    />
  )
}
