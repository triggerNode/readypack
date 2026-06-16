import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withSignedUrls } from '@/lib/documents/storage'
import type { CaseRow } from '../../_lib/cases'
import { CaseHeader } from './_components/CaseHeader'
import { DeliveryTab } from './_components/DeliveryTab'
import { DocumentsTab } from './_components/DocumentsTab'
import { IntakeAnswersTab } from './_components/IntakeAnswersTab'
import { OverviewTab } from './_components/OverviewTab'
import { RedFlagsTab, type FlagRow } from './_components/RedFlagsTab'
import * as Tabs from './_components/Tabs'
import styles from './case-detail.module.css'

export const dynamic = 'force-dynamic'

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

  const [flagsRes, docsRes, aiToolsRes, vendorsRes, qaReportsRes] = await Promise.all([
    submissionId
      ? supabaseAdmin
          .from('risk_flags')
          .select('id, severity, status, explanation, required_action, triggering_answer, created_at')
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
  ])

  const flags = (flagsRes.data ?? []) as FlagRow[]
  // Sign the private-bucket document paths so the "View Draft PDF" links open.
  const documents = await withSignedUrls(
    (docsRes.data ?? []) as Array<{
      id: string
      document_type: string
      qa_status: 'pending' | 'passed' | 'flagged' | 'failed'
      delivery_status: 'pending' | 'approved' | 'delivered' | 'failed'
      generated_at: string | null
      file_url: string | null
      file_size_bytes: number | null
    }>,
  )
  const aiTools = (aiToolsRes.data ?? []) as ReadonlyArray<{ id: string; tool_name: string; vendor: string | null }>
  const vendors = (vendorsRes.data ?? []) as ReadonlyArray<{ id: string; vendor_name: string }>
  const qaReport = qaReportsRes.data?.[0] ?? null

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

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <CaseHeader c={caseRow} />

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
            <DocumentsTab documents={documents} />
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
            <RedFlagsTab caseId={caseRow.id} flags={flags} />
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
