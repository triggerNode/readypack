import { ArrowRight } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

export function AnnouncementBar() {
  return (
    <div className={styles.ann} role="note" aria-label="Regulatory deadlines">
      <span className={styles['ann-inner']}>
        <span className={styles['ann-dot']} aria-hidden="true" />
        <span>
          EU AI Act enforcement begins{' '}
          <span className={styles['ann-strong']}>2 August 2026</span>
        </span>
        <span className={styles['ann-sep']} aria-hidden="true">·</span>
        <span>
          DUAA Section 103 takes effect{' '}
          <span className={styles['ann-strong']}>19 June 2026</span>
        </span>
        <span className={styles['ann-sep']} aria-hidden="true">·</span>
        <a href="#pricing">
          Get compliant
          <ArrowRight width={13} height={13} strokeWidth={ICON_STROKE} />
        </a>
      </span>
    </div>
  )
}
