import Link from 'next/link'
import { FILTER_TABS, type FilterTab, buildCasesQuery, type SortKey } from '../_lib/cases'
import styles from '../cases-list.module.css'

type Counts = {
  all: number
  needs_action: number
  flagged: number
  overdue: number
}

type Props = {
  active: FilterTab
  counts: Counts
  search: string
  sort: SortKey
}

export function FilterTabs({ active, counts, search, sort }: Props) {
  return (
    <div role="tablist" aria-label="Filter cases" className={styles.tabs}>
      {FILTER_TABS.map(tab => {
        const isActive = tab.key === active
        const count = counts[tab.key]
        const href = `/admin${buildCasesQuery({ tab: tab.key, search, sort })}`
        const className = `${styles.tab}${isActive ? ` ${styles.tabActive}` : ''}`
        return (
          <Link
            key={tab.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={className}
          >
            <span>{tab.label}</span>
            <span className={styles.tabCount}>{count}</span>
          </Link>
        )
      })}
    </div>
  )
}
