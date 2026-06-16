import { Lock, ShieldCheck } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

export function Article50Disclosure() {
  return (
    <div
      className={styles.disclosure}
      role="note"
      aria-label="EU AI Act Article 50 disclosure"
    >
      <div className={`${styles.container} ${styles['disclosure-inner']}`}>
        <span className={styles['disclosure-badge']}>
          <ShieldCheck width={12} height={12} strokeWidth={ICON_STROKE} />
          Article 50
        </span>
        <span className={styles['disclosure-icon']} aria-hidden="true">
          <Lock width={13} height={13} strokeWidth={ICON_STROKE} />
        </span>
        <span>
          ReadyPack runs within a secure, AI-orchestrated compliance ecosystem under{' '}
          <strong>deterministic security controls</strong>.
        </span>
      </div>
    </div>
  )
}
