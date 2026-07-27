import type { ReactNode } from 'react'
import styles from '@/app/legal.module.css'

export interface TocItem {
  id: string
  label: string
}

interface LegalDocProps {
  badge: string
  title: string
  standfirst: string
  effective: string
  updated: string
  toc: readonly TocItem[]
  children: ReactNode
}

/**
 * Shell for a long-form legal document: masthead, sticky contents rail and the
 * article column. Pages supply only their content, as <LegalSection> children.
 */
export function LegalDoc({
  badge,
  title,
  standfirst,
  effective,
  updated,
  toc,
  children,
}: LegalDocProps) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.masthead}>
          <span className={styles.badge}>{badge}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.standfirst}>{standfirst}</p>
          <div className={styles.dates}>
            <span>
              Effective <strong>{effective}</strong>
            </span>
            <span>
              Last updated <strong>{updated}</strong>
            </span>
          </div>
        </header>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="Contents">
            <p className={styles.tocTitle}>Contents</p>
            <ul className={styles.tocList}>
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <article className={styles.article}>{children}</article>
        </div>
      </div>
    </div>
  )
}

interface LegalSectionProps {
  id: string
  num: string
  title: string
  children: ReactNode
}

export function LegalSection({ id, num, title, children }: LegalSectionProps) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.h2}>
        <span className={styles.num} aria-hidden="true">
          {num}
        </span>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  )
}

interface ShortVersionProps {
  children: ReactNode
  note?: ReactNode
}

/** Plain-English summary panel. Never the operative text — always a signpost. */
export function ShortVersion({ children, note }: ShortVersionProps) {
  return (
    <div className={styles.summary}>
      <p className={styles.summaryTitle}>The short version</p>
      <ul>{children}</ul>
      {note ? <p className={styles.summaryNote}>{note}</p> : null}
    </div>
  )
}

interface CalloutProps {
  children: ReactNode
  tone?: 'accent' | 'warn'
}

export function Callout({ children, tone = 'accent' }: CalloutProps) {
  const className =
    tone === 'warn' ? `${styles.callout} ${styles.calloutWarn}` : styles.callout
  return <div className={className}>{children}</div>
}

export function DefRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.defRow}>
      <div className={styles.defTerm}>{term}</div>
      <div className={styles.defBody}>{children}</div>
    </div>
  )
}

export function Defs({ children }: { children: ReactNode }) {
  return <div className={styles.defs}>{children}</div>
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>{children}</table>
    </div>
  )
}

/** Jurisdiction chip used in the sub-processor table. */
export function Region({ where }: { where: 'uk' | 'eu' | 'us' }) {
  const label = where === 'uk' ? 'United Kingdom' : where === 'eu' ? 'Ireland (EU)' : 'United States'
  const tone =
    where === 'us' ? styles.regionUs : where === 'uk' || where === 'eu' ? styles.regionUk : ''
  return <span className={`${styles.region} ${tone}`}>{label}</span>
}
