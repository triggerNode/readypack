import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import styles from '../samples.module.css'

type NoticeBlockProps = {
  title?: string
  children: ReactNode
}

export function NoticeBlock({ title, children }: NoticeBlockProps) {
  return (
    <div className={styles['notice-block']}>
      <Info width={16} height={16} strokeWidth={2} className={styles['notice-block-icon']} />
      <div className={styles['notice-block-body']}>
        {title && <div className={styles['notice-block-title']}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}
