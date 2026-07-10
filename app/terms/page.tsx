import { FileText } from 'lucide-react'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { AnnouncementBar } from '@/components/layout/AnnouncementBar'
import { Article50Disclosure } from '@/components/layout/Article50Disclosure'
import styles from '../legal.module.css'

const ICON_STROKE = 1.5

export const metadata = {
  title: 'Terms of Service — ReadyPack',
}

export default function TermsPage() {
  return (
    <>
      <AnnouncementBar />
      <Article50Disclosure />
      <Nav />

      <main>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <span className={styles.badge}>Legal</span>
            <div>
              <span className={styles.iconWrap}>
                <FileText width={28} height={28} strokeWidth={ICON_STROKE} />
              </span>
            </div>
            <h1 className={styles.title}>Terms of Service</h1>
            <p className={styles.body}>
              Our terms of service are currently being finalised by our legal team and will be
              published before public launch. ReadyPack is operated by MOFE LTD (Company No.
              16633320). For questions about our terms, email{' '}
              <a className={styles.contact} href="mailto:hello@readypack.co.uk">
                hello@readypack.co.uk
              </a>
              .
            </p>
            <p className={styles.meta}>
              ReadyPack is a service of MOFE Ltd (No. 16633320)
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
