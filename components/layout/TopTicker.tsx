'use client'

import { useState } from 'react'
import { ShieldCheck, Sparkles, X } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

/**
 * The one bar above the nav: the announcement line and our EU AI Act Article 50
 * disclosure, scrolling past like a news ticker.
 *
 * This replaced two stacked bars (AnnouncementBar + AiDisclosure). Two static
 * bars read as a wall of text and pulled attention off the hero; one moving bar
 * says the same thing in less vertical space and earns the glance instead of
 * demanding it.
 *
 * On the Article 50 wording: Article 50 is about telling people when they are
 * dealing with AI. An older version of this line said ReadyPack ran "within a
 * secure, AI-orchestrated compliance ecosystem under deterministic security
 * controls" — which sounds like a guarantee, describes nothing checkable, and
 * never actually disclosed that an AI drafts the documents. Same class of claim
 * as the "zero-egress" line removed on 2026-07-27, and the same rule applies: on
 * a compliance product, what we say about ourselves has to match what the code
 * does. The wording below is unchanged from that fix — only its container moved.
 *
 * The bar is dismissible, so it is worth noting it is not the only place the
 * disclosure lives. Checked at source: Terms § 02 "What ReadyPack is" says the
 * documents are drafted by an AI model and then quality-checked, and the
 * Privacy notice says it twice — in the summary list up top, and in § 05
 * "What goes to the AI model".
 */

/**
 * One pass of the ticker copy. The track holds two of these so the loop can
 * restart seamlessly at -50%; the second is hidden from screen readers so the
 * message is announced once, not twice.
 */
function TickerMessage({ isDuplicate = false }: { isDuplicate?: boolean }) {
  return (
    <div
      className={styles['ticker-message']}
      aria-hidden={isDuplicate ? 'true' : undefined}
    >
      <span className={styles['ticker-dot']} aria-hidden="true" />
      <span>
        Clients are starting to ask suppliers{' '}
        <span className={styles['ticker-pill']}>how they use AI</span>
      </span>
      <span className={styles['ticker-sep']} aria-hidden="true">·</span>
      <span>Nine documents that answer them</span>
      <span className={styles['ticker-sep']} aria-hidden="true">·</span>
      <span className={styles['ticker-badge']}>
        <ShieldCheck width={12} height={12} strokeWidth={ICON_STROKE} />
        Article 50
      </span>
      <span className={styles['ticker-icon']} aria-hidden="true">
        <Sparkles width={13} height={13} strokeWidth={ICON_STROKE} />
      </span>
      <span>
        Your documents are <strong>drafted by an AI model</strong> and checked by a
        person before delivery.
      </span>
      <span className={styles['ticker-tail']} aria-hidden="true">·</span>
    </div>
  )
}

export function TopTicker() {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <div
      className={styles.ticker}
      role="note"
      aria-label="What ReadyPack does, and EU AI Act Article 50 disclosure"
    >
      <div className={styles['ticker-viewport']}>
        <div className={styles['ticker-track']}>
          <TickerMessage />
          <TickerMessage isDuplicate />
        </div>
      </div>
      <button
        type="button"
        className={styles['ticker-close']}
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss this banner"
      >
        <X width={14} height={14} strokeWidth={ICON_STROKE} />
      </button>
    </div>
  )
}
