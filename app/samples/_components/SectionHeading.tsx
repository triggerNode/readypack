import type { ReactNode } from 'react'
import styles from '../samples.module.css'

type Level = 1 | 2 | 3

type SectionHeadingProps = {
  level?: Level
  number?: string
  children: ReactNode
}

export function SectionHeading({ level = 1, number, children }: SectionHeadingProps) {
  if (level === 1) {
    return (
      <h2 className={styles['section-h1']}>
        {number && <span className={styles['section-num']}>{number}</span>}
        {children}
      </h2>
    )
  }
  if (level === 2) {
    return (
      <h3 className={styles['section-h2']}>
        {number && `${number} `}
        {children}
      </h3>
    )
  }
  return (
    <h4 className={styles['section-h3']}>
      {number && `${number} `}
      {children}
    </h4>
  )
}
