import { ArrowRight } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

export function AnnouncementBar() {
  return (
    <div className={styles.ann} role="note" aria-label="What ReadyPack does">
      <span className={styles['ann-inner']}>
        <span className={styles['ann-dot']} aria-hidden="true" />
        <span>
          Clients are starting to ask suppliers{' '}
          <span className={styles['ann-strong']}>how they use AI</span>
        </span>
        <span className={styles['ann-sep']} aria-hidden="true">·</span>
        <span>Nine documents that answer them</span>
        <span className={styles['ann-sep']} aria-hidden="true">·</span>
        <a href="/#pricing">
          See pricing
          <ArrowRight width={13} height={13} strokeWidth={ICON_STROKE} />
        </a>
      </span>
    </div>
  )
}
