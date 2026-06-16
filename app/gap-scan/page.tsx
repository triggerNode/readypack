import { ArrowRight, Search } from 'lucide-react'
import styles from '../landing.module.css'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Article50Disclosure } from '@/components/layout/Article50Disclosure'

const ICON_STROKE = 1.5

export default function GapScanPage() {
  return (
    <>
      <AnnouncementBar />
      <Article50Disclosure />
      <Nav />

      <main>
        <section className={`${styles.section} ${styles['tinted-section']}`}>
          <div className={styles.container}>
            <div
              className={styles.card}
              style={{
                maxWidth: 560,
                margin: '0 auto',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                padding: 'var(--sp-12, 48px) var(--sp-8, 32px)',
              }}
            >
              <span className={styles['card-icon']}>
                <Search width={26} height={26} strokeWidth={ICON_STROKE} />
              </span>
              <h1 style={{ margin: 0 }}>Free Gap Scan — Coming Soon</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 440 }}>
                We&apos;re building an instant AI compliance gap scanner. In the meantime,
                get your full compliance pack today.
              </p>
              <a
                href="/#pricing"
                className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}
              >
                Get Your Pack
                <ArrowRight width={16} height={16} strokeWidth={ICON_STROKE} />
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
