import type { ReactNode } from 'react'
import styles from '../samples.module.css'

type DocumentPageProps = {
  children: ReactNode
  documentNumber: string
  documentTitle: string
  companyName: string
  isFirstPage?: boolean
  pageNumber: number
  totalPages: number
  showWatermark?: boolean
}

export function DocumentPage({
  children,
  documentNumber,
  documentTitle,
  companyName,
  isFirstPage = false,
  pageNumber,
  totalPages,
  showWatermark = true,
}: DocumentPageProps) {
  return (
    <div className={styles['doc-page']}>
      <div className={styles['brand-bar']} />
      {showWatermark && <div className={styles.watermark}>DRAFT</div>}
      <div className={`${styles['page-padding']} ${styles['page-content']}`}>
        {isFirstPage ? (
          <CoverHeader
            documentNumber={documentNumber}
            documentTitle={documentTitle}
            companyName={companyName}
          />
        ) : (
          <RunningHeader
            documentNumber={documentNumber}
            documentTitle={documentTitle}
            companyName={companyName}
          />
        )}
        {children}
      </div>
      <div className={styles['page-footer']}>
        <span>Confidential — Prepared for {companyName}</span>
        <span>
          Page {pageNumber} of {totalPages}
        </span>
      </div>
    </div>
  )
}

function CoverHeader({
  documentNumber,
  documentTitle,
  companyName,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
}) {
  return (
    <header>
      <div className={styles['cover-eyebrow']}>Document {documentNumber}</div>
      <h1 className={styles['cover-title']}>{documentTitle}</h1>
      <p className={styles['cover-prepared']}>Prepared for {companyName}</p>
      <div className={styles['cover-rule']} />
      <div className={styles['cover-meta-row']}>
        <div className={styles['cover-meta']}>
          <span className={styles['cover-meta-line']}>Version 1.0 · 7 Jun 2026</span>
          <span className={styles['cover-meta-line']}>
            Owner: Mark Whitfield, Founder
          </span>
          <span className={styles['cover-confidential']}>Confidential</span>
        </div>
        <div className={styles['client-logo']}>CLIENT LOGO</div>
      </div>
    </header>
  )
}

function RunningHeader({
  documentNumber,
  documentTitle,
  companyName,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
}) {
  return (
    <div className={styles['running-header']}>
      <div className={styles['running-header-left']}>
        <div className={styles['client-logo-sm']}>CLIENT</div>
        <div>
          <div className={styles['running-header-title']}>{companyName}</div>
          <div className={styles['running-header-doc']}>
            Document {documentNumber} · {documentTitle}
          </div>
        </div>
      </div>
      <div className={styles['running-header-right']}>v1.0 · 7 Jun 2026</div>
    </div>
  )
}
