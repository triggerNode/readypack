import Link from 'next/link'
import styles from '@/app/landing.module.css'
import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { NavProgress } from '@/components/landing/NavProgress'

export function Nav() {
  return (
    <nav className={styles.nav}>
      <div className={`${styles.container} ${styles['nav-inner']}`}>
        <Link href="/" className={styles.logo} aria-label="ReadyPack">
          <ReadyPackLogo className={styles['logo-mark']} />
          <span className={styles['logo-word']}>ReadyPack</span>
        </Link>
        <div className={styles['nav-links']}>
          <a className={styles['nav-link']} href="/#how">How It Works</a>
          <a className={styles['nav-link']} href="/#documents">Documents</a>
          <a className={styles['nav-link']} href="/#pricing">Pricing</a>
          <a className={styles['nav-link']} href="/#faq">FAQ</a>
        </div>
        <div className={styles['nav-right']}>
          <a href="/#pricing" className={`${styles.btn} ${styles['btn-secondary']} ${styles['btn-sm']}`}>
            See Pricing
          </a>
          <a href="/#pricing" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-sm']}`}>
            Get Your Pack
          </a>
        </div>
      </div>
      <NavProgress />
    </nav>
  )
}
