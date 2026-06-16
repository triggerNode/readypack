/**
 * Shared types and helpers for the admin cases queue and case detail view.
 *
 * The `cases` view (see supabase/migrations/002_cases_view.sql) projects orders
 * + intake_submissions + users + organisations into a single row keyed by
 * order id, with a computed `status` and `delivery_deadline`.
 */

export type CaseStatus = 'pending' | 'in_progress' | 'ready' | 'flagged' | 'delivered'

export type PlanCode = 'solo' | 'team' | 'adviser'

export type CaseRow = {
  id: string
  user_id: string
  billing_org_id: string
  client_org_id: string
  plan_selected: PlanCode
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed'
  delivery_status:
    | 'pending'
    | 'generating'
    | 'qa_review'
    | 'escalated'
    | 'approved'
    | 'delivered'
    | 'failed'
  stripe_payment_id: string | null
  stripe_session_id: string | null
  order_created_at: string
  order_updated_at: string
  delivery_deadline: string

  submission_id: string | null
  completion_status: 'not_started' | 'in_progress' | 'submitted' | null
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null
  last_saved: string | null
  section_completion: Record<string, boolean> | null
  raw_answers: Record<string, unknown> | null
  normalised_answers: Record<string, unknown> | null

  customer_email: string | null
  company_name: string | null
  trading_name: string | null

  client_org_name: string | null
  client_org_type: string | null
  billing_org_name: string | null
  billing_org_type: string | null
  partner_display_name: string | null

  status: CaseStatus
  open_flag_count: number
  critical_flag_count: number
}

export type FilterTab = 'all' | 'needs_action' | 'flagged' | 'overdue'

export const FILTER_TABS: ReadonlyArray<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs_action', label: 'Needs Action' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'overdue', label: 'Overdue' },
]

const PLAN_LABELS: Record<PlanCode, { label: string; price: string }> = {
  solo: { label: 'Solo', price: '£249' },
  team: { label: 'Procurement Ready', price: '£499' },
  adviser: { label: 'Adviser Pack', price: '£799' },
}

export function planLabel(plan: PlanCode | string | null): string {
  if (!plan) return '—'
  const known = PLAN_LABELS[plan as PlanCode]
  if (!known) return plan
  return `${known.label} · ${known.price}`
}

// The questionnaire-provided company name, used when the sign-up record has no
// company_name (e.g. dev/test orders). Flat `company_name` is written to
// normalised_answers on submit; raw_answers['1'].company_name is the fallback.
function intakeCompanyName(
  normalised: Record<string, unknown> | null,
  raw: Record<string, unknown> | null,
): string | undefined {
  const flat = typeof normalised?.company_name === 'string' ? normalised.company_name.trim() : ''
  if (flat) return flat
  const section1 = (raw?.['1'] ?? null) as Record<string, unknown> | null
  const fromSection = typeof section1?.company_name === 'string' ? section1.company_name.trim() : ''
  return fromSection || undefined
}

export function customerDisplayName(
  c: Pick<
    CaseRow,
    'company_name' | 'trading_name' | 'client_org_name' | 'customer_email' | 'normalised_answers' | 'raw_answers'
  >,
): string {
  return (
    c.client_org_name ??
    c.company_name ??
    c.trading_name ??
    intakeCompanyName(c.normalised_answers, c.raw_answers) ??
    c.customer_email ??
    'Unknown customer'
  )
}

export function isOverdue(deadlineIso: string, status: CaseStatus, now: Date = new Date()): boolean {
  if (status === 'delivered') return false
  return new Date(deadlineIso).getTime() < now.getTime()
}

/**
 * Returns the URL search-string portion (no leading `?`) for the given
 * filter / search / sort combo. Empty values are omitted.
 */
export function buildCasesQuery(opts: {
  tab?: FilterTab
  search?: string
  sort?: SortKey
}): string {
  const params = new URLSearchParams()
  if (opts.tab && opts.tab !== 'all') params.set('tab', opts.tab)
  if (opts.search && opts.search.trim().length > 0) params.set('q', opts.search.trim())
  if (opts.sort && opts.sort !== 'deadline_asc') params.set('sort', opts.sort)
  const s = params.toString()
  return s.length > 0 ? `?${s}` : ''
}

export type SortKey = 'deadline_asc' | 'created_desc' | 'created_asc'

export const SORT_LABELS: Record<SortKey, string> = {
  deadline_asc: 'Delivery deadline ↑',
  created_desc: 'Newest first',
  created_asc: 'Oldest first',
}

/**
 * Sort cases for the default "urgency" view: overdue + flagged first,
 * then by soonest deadline. Pure function — does not mutate input.
 */
export function sortByUrgency(rows: ReadonlyArray<CaseRow>, now: Date = new Date()): CaseRow[] {
  return [...rows].sort((a, b) => {
    const overdueRank = (c: CaseRow): number => {
      if (c.status === 'delivered') return 3
      if (isOverdue(c.delivery_deadline, c.status, now)) return 0
      if (c.status === 'flagged') return 1
      return 2
    }
    const ra = overdueRank(a)
    const rb = overdueRank(b)
    if (ra !== rb) return ra - rb
    return new Date(a.delivery_deadline).getTime() - new Date(b.delivery_deadline).getTime()
  })
}

export function applyCasesFilters(
  rows: ReadonlyArray<CaseRow>,
  opts: { tab: FilterTab; search: string },
  now: Date = new Date(),
): CaseRow[] {
  const search = opts.search.trim().toLowerCase()
  return rows.filter(c => {
    if (opts.tab === 'needs_action' && !(c.status === 'pending' || c.status === 'in_progress')) return false
    if (opts.tab === 'flagged' && c.status !== 'flagged') return false
    if (opts.tab === 'overdue' && !isOverdue(c.delivery_deadline, c.status, now)) return false

    if (search.length === 0) return true
    const haystack = [
      c.customer_email,
      c.company_name,
      c.trading_name,
      c.client_org_name,
      customerDisplayName(c),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(search)
  })
}

export function countNeedsAction(rows: ReadonlyArray<CaseRow>): number {
  return rows.filter(c => c.status === 'pending' || c.status === 'in_progress').length
}

export function countFlagged(rows: ReadonlyArray<CaseRow>): number {
  return rows.filter(c => c.status === 'flagged').length
}

export function countOverdue(rows: ReadonlyArray<CaseRow>, now: Date = new Date()): number {
  return rows.filter(c => isOverdue(c.delivery_deadline, c.status, now)).length
}
