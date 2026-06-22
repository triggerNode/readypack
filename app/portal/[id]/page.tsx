// app/portal/[id]/page.tsx
//
// Customer Delivery Portal — magic-link-only entry point.
// Server Component: authenticates, authorises, loads the pack, then
// renders the (client) CustomerPortal UI.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withSignedUrls } from '@/lib/documents/storage'
import type { DocumentType, InfoRequest } from '@/types/database'
import {
  CustomerPortalClient,
  type PortalDocument,
  type PortalInfoRequest,
} from './_components/CustomerPortalClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Your Documents' }

type Params = Promise<{ id: string }>

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const DOC_META: Record<
  DocumentType,
  { ref: string; title: string; icon: string; reg: string; audience: string }
> = {
  ai_use_statement: {
    ref: 'RP-DOC-01',
    title: 'AI Use Statement',
    icon: 'file-text',
    reg: 'EU AI Act',
    audience: 'External',
  },
  privacy_notice_addendum: {
    ref: 'RP-DOC-02',
    title: 'Privacy Notice Addendum',
    icon: 'shield',
    reg: 'UK GDPR',
    audience: 'External',
  },
  ai_risk_register: {
    ref: 'RP-DOC-03',
    title: 'AI Risk Register',
    icon: 'triangle-alert',
    reg: 'EU AI Act',
    audience: 'Internal',
  },
  dpia_lite: {
    ref: 'RP-DOC-04',
    title: 'DPIA-Lite Assessment',
    icon: 'search',
    reg: 'UK GDPR',
    audience: 'Internal',
  },
  internal_ai_use_policy: {
    ref: 'RP-DOC-05',
    title: 'Internal AI Use Policy',
    icon: 'users',
    reg: 'UK GDPR / AI Act',
    audience: 'Staff',
  },
  customer_disclosure_snippets: {
    ref: 'RP-DOC-06',
    title: 'Customer Disclosure Snippets',
    icon: 'message-square',
    reg: 'EU AI Act',
    audience: 'Resource',
  },
  vendor_ai_register: {
    ref: 'RP-DOC-07',
    title: 'Vendor AI Register',
    icon: 'database',
    reg: 'UK GDPR',
    audience: 'Internal',
  },
  complaints_procedure_pack: {
    ref: 'RP-DOC-08',
    title: 'Complaints Procedure Pack',
    icon: 'scroll-text',
    reg: 'DUAA',
    audience: 'External',
  },
  procurement_response_memo: {
    ref: 'RP-DOC-09',
    title: 'Procurement Response Memo',
    icon: 'clipboard-check',
    reg: 'Procurement',
    audience: 'External',
  },
}

const DOC_ORDER: DocumentType[] = [
  'ai_use_statement',
  'privacy_notice_addendum',
  'ai_risk_register',
  'dpia_lite',
  'internal_ai_use_policy',
  'customer_disclosure_snippets',
  'vendor_ai_register',
  'complaints_procedure_pack',
  'procurement_response_memo',
]

export default async function CustomerPortalPage({ params }: { params: Params }) {
  const { id: orderId } = await params

  if (!UUID_REGEX.test(orderId)) notFound()

  // ── 1. Authenticate ─────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/admin/login?error=portal_signin&next=${encodeURIComponent(`/portal/${orderId}`)}`)
  }

  // ── 2. Authorise: order.user_id MUST equal user.id ──────────────
  // We use the service-role client here because RLS on the orders table is
  // already enforcing the same constraint, but the explicit ownership check
  // gives us a clean 403 path instead of an empty result.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, delivery_status, plan_selected, created_at')
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
    // Deliberately uninformative redirect to avoid confirming the order id.
    redirect('/admin/login?error=portal_forbidden')
  }

  // ── 3. Load documents + customer info ───────────────────────────
  const [{ data: submission }, { data: customerRow }] = await Promise.all([
    supabaseAdmin
      .from('intake_submissions')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('id, email, company_name, trading_name')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const submissionId = submission?.id ?? null

  const [{ data: documents }, { data: infoRequestRows }] = await Promise.all([
    submissionId
      ? supabaseAdmin
          .from('generated_documents')
          .select('id, document_type, file_url, page_count, version_number, delivery_status, render_metadata')
          .eq('submission_id', submissionId)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    // Outstanding / submitted remediation items (Stripe-style requirements model).
    // Open items drive the "action needed" flow; submitted items keep the pack
    // out of approve/revise until the admin resolves them.
    supabaseAdmin
      .from('info_requests')
      .select('id, document_type, prompt, options, status')
      .eq('order_id', order.id)
      .in('status', ['open', 'submitted'])
      .order('created_at', { ascending: true }),
  ])

  const infoRequests: PortalInfoRequest[] = ((infoRequestRows ?? []) as Array<
    Pick<InfoRequest, 'id' | 'document_type' | 'prompt' | 'options' | 'status'>
  >).map((r) => ({
    id: r.id,
    documentType: r.document_type,
    prompt: r.prompt,
    options: Array.isArray(r.options) ? r.options : [],
    status: r.status,
  }))

  const documentRows = (documents ?? []) as Array<{
    id: string
    document_type: DocumentType
    file_url: string | null
    page_count: number | null
    version_number: number
    delivery_status: 'pending' | 'approved' | 'delivered' | 'failed'
    render_metadata: Record<string, unknown> | null
  }>

  // The `documents` bucket is private — replace each stored path with a
  // short-lived signed URL the browser can actually open.
  const signedDocs = await withSignedUrls(documentRows)

  // Order the documents by canonical pack order and merge in display metadata.
  const portalDocs: PortalDocument[] = DOC_ORDER.map((docType) => {
    const row = signedDocs.find((d) => d.document_type === docType)
    const meta = DOC_META[docType]
    const signed = row?.file_url ?? null
    // A second URL flavour that forces a real file download (Content-Disposition:
    // attachment) with a clean filename, vs the inline `fileUrl` used for preview.
    const downloadName = `${meta.ref}-${meta.title.replace(/[^a-z0-9]+/gi, '-')}.pdf`
    const downloadUrl = signed
      ? `${signed}${signed.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`
      : null
    return {
      id: row?.id ?? docType,
      documentType: docType,
      ref: meta.ref,
      title: meta.title,
      icon: meta.icon,
      reg: meta.reg,
      pages: row?.page_count ?? 4,
      audience: meta.audience,
      fileUrl: signed,
      downloadUrl,
      deliveryStatus: row?.delivery_status ?? 'pending',
    }
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

  const packReference = `RP-${order.id.slice(0, 8).toUpperCase()}`

  // The portal shows the "Final" view (download, no watermark) ONLY once the
  // CUSTOMER has approved, which finalises the pack and sets 'delivered'. Under
  // the customer-approves model the admin never sets 'approved' on the customer's
  // behalf, so anything short of 'delivered' is still the review stage. (This
  // also means an order left in a stale 'approved' state correctly falls back to
  // the review flow rather than showing un-watermarked-but-actually-draft PDFs.)
  const isApproved = order.delivery_status === 'delivered'

  return (
    <CustomerPortalClient
      orderId={order.id}
      customerName={customerName}
      customerInitials={customerInitials}
      packReference={packReference}
      isApproved={isApproved}
      documents={portalDocs}
      infoRequests={infoRequests}
    />
  )
}
