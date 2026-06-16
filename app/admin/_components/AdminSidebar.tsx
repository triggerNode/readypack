import { ReadyPackLogo } from '@/components/ReadyPackLogo'
import { AdminSidebarNav } from './AdminSidebarNav'
import { AdminUserFooter } from './AdminUserFooter'
import styles from '../admin.module.css'

type Props = {
  email: string
}

export function AdminSidebar({ email }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <ReadyPackLogo />
        <span className={styles.logoWord}>ReadyPack</span>
      </div>

      <p className={styles.navLabel}>Admin</p>

      <AdminSidebarNav />

      <div className={styles.spacer} />

      <AdminUserFooter email={email} />
    </aside>
  )
}
