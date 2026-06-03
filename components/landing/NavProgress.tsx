'use client'

import { useEffect, useState } from 'react'
import styles from '@/app/landing.module.css'

export function NavProgress() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    function update() {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      const next = max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0
      setPct(next)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return <div className={styles['nav-progress']} style={{ width: `${pct}%` }} />
}
