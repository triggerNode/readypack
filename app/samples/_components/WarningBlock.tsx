import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from '../samples.module.css'

type WarningBlockProps = {
  title?: string
  children: ReactNode
}

export function WarningBlock({ title, children }: WarningBlockProps) {
  return (
    <div className={styles['warning-block']}>
      <AlertTriangle
        width={16}
        height={16}
        strokeWidth={2}
        className={styles['warning-block-icon']}
      />
      <div className={styles['warning-block-body']}>
        {title && <div className={styles['warning-block-title']}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  )
}
