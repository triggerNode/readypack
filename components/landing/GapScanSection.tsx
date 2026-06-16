'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Globe } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

export function GapScanSection() {
  const router = useRouter()
  const [url, setUrl] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The gap scanner is not live yet — route interested visitors to pricing
    // so they can get the full pack today instead of a dead-end scan page.
    router.push('/#pricing')
  }

  return (
    <section className={styles['gapscan-wrap']} id="gap-scan">
      <div className={styles.container}>
        <div className={styles.gapscan}>
          <div className={styles['gapscan-eyebrow']}>Enter your business website URL</div>
          <h3>Find out where you stand — free</h3>
          <p className={styles['gapscan-body']}>
            Enter your website URL and we&apos;ll identify which compliance obligations
            currently apply to your business under GDPR, the EU AI Act, and DUAA.
          </p>
          <form className={styles['gapscan-input-wrap']} onSubmit={handleSubmit}>
            <span className={styles['gapscan-input-icon']} aria-hidden="true">
              <Globe width={20} height={20} strokeWidth={ICON_STROKE} />
            </span>
            <input
              className={styles['gapscan-input']}
              type="url"
              placeholder="https://yourcompany.com"
              required
              aria-label="Your website URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button className={styles['gapscan-submit']} type="submit">
              Coming Soon
              <ArrowRight width={16} height={16} strokeWidth={ICON_STROKE} />
            </button>
          </form>
          <div className={styles['gapscan-chips']}>
            <span className={styles['gapscan-chip']}>Takes under 2 minutes</span>
            <span className={styles['gapscan-chip']}>No account required</span>
            <span className={styles['gapscan-chip']}>Your data is not stored</span>
          </div>
        </div>
      </div>
    </section>
  )
}
