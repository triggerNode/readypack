'use client'

import { useEffect, useState } from 'react'
import { AlarmClock, Check, Star } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

const EU_AI_ACT_DATE_MS = new Date('2026-08-02T00:00:00Z').getTime()
const MS_PER_DAY = 1000 * 60 * 60 * 24

function computeDaysUntil() {
  return Math.max(0, Math.ceil((EU_AI_ACT_DATE_MS - Date.now()) / MS_PER_DAY))
}

export function PricingSection() {
  const [daysUntil, setDaysUntil] = useState<number | null>(null)

  useEffect(() => {
    setDaysUntil(computeDaysUntil())
  }, [])

  return (
    <section className={`${styles.section} ${styles['pricing-section']}`} id="pricing">
      <div className={styles['pricing-glow']} aria-hidden="true" />
      <div className={`${styles.container} ${styles['pricing-inner']}`}>
        <div className={styles['sec-head']}>
          <span className={styles.pill}>Pricing</span>
          <h2>Clear pricing. No recurring fees.</h2>
          <p>Pay once. Get compliant. No subscription required.</p>
        </div>

        <div className={styles['urgency-strip']}>
          <span className={styles['urgency-pill']}>
            <AlarmClock
              width={14}
              height={14}
              strokeWidth={ICON_STROKE}
              className={styles['urgency-icon']}
            />
            EU AI Act enforcement begins 2 August 2026 —{' '}
            <span suppressHydrationWarning>{daysUntil ?? '—'}</span> days from now
          </span>
        </div>

        <div className={styles['price-grid']}>
          {/* Tier 1: Solo */}
          <div className={styles['price-card']}>
            <div className={styles['price-tier']}>Solo</div>
            <div className={styles['price-amount']}>
              <span className={styles.num}>£249</span>
              <span className={styles.cad}>one-off</span>
            </div>
            <p className={styles['price-tagline']}>
              For individual practitioners and small teams getting their documentation
              baseline in place.
            </p>
            <div className={styles['price-divider']} />
            <ul className={styles['price-features']}>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                All nine compliance documents
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Tailored to your business from your questionnaire
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Delivered within 48 hours
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Email support
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                One revision round
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Human review
              </li>
            </ul>
            <div className={styles['price-cta']}>
              <a href="#pricing" className={`${styles.btn} ${styles['btn-secondary']}`}>
                Get Started
              </a>
            </div>
          </div>

          {/* Tier 2: Procurement-Ready (featured) */}
          <div className={`${styles['price-card']} ${styles.featured}`}>
            <span className={styles['price-badge']}>Most popular</span>
            <div className={`${styles['price-tier']} ${styles['featured-tier']}`}>
              Procurement-Ready
            </div>
            <div className={styles['price-amount']}>
              <span className={styles.num}>£499</span>
              <span className={styles.cad}>one-off</span>
            </div>
            <p className={styles['price-tagline']}>
              For businesses responding to enterprise procurement requirements or
              regulatory audit preparation.
            </p>
            <div className={styles['price-divider']} />
            <ul className={styles['price-features']}>
              <li className={styles.star}>
                <Star width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                <span>
                  <strong>Procurement Q&amp;A Bank</strong> — 40 pre-answered vendor
                  questionnaire responses, ready to copy into any enterprise RFP
                </span>
              </li>
              <li className={styles.star}>
                <Star width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                <span>
                  <strong>Deeper tailoring</strong> — additional intake questions specific
                  to your industry and AI use case
                </span>
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                All nine compliance documents
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Expert human review (senior reviewer sign-off)
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                48-hour SLA (guaranteed delivery or refund)
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Priority email support
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                One revision round
              </li>
            </ul>
            <div className={styles['price-cta']}>
              <a href="#pricing" className={`${styles.btn} ${styles['btn-primary']}`}>
                Get Procurement Ready
              </a>
            </div>
          </div>

          {/* Tier 3: Adviser Pack */}
          <div className={styles['price-card']}>
            <div className={styles['price-tier']}>Adviser Pack</div>
            <div className={styles['price-amount']}>
              <span className={styles.num}>£799</span>
              <span className={styles.cad}>per pack · up to 3 clients</span>
            </div>
            <p className={styles['price-tagline']}>
              For consultancies, agencies, and advisors delivering compliance
              documentation to their own clients.
            </p>
            <div className={styles['price-divider']} />
            <ul className={styles['price-features']}>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Three individually tailored compliance packs (one per client)
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Each pack tailored to that client&apos;s specific business
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Expert human review on each pack
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                48-hour SLA per pack
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                White-label delivery available
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                Priority support channel
              </li>
              <li>
                <Check width={16} height={16} strokeWidth={ICON_STROKE} className={styles.ico} />
                One revision round per pack
              </li>
            </ul>
            <div className={styles['price-cta']}>
              <a href="#pricing" className={`${styles.btn} ${styles['btn-secondary']}`}>
                Get Adviser Pack
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
