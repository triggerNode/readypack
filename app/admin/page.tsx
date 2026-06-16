import { supabaseAdmin } from '@/lib/supabase/admin'
import { CasesSearch } from './_components/CasesSearch'
import { CasesTable } from './_components/CasesTable'
import { FilterTabs } from './_components/FilterTabs'
import {
  applyCasesFilters,
  countFlagged,
  countNeedsAction,
  countOverdue,
  sortByUrgency,
  SORT_LABELS,
  type CaseRow,
  type FilterTab,
  type SortKey,
} from './_lib/cases'
import styles from './cases-list.module.css'

export const dynamic = 'force-dynamic'

function parseTab(raw: string | string[] | undefined): FilterTab {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'needs_action' || v === 'flagged' || v === 'overdue') return v
  return 'all'
}

function parseSort(raw: string | string[] | undefined): SortKey {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'created_desc' || v === 'created_asc') return v
  return 'deadline_asc'
}

function parseSearch(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  return (v ?? '').toString().slice(0, 200)
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminCasesListPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const tab = parseTab(sp.tab)
  const sort = parseSort(sp.sort)
  const search = parseSearch(sp.q)

  const orderColumn = sort === 'created_desc' ? 'order_created_at' : 'order_created_at'
  const ascending = sort !== 'created_desc'

  const { data, error } = await supabaseAdmin
    .from('cases')
    .select('*')
    .order(orderColumn, { ascending })
    .limit(500)

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <h1>Cases</h1>
          <p style={{ color: 'var(--danger)', marginTop: 'var(--sp-4)' }}>
            Failed to load cases: {error.message}
          </p>
        </div>
      </div>
    )
  }

  const allRows = (data ?? []) as CaseRow[]
  const now = new Date()
  const nowMs = now.getTime()

  const counts = {
    all: allRows.length,
    needs_action: countNeedsAction(allRows),
    flagged: countFlagged(allRows),
    overdue: countOverdue(allRows, now),
  }

  const filtered = applyCasesFilters(allRows, { tab, search }, now)
  const sorted = sort === 'deadline_asc' ? sortByUrgency(filtered, now) : filtered

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pagehead}>
          <div>
            <h1>Cases</h1>
            <div className={styles.sub}>
              {counts.all} total · {counts.needs_action} need action ·{' '}
              {counts.overdue > 0 ? (
                <span className={styles.alert}>{counts.overdue} overdue</span>
              ) : (
                <span>{counts.overdue} overdue</span>
              )}
            </div>
          </div>
          <CasesSearch defaultValue={search} />
        </div>

        <FilterTabs active={tab} counts={counts} search={search} sort={sort} />

        <div className={styles.sortline}>
          Sorted by: <strong>{SORT_LABELS[sort]}</strong>
        </div>

        <CasesTable rows={sorted} nowMs={nowMs} />

        <div className={styles.footerLine}>
          Showing {sorted.length} of {counts.all} cases
        </div>
      </div>
    </div>
  )
}
