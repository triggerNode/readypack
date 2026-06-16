'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from '../cases-list.module.css'

/**
 * Search input — keeps the URL search params as the source of truth.
 * Debounces user typing before pushing to the router so the server
 * component does not re-fetch on every keystroke.
 */
export function CasesSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params?.toString() ?? '')
      const trimmed = value.trim()
      if (trimmed.length === 0) {
        next.delete('q')
      } else {
        next.set('q', trimmed)
      }
      const qs = next.toString()
      router.replace(qs.length > 0 ? `/admin?${qs}` : '/admin')
    }, 250)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={styles.search}>
      <svg
        className={styles.icon}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search by company or email…"
        aria-label="Search cases"
        className={styles.searchInput}
      />
    </div>
  )
}
