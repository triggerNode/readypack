import { ShieldCheck, Sparkles } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

/**
 * Our own EU AI Act Article 50 disclosure.
 *
 * Article 50 is about telling people when they are dealing with AI. The version
 * this replaced said ReadyPack ran "within a secure, AI-orchestrated compliance
 * ecosystem under deterministic security controls" — which sounds like a
 * guarantee, describes nothing checkable, and never actually disclosed that an
 * AI drafts the documents. Same class of claim as the "zero-egress" line removed
 * on 2026-07-27, and the same rule applies: on a compliance product, what we say
 * about ourselves has to match what the code does.
 *
 * Markup and styling are unchanged from Article50Disclosure; only the wording.
 */
export function AiDisclosure() {
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
          <Sparkles width={13} height={13} strokeWidth={ICON_STROKE} />
        </span>
        <span>
          Your documents are <strong>drafted by an AI model</strong> and checked by a
          person before delivery.
        </span>
      </div>
    </div>
  )
}
