import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { withSignedUrls } from '@/lib/documents/storage'
import { isBlockingFlag } from '@/lib/risk/gate'
import type { CaseRow } from '../../_lib/cases'
import { customerDisplayName, planLabel } from '../../_lib/cases'
import { deriveRunbook, type CaseRunbookState } from '../../_lib/runbook'
import { deriveLifecycle } from '../../_lib/lifecycle'
import {
  deriveFlagView,
  orderFlagViews,
  summariseFlagViews,
  type FlagRowForView,
} from '../../_lib/flag-view'
import { CaseRunbook, type GateState } from './_components/CaseRunbook'
import { DeliveryTab } from './_components/DeliveryTab'
import { DocumentsTab } from './_components/DocumentsTab'
import { IntakeAnswersTab } from './_components/IntakeAnswersTab'
import { OverviewTab } from './_components/OverviewTab'
import { RedFlagsTab, type FlagRow } from './_components/RedFlagsTab'
import { InfoRequestsTab, type InfoRequestRow } from './_components/InfoRequestsTab'
import { RevisionsTab, type RevisionRow } from './_components/RevisionsTab'
import * as Tabs from './_components/Tabs'
import styles from './case-detail.module.css'

/** Ordered-at line for the case story header, e.g. "Ordered 6 Jun 2026, 11:20". */
function formatOrderedAt(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const year = d.getFullYear()
  const time = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `Ordered ${day} ${month} ${year}, ${time}`
}

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Admin · Case' }

/**
 * Lightweight card for tabs whose full design isn't built yet (AI Systems,
 * Vendors, QA Report, Payments, Notes, Timeline). Renders the data we already
 * have in the design's card/spacing aesthetic.
 */
function StubCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className={styles.stubCard}>
      <h2>{title}</h2>
      {description ? <p className={styles.stubDesc}>{description}</p> : null}
      {children}
    </div>
  )
}

type Params = Promise<{ id: string }>

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export default async function AdminCaseDetailPage({ params }: { params: Params }) {
  // Defence in depth: this page reads case data via the service-role client
  // (RLS-bypassing), so it must enforce admin auth itself rather than relying
  // only on the layout guard. Also ensures a logged-out visitor is redirected
  // to login before notFound() can fire for a non-existent case id.
  await requireAdmin()

  const { id } = await params
  if (!UUID_REGEX.test(id)) notFound()

  // ── Case row ──────────────────────────────────────────────
  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('id', id)
    .maybeSingle<CaseRow>()

  if (caseError) {
    return (
      <div style={{ padding: 'var(--sp-8)' }}>
        <p style={{ color: 'var(--danger)' }}>Failed to load case: {caseError.message}</p>
      </div>
    )
  }
  if (!caseRow) notFound()

  // ── Related rows (parallel) ───────────────────────────────
  const submissionId = caseRow.submission_id ?? null

  const [flagsRes, docsRes, aiToolsRes, vendorsRes, qaReportsRes, genEventsRes, infoReqRes, revisionsRes] =
    await Promise.all([
    submissionId
      ? supabaseAdmin
          .from('risk_flags')
          .select(
            'id, code, severity, status, explanation, required_action, triggering_answer, resolution_type, resolution_note, resolved_at, created_at',
          )
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as const),
    submissionId
      ? supabaseAdmin
          .from('generated_documents')
          .select('id, document_type, qa_status, delivery_status, generated_at, file_url, file_size_bytes')
          .eq('submission_id', submissionId)
          .order('document_type', { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    submissionId
      ? supabaseAdmin
          .from('ai_tools')
          .select('id, tool_name, vendor')
          .eq('submission_id', submissionId)
      : Promise.resolve({ data: [], error: null } as const),
    submissionId
      ? supabaseAdmin
          .from('vendors')
          .select('id, vendor_name')
          .eq('submission_id', submissionId)
      : Promise.resolve({ data: [], error: null } as const),
    submissionId
      ? supabaseAdmin
          .from('qa_reports')
          .select('id, completeness_score, risk_score, recommended_action, human_escalation_required, created_at, updated_at')
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null } as const),
    // Failed document generations for this order (id === order id). Used to
    // show "N of 9 generated, M failed" with reasons in the Documents tab.
    supabaseAdmin
      .from('generation_events')
      .select('document_type, error_message, status, created_at')
      .eq('order_id', id)
      .eq('status', 'failed')
      .order('created_at', { ascending: false }),
    // Information requests for this case (id === order id). Drives the Info
    // Requests tab + open badge, and the Resolve action.
    supabaseAdmin
      .from('info_requests')
      .select('id, document_type, prompt, options, answer_text, answer_selections, status, created_at, answered_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    // Customer-initiated revision requests (id === order id). Drives the
    // Revisions tab + badge, and the Regenerate / Re-release actions.
    supabaseAdmin
      .from('case_revisions')
      .select('id, document_types, feedback_text, status, kind, created_at, metadata')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
  ])

  // The full flag rows (superset of RedFlagsTab's FlagRow): `code` + the
  // resolution_* columns feed the runbook's flag cards; the tab reads its subset.
  const flags = (flagsRes.data ?? []) as Array<FlagRowForView & { created_at: string }>
  // Superset → subset: the tab reads only the FlagRow fields.
  const flagRows: FlagRow[] = flags
  // Sign the private-bucket document paths so the "View Draft PDF" links open.
  const documents = await withSignedUrls(
    (docsRes.data ?? []) as Array<{
      id: string
      document_type: string
      qa_status: 'pending' | 'passed' | 'flagged' | 'failed'
      delivery_status: 'pending' | 'approved' | 'in_revision' | 'delivered' | 'failed'
      generated_at: string | null
      file_url: string | null
      file_size_bytes: number | null
    }>,
  )
  // Build the failed-document list: most recent failure per document type,
  // excluding any type that ultimately generated successfully (e.g. after a
  // re-trigger). Drives the "N of 9 generated, M failed" summary.
  const TOTAL_PACK_DOCUMENTS = 9
  const successfulDocTypes = new Set(documents.map((d) => d.document_type))
  const failedEvents = (genEventsRes.data ?? []) as ReadonlyArray<{
    document_type: string
    error_message: string | null
  }>
  const seenFailedTypes = new Set<string>()
  const documentFailures: Array<{ documentType: string; error: string }> = []
  for (const ev of failedEvents) {
    if (successfulDocTypes.has(ev.document_type)) continue
    if (seenFailedTypes.has(ev.document_type)) continue
    seenFailedTypes.add(ev.document_type)
    documentFailures.push({
      documentType: ev.document_type,
      error: ev.error_message ?? 'Generation failed',
    })
  }

  const aiTools = (aiToolsRes.data ?? []) as ReadonlyArray<{ id: string; tool_name: string; vendor: string | null }>
  const vendors = (vendorsRes.data ?? []) as ReadonlyArray<{ id: string; vendor_name: string }>
  const qaReport = qaReportsRes.data?.[0] ?? null

  const infoRequests = ((infoReqRes.data ?? []) as InfoRequestRow[]).map((r) => ({
    ...r,
    options: Array.isArray(r.options) ? r.options : [],
    answer_selections: Array.isArray(r.answer_selections) ? r.answer_selections : [],
  }))
  const openInfoRequestCount = infoRequests.filter(
    (r) => r.status === 'open' || r.status === 'submitted',
  ).length

  const revisions = ((revisionsRes.data ?? []) as RevisionRow[]).map((r) => ({
    ...r,
    document_types: Array.isArray(r.document_types) ? r.document_types : [],
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }))
  // Customer-initiated revisions still needing the admin to act (regenerate).
  const openRevisionCount = revisions.filter(
    (r) => r.kind === 'revision' && (r.status === 'submitted' || r.status === 'in_review'),
  ).length

  const openFlags = flags
    .filter(f => f.status === 'open')
    .map(f => ({ id: f.id, severity: f.severity, explanation: f.explanation }))

  // Synthesise the activity timeline from the records we have. This is
  // intentionally light-touch — Stage 7 has no dedicated event log table,
  // so we surface the most useful signals already in the schema.
  const activity: { label: string; at: string; tone: 'green' | 'indigo' | 'grey' }[] = []
  if (qaReport) {
    activity.push({
      label: caseRow.status === 'in_progress' ? 'QA check started' : 'QA check completed',
      at: qaReport.updated_at ?? qaReport.created_at,
      tone: caseRow.status === 'in_progress' ? 'indigo' : 'green',
    })
  }
  if (documents.some(d => d.generated_at)) {
    const latest = documents
      .filter(d => d.generated_at)
      .map(d => d.generated_at as string)
      .sort()
      .pop() as string
    activity.push({ label: 'Document generation completed', at: latest, tone: 'green' })
  }
  if (caseRow.completion_status === 'submitted' && caseRow.last_saved) {
    activity.push({ label: 'Intake submitted', at: caseRow.last_saved, tone: 'green' })
  }
  activity.push({ label: 'Order placed', at: caseRow.order_created_at, tone: 'grey' })
  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const openFlagCount = caseRow.open_flag_count

  // ── Runbook surface — all derived from the rows already loaded above ────────
  const intakeSubmitted = caseRow.completion_status === 'submitted'
  const docsTotal = documents.length
  // Open high/critical flags still needing a human sign-off = the delivery gate.
  // Uses the one shared predicate so the banner never drifts from the real gate.
  const openHighFlags = flags.filter((f) =>
    isBlockingFlag({ severity: f.severity, status: f.status }),
  ).length
  const alreadyReleased =
    caseRow.delivery_status === 'qa_review' ||
    caseRow.delivery_status === 'escalated' ||
    caseRow.delivery_status === 'approved' ||
    caseRow.delivery_status === 'delivered'

  const openInfoRequests = infoRequests.filter((r) => r.status === 'open').length
  const answeredInfoRequestRows = infoRequests.filter((r) => r.status === 'submitted')
  const openRevisionRows = revisions.filter(
    (r) => r.kind === 'revision' && (r.status === 'submitted' || r.status === 'in_review'),
  )

  const runbookState: CaseRunbookState = {
    intakeSubmitted,
    deliveryStatus: caseRow.delivery_status,
    riskLevel: caseRow.risk_level,
    docsTotal,
    docsFailed: documentFailures.length,
    openHighFlags,
    openRevisions: openRevisionRows.length,
    answeredInfoRequests: answeredInfoRequestRows.length,
    openInfoRequests,
  }
  const runbook = deriveRunbook(runbookState)
  const lifecycle = deriveLifecycle({
    intakeSubmitted,
    deliveryStatus: caseRow.delivery_status,
    docsTotal,
  })
  const flagViews = orderFlagViews(flags.map((f) => deriveFlagView(f)))
  const flagSummary = summariseFlagViews(flagViews)

  // Gate banner state: only meaningful for a generated, not-yet-delivered pack.
  // Blocked while high flags are open; cleared (with a Release button) once none
  // remain and it hasn't gone out yet. The real gate stays server-side — this only
  // reflects it. Fail-safe: an already-released clear pack hides the banner (the
  // runbook's "with the customer" state covers it).
  const gate: GateState =
    docsTotal === 0 || caseRow.delivery_status === 'delivered'
      ? { show: false }
      : openHighFlags > 0
      ? { show: true, blocked: true, openHighFlags }
      : alreadyReleased
      ? { show: false }
      : { show: true, blocked: false }

  // Surface a step's real button only when exactly one target exists; 2+ → a
  // pointer to the owning tab (no ambiguous button).
  const openRevision =
    openRevisionRows.length === 1
      ? { id: openRevisionRows[0].id, awaitingRerelease: openRevisionRows[0].status === 'in_review' }
      : null
  const answeredInfoRequest =
    answeredInfoRequestRows.length === 1 ? { id: answeredInfoRequestRows[0].id } : null

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <CaseRunbook
          caseId={caseRow.id}
          displayName={customerDisplayName(caseRow)}
          customerEmail={caseRow.customer_email}
          tierLabel={planLabel(caseRow.plan_selected)}
          riskLevel={caseRow.risk_level}
          deliveryDeadline={caseRow.delivery_deadline}
          caseStatus={caseRow.status}
          orderedAtLabel={formatOrderedAt(caseRow.order_created_at)}
          stripePaymentId={caseRow.stripe_payment_id}
          runbook={runbook}
          lifecycle={lifecycle}
          flags={flagViews}
          flagSummary={flagSummary}
          gate={gate}
          alreadyReleased={alreadyReleased}
          openRevision={openRevision}
          openRevisionCount={openRevisionRows.length}
          answeredInfoRequest={answeredInfoRequest}
          answeredInfoRequestCount={answeredInfoRequestRows.length}
        />

        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="intake">Intake Answers</Tabs.Trigger>
            <Tabs.Trigger value="ai">AI Systems</Tabs.Trigger>
            <Tabs.Trigger value="vendors">Vendors</Tabs.Trigger>
            <Tabs.Trigger value="documents">Documents</Tabs.Trigger>
            <Tabs.Trigger value="qa">QA Report</Tabs.Trigger>
            <Tabs.Trigger
              value="flags"
              badge={
                openFlagCount > 0 ? (
                  <span className={styles.tabFlagdot}>{openFlagCount}</span>
                ) : null
              }
            >
              Red Flags
            </Tabs.Trigger>
            <Tabs.Trigger
              value="info"
              badge={
                openInfoRequestCount > 0 ? (
                  <span className={styles.tabFlagdot}>{openInfoRequestCount}</span>
                ) : null
              }
            >
              Info Requests
            </Tabs.Trigger>
            <Tabs.Trigger
              value="revisions"
              badge={
                openRevisionCount > 0 ? (
                  <span className={styles.tabFlagdot}>{openRevisionCount}</span>
                ) : null
              }
            >
              Revisions
            </Tabs.Trigger>
            <Tabs.Trigger value="delivery">Delivery</Tabs.Trigger>
            <Tabs.Trigger value="payments">Payments</Tabs.Trigger>
            <Tabs.Trigger value="notes">Notes</Tabs.Trigger>
            <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Panel value="overview">
            <OverviewTab
              c={caseRow}
              documents={documents}
              aiTools={aiTools}
              vendors={vendors}
              openFlags={openFlags}
              activity={activity}
              qaStartedIso={qaReport?.created_at ?? null}
            />
          </Tabs.Panel>

          <Tabs.Panel value="intake">
            <IntakeAnswersTab
              rawAnswers={caseRow.raw_answers}
              sectionCompletion={caseRow.section_completion}
            />
          </Tabs.Panel>

          <Tabs.Panel value="ai">
            <StubCard title="AI Systems" description={`${aiTools.length} AI tool(s) declared.`}>
              <ul className={styles.stubList}>
                {aiTools.map(t => (
                  <li key={t.id}>{t.tool_name}{t.vendor ? ` — ${t.vendor}` : ''}</li>
                ))}
              </ul>
            </StubCard>
          </Tabs.Panel>

          <Tabs.Panel value="vendors">
            <StubCard title="Vendors" description={`${vendors.length} vendor(s) declared.`}>
              <ul className={styles.stubList}>
                {vendors.map(v => (
                  <li key={v.id}>{v.vendor_name}</li>
                ))}
              </ul>
            </StubCard>
          </Tabs.Panel>

          <Tabs.Panel value="documents">
            <DocumentsTab
              documents={documents}
              expectedCount={TOTAL_PACK_DOCUMENTS}
              failures={documentFailures}
            />
          </Tabs.Panel>

          <Tabs.Panel value="qa">
            <StubCard
              title="QA Report"
              description={
                qaReport
                  ? `Completeness ${qaReport.completeness_score ?? '—'} · Risk ${
                      qaReport.risk_score ?? '—'
                    } · Recommendation: ${qaReport.recommended_action ?? '—'}`
                  : 'No QA report available yet.'
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="flags">
            <RedFlagsTab caseId={caseRow.id} flags={flagRows} />
          </Tabs.Panel>

          <Tabs.Panel value="info">
            <InfoRequestsTab caseId={caseRow.id} requests={infoRequests} />
          </Tabs.Panel>

          <Tabs.Panel value="revisions">
            <RevisionsTab caseId={caseRow.id} revisions={revisions} />
          </Tabs.Panel>

          <Tabs.Panel value="delivery">
            <DeliveryTab
              caseId={caseRow.id}
              deliveryStatus={caseRow.delivery_status}
              deliveredAt={caseRow.order_updated_at}
            />
          </Tabs.Panel>

          <Tabs.Panel value="payments">
            <StubCard
              title="Payments"
              description={`Payment status: ${caseRow.payment_status}.`}
            >
              {caseRow.stripe_payment_id ? (
                <a
                  href={`https://dashboard.stripe.com/payments/${encodeURIComponent(caseRow.stripe_payment_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.stubLink}
                >
                  View payment in Stripe →
                </a>
              ) : null}
            </StubCard>
          </Tabs.Panel>

          <Tabs.Panel value="notes">
            <StubCard
              title="Notes"
              description="Internal notes from Override & Note actions and admin annotations live here. Persisted to audit_events.metadata.note for full traceability."
            />
          </Tabs.Panel>

          <Tabs.Panel value="timeline">
            <StubCard title="Timeline" description="Full audit_events feed for this case will appear here.">
              <ol className={styles.stubList}>
                {activity.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    {a.label} — {new Date(a.at).toLocaleString('en-GB')}
                  </li>
                ))}
              </ol>
            </StubCard>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
    </div>
  )
}
