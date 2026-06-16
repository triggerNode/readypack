'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  ClipboardList,
  Layers,
  ScanSearch,
  ScrollText,
  Settings,
  Terminal,
  type LucideIcon,
} from 'lucide-react'
import styles from '../admin.module.css'

type NavItem = {
  href: string
  label: string
  Icon: LucideIcon
  /** Pathnames (or pathname prefixes) that should mark this item active. */
  matches: ReadonlyArray<string>
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    href: '/admin',
    label: 'Cases',
    Icon: ClipboardList,
    matches: ['/admin', '/admin/cases'],
  },
  {
    href: '/admin/gap-scanner',
    label: 'Gap Scanner',
    Icon: ScanSearch,
    matches: ['/admin/gap-scanner'],
  },
  {
    href: '/admin/generation-queue',
    label: 'Generation Queue',
    Icon: Layers,
    matches: ['/admin/generation-queue'],
  },
  {
    href: '/admin/ai-usage',
    label: 'AI Usage',
    Icon: Banknote,
    matches: ['/admin/ai-usage'],
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    Icon: ScrollText,
    matches: ['/admin/audit-log'],
  },
  {
    href: '/admin/dev',
    label: 'Dev Tools',
    Icon: Terminal,
    matches: ['/admin/dev'],
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    Icon: Settings,
    matches: ['/admin/settings'],
  },
]

function isActive(itemMatches: ReadonlyArray<string>, pathname: string): boolean {
  return itemMatches.some(prefix => {
    if (prefix === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/cases')
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

export function AdminSidebarNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav aria-label="Admin navigation" className={styles.nav}>
      {NAV_ITEMS.map(item => {
        const active = isActive(item.matches, pathname)
        const className = active
          ? `${styles.navItem} ${styles.navItemActive}`
          : styles.navItem
        const Icon = item.Icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.5} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
