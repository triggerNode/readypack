// app/status/[id]/page.tsx
//
// Customer Pack Progress screen — the live status page a customer lands on
// after submitting their questionnaire (and the link in their emails).
// Server Component: authenticates + authorises like the portal page, computes
// the initial PackStatus so the first paint is real (not a spinner), then
// renders the polling client (design: design/PackProgress.html).

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { computePackState } from '@/lib/documents/pack-status'
import { PackProgressClient } from './_components/PackProgressClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pack Progress' }

type Params = Promise<{ id: string }>

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export default async function PackProgressPage({ params }: { params: Params }) {
  const { id: orderId } = await params
  if (!UUID_REGEX.test(orderId)) notFound()

  // ── 1. Authenticate ─────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/admin/login?error=portal_signin&next=${encodeURIComponent(`/status/${orderId}`)}`)
  }

  // ── 2. Authorise: order.user_id MUST equal user.id ──────────────
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status, display_reference')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) notFound()
  if (order.user_id !== user.id) {
    redirect('/admin/login?error=portal_forbidden')
  }

  // ── 3. Load the customer name + the inputs for the initial status ─
  const [{ data: customerRow }, { data: submission }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('email, company_name, trading_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('intake_submissions')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle(),
  ])

  let docsReady = 0
  let docsFinal = 0
  let docsInRevision = 0
  let openInfoRequests = 0
  let jobStatus: string | null = null
  let jobStartedAt: string | null = null

  // Released-to-customer signal (a delivery email was sent) — flips the screen
  // from internal-QA copy to the customer's-own-review copy. Mirrors the status
  // API so the first server paint matches subsequent polls. Folded into the
  // parallel batch (release always implies a submission).
  let released = false

  if (submission) {
    const [docsResult, infoResult, jobResult, commsResult] = await Promise.all([
      supabaseAdmin
        .from('generated_documents')
        .select('delivery_status')
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
      supabaseAdmin
        .from('customer_communications')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('email_type', 'delivery'),
    ])
    const docRows = (docsResult.data ?? []) as Array<{ delivery_status: string }>
    docsReady = docRows.length
    docsFinal = docRows.filter((d) => d.delivery_status === 'delivered').length
    docsInRevision = docRows.filter((d) => d.delivery_status === 'in_revision').length
    openInfoRequests = infoResult.count ?? 0
    jobStatus = (jobResult.data?.status as string | undefined) ?? null
    jobStartedAt = (jobResult.data?.started_at as string | undefined) ?? null
    released = (commsResult.count ?? 0) > 0
  }

  const initialStatus = computePackState({
    deliveryStatus: order.delivery_status,
    jobStatus,
    jobStartedAt,
    docsReady,
    docsFinal,
    docsInRevision,
    openInfoRequests,
    released,
  })

  const customerName =
    customerRow?.trading_name || customerRow?.company_name || customerRow?.email || 'Your business'
  const customerInitials = (() => {
    const seed: string = customerName.trim()
    const parts: string[] = seed.split(/\s+/).slice(0, 2)
    const initials = parts.map((p: string) => p.charAt(0).toUpperCase()).join('')
    const pad = parts[0]?.charAt(1)?.toUpperCase() || 'R'
    return initials.padEnd(2, pad).slice(0, 2)
  })()

  // Prefer the saved, customer-facing reference so it matches the confirmation
  // page, the emails, and the admin — fall back to the order-id-derived value.
  const packReference =
    (order.display_reference as string | null) ?? `RP-${order.id.slice(0, 8).toUpperCase()}`

  return (
    <PackProgressClient
      orderId={order.id}
      customerName={customerName}
      customerInitials={customerInitials}
      packReference={packReference}
      initialStatus={initialStatus}
    />
  )
}
