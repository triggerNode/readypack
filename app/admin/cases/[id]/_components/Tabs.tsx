'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import styles from '../case-detail.module.css'

type TabsContextValue = {
  active: string
  setActive: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <TabsRoot>`)
  }
  return ctx
}

type RootProps = {
  defaultValue: string
  children: ReactNode
}

function TabsRoot({ defaultValue, children }: RootProps) {
  const [active, setActive] = useState(defaultValue)
  const value = useMemo(() => ({ active, setActive }), [active])
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

function TabsList({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" className={styles.tabbar}>
      {children}
    </div>
  )
}

type TriggerProps = {
  value: string
  children: ReactNode
  badge?: ReactNode
}

function TabsTrigger({ value, children, badge }: TriggerProps) {
  const { active, setActive } = useTabsContext('TabsTrigger')
  const isActive = active === value
  const className = isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={className}
    >
      {children}
      {badge}
    </button>
  )
}

type PanelProps = {
  value: string
  children: ReactNode
}

function TabsPanel({ value, children }: PanelProps) {
  const { active } = useTabsContext('TabsPanel')
  if (active !== value) return null
  return (
    <div role="tabpanel" className={styles.panel}>
      {children}
    </div>
  )
}

export {
  TabsRoot as Root,
  TabsList as List,
  TabsTrigger as Trigger,
  TabsPanel as Panel,
}
