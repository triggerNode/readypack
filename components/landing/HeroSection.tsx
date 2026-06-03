import { ArrowRight, Play, Timer, ShieldCheck } from 'lucide-react'
import styles from '@/app/landing.module.css'

const ICON_STROKE = 1.5

function DocFanCard({
  variant,
  meta,
  title,
  lines,
}: {
  variant: 'c1' | 'c2' | 'c3'
  meta: string
  title: string
  lines: ReadonlyArray<'' | 'short' | 'med' | 'xshort'>
}) {
  return (
    <div className={`${styles['docfan-card']} ${styles[variant]}`}>
      <div className={styles['doc-bar']} />
      <div className={styles['doc-head']}>
        <div className={styles['doc-logo']}>
          <svg className={styles['doc-logo-mark']} viewBox="0 0 598 715" aria-hidden="true">
            <path
              fill="var(--accent-primary)"
              d="M226.876 525.752C249.639 540.361 272.168 554.678 294.477 569.267C298.321 571.781 301 571.745 304.729 569.336C333.023 551.059 361.413 532.902 389.808 514.751C417.771 496.875 445.730 478.993 473.812 461.270C477.537 458.919 479.081 456.421 479.100 452.271L479.561 351.712C479.553 349.740 479.548 347.885 481.852 346.795C493.588 341.245 505.309 335.671 517.053 330.136L520 476.598C520.011 479.813 518.189 481.443 515.589 483.062C490.003 498.987 464.395 514.886 438.915 530.948C400.407 555.222 361.996 579.621 323.543 603.965C317.037 608.084 310.398 612.045 304.073 616.375C300.857 618.576 298.572 618.506 295.240 616.377C253.872 589.940 212.476 563.535 170.902 537.359C143.671 520.214 116.287 503.256 88.640 486.661C81.612 482.442 78.970 478.074 79.000 470.220L79.252 78.783C79.255 72.131 79.284 72.103 86.385 72.102L331.130 72C336.188 71.992 338.045 73.305 337.856 77.925L337.727 102.238C337.671 108.873 337.550 108.945 330.325 108.945L128.052 108.917C120.185 108.916 120.185 108.918 120.186 115.969L120.085 450.196C120.077 455.682 121.626 459.127 126.879 462.286C160.694 482.622 193.476 504.285 226.876 525.752Z"
            />
          </svg>
          <span className={styles['doc-logo-text']}>ReadyPack</span>
        </div>
        <span className={styles['doc-meta']}>{meta}</span>
      </div>
      <div className={styles['doc-body']}>
        <div className={styles['doc-title']}>{title}</div>
        <div className={styles['doc-section-head']} />
        {lines.map((modifier, idx) => (
          <div
            key={idx}
            className={`${styles['doc-line']}${modifier ? ` ${styles[modifier]}` : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles['hero-glow']} />
      <div className={styles['hero-grid']} />
      <div className={styles['hero-vignette']} />
      <div className={styles['hero-noise']} />

      <div className={`${styles.container} ${styles['hero-inner']}`}>
        <span className={styles['hero-newpill']}>
          <span className={styles.tag}>New</span>
          <span>Free Gap Scan now live</span>
          <span className={styles.pip} aria-hidden="true" />
        </span>
        <h1>
          Compliance-ready in <span className={styles.grad}>48 hours</span>
          <br />
          <span className={styles.muted}>— not 48 days.</span>
        </h1>
        <p className={styles['hero-sub']}>
          Nine documents that UK GDPR, the EU AI Act and DUAA require. AI-generated,
          expert-reviewed, delivered for £499. Built for SMEs facing the 2026 deadlines.
        </p>
        <div className={styles['hero-ctas']}>
          <a
            href="#pricing"
            className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
          >
            Get Your Pack <ArrowRight width={16} height={16} strokeWidth={ICON_STROKE} />
          </a>
          <a
            href="#gap-scan"
            className={`${styles.btn} ${styles['btn-secondary']} ${styles['btn-lg']}`}
          >
            <span className={styles['hero-cta-play']} aria-hidden="true">
              <Play width={12} height={12} strokeWidth={ICON_STROKE} />
            </span>
            Try Free Gap Scan
          </a>
        </div>
        <div className={styles['hero-price']}>
          From <strong>£249</strong> · one-off payment · no subscription
        </div>
      </div>

      <div className={`${styles.container} ${styles['hero-mock']}`}>
        <div className={`${styles['hero-stat']} ${styles.s1}`}>
          <span className={styles.label}>Per pack</span>
          <span className={styles.value}>
            9 documents <span className={styles.badge}>REVIEWED</span>
          </span>
        </div>
        <div className={`${styles['hero-stat']} ${styles.s2}`}>
          <span className={styles.label}>Starting at</span>
          <span className={styles.value}>
            £249 <span className={styles.badge}>ONE-OFF</span>
          </span>
        </div>
        <div className={`${styles['hero-stat']} ${styles.s3}`}>
          <div className={styles['with-icon']}>
            <span className={styles.icon} aria-hidden="true">
              <Timer width={14} height={14} strokeWidth={ICON_STROKE} />
            </span>
            <span className={styles.stack}>
              <span className={styles.label}>Delivery</span>
              <span className={styles.value}>48 hours</span>
            </span>
          </div>
        </div>
        <div className={`${styles['hero-stat']} ${styles.s4}`}>
          <div className={styles['with-icon']}>
            <span className={styles.icon} aria-hidden="true">
              <ShieldCheck width={14} height={14} strokeWidth={ICON_STROKE} />
            </span>
            <span className={styles.stack}>
              <span className={styles.label}>Reviewed by</span>
              <span className={styles.value}>Compliance counsel</span>
            </span>
          </div>
        </div>

        <div className={styles.docfan}>
          <DocFanCard
            variant="c1"
            meta="AI ACT · ART. 50"
            title="AI Use Statement"
            lines={['', 'med', 'short', '', 'med', 'xshort']}
          />
          <DocFanCard
            variant="c2"
            meta="UK GDPR · ART. 13"
            title="Privacy Notice Addendum"
            lines={['', 'short', 'med', '', 'xshort', 'med']}
          />
          <DocFanCard
            variant="c3"
            meta="AI ACT · ANNEX III"
            title="AI Risk Register"
            lines={['med', '', 'short', 'med', 'xshort', '']}
          />
        </div>
      </div>
    </section>
  )
}
