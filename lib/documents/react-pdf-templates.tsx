// lib/documents/react-pdf-templates.tsx
// React-PDF templates for all 9 document types + combined pack cover.
// Visual spec: app/samples/page.tsx (the /samples page is the source of truth).

import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type {
  SpecificDocumentContent,
  AiUseStatementContent,
  PrivacyNoticeContent,
  RiskRegisterContent,
  DpiaLiteContent,
  InternalPolicyContent,
  DisclosureSnippetsContent,
  VendorRegisterContent,
  ComplaintsProcedureContent,
  ProcurementMemoContent,
} from './content-schemas'
import { DOCUMENT_TYPE_NUMBERS, DOCUMENT_TYPE_TITLES } from './content-schemas'

// ── Palette ──
const C = {
  heading: '#1e293b',
  body: '#334155',
  muted: '#94a3b8',
  subtle: '#64748b',
  border: '#e2e8f0',
  surface: '#f8fafc',
  tableHead: '#f1f5f9',
  accent: '#16a34a',
  greenBg: '#f0fdf4',
  greenText: '#166534',
  amberBg: '#fffbeb',
  amberText: '#854d0e',
  amberBorder: '#ca8a04',
  riskLow: '#dcfce7',
  riskMed: '#fef3c7',
  riskHigh: '#fee2e2',
  dontBorder: '#fecaca',
  doBorder: '#bbf7d0',
  dontText: '#7f1d1d',
  dontHeading: '#991b1b',
  white: '#ffffff',
} as const

// ── Styles ──
const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.body,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  brandBar: {
    height: 3,
    backgroundColor: C.accent,
    width: '100%',
  },
  pagePadding: {
    paddingHorizontal: 45,
    paddingTop: 32,
    paddingBottom: 52,
    flexGrow: 1,
  },
  watermark: {
    position: 'absolute',
    top: 320,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 120,
    color: 'rgba(30,41,59,0.06)',
    fontFamily: 'Helvetica-Bold',
    transform: 'rotate(-35deg)',
  },
  // Cover header
  coverEyebrow: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 6,
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    marginBottom: 6,
  },
  coverPrepared: {
    fontSize: 11,
    color: C.subtle,
    marginBottom: 0,
  },
  coverRule: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 18,
  },
  coverMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  coverMeta: {
    flexDirection: 'column',
  },
  coverMetaLine: {
    fontSize: 9,
    color: C.subtle,
    marginBottom: 2,
  },
  coverConfidential: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 1,
    marginTop: 4,
  },
  clientLogo: {
    width: 100,
    height: 36,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 8,
    textAlign: 'center',
    paddingTop: 12,
    borderRadius: 3,
  },
  clientLogoImage: {
    width: 100,
    height: 36,
    objectFit: 'contain',
  },
  // Running header
  runningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
    marginBottom: 18,
  },
  runningHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runningHeaderClient: {
    width: 48,
    height: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 6,
    textAlign: 'center',
    paddingTop: 5,
    borderRadius: 2,
    marginRight: 8,
  },
  runningHeaderClientImage: {
    width: 48,
    height: 18,
    objectFit: 'contain',
    marginRight: 8,
  },
  runningHeaderTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  runningHeaderDoc: {
    fontSize: 8,
    color: C.muted,
    marginTop: 1,
  },
  runningHeaderRight: {
    fontSize: 8,
    color: C.muted,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    fontSize: 8,
    color: C.muted,
  },
  aiActDisclosure: {
    position: 'absolute',
    bottom: 8,
    left: 45,
    right: 45,
    textAlign: 'center',
    fontSize: 7,
    color: C.muted,
  },
  // Headings
  sectionH1: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    borderLeftStyle: 'solid',
    paddingLeft: 8,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionH1Num: {
    color: C.accent,
    fontFamily: 'Helvetica-Bold',
  },
  sectionH2: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    marginTop: 14,
    marginBottom: 5,
  },
  sectionH3: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.body,
    marginTop: 10,
    marginBottom: 4,
  },
  // Body
  bodyText: {
    fontSize: 9,
    lineHeight: 1.55,
    color: C.body,
    marginVertical: 5,
  },
  // Tables
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 4,
    marginVertical: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.tableHead,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableHeaderCell: {
    padding: 8,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  tableHeaderCellFirst: {
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    borderLeftStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: C.surface,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    padding: 8,
    fontSize: 8.5,
    color: C.body,
    lineHeight: 1.45,
  },
  // Notice block
  noticeBlock: {
    backgroundColor: C.greenBg,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    borderLeftStyle: 'solid',
    padding: 10,
    marginVertical: 10,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  noticeTitle: {
    fontFamily: 'Helvetica-Bold',
    color: C.greenText,
    fontSize: 9,
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 9,
    color: C.greenText,
    lineHeight: 1.5,
  },
  // Warning block
  warningBlock: {
    backgroundColor: C.amberBg,
    borderLeftWidth: 2,
    borderLeftColor: C.amberBorder,
    borderLeftStyle: 'solid',
    padding: 10,
    marginVertical: 10,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  warningTitle: {
    fontFamily: 'Helvetica-Bold',
    color: C.amberText,
    fontSize: 9,
    marginBottom: 2,
  },
  warningBody: {
    fontSize: 9,
    color: C.amberText,
    lineHeight: 1.5,
  },
  // Snippet card
  snippetCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 4,
    marginVertical: 9,
  },
  snippetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: C.tableHead,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  snippetLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.subtle,
    letterSpacing: 0.8,
  },
  snippetTag: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    backgroundColor: C.greenBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    letterSpacing: 0.5,
  },
  snippetBody: {
    backgroundColor: C.surface,
    padding: 10,
    fontFamily: 'Courier',
    fontSize: 8.5,
    lineHeight: 1.55,
    color: C.heading,
  },
  // Signature block
  sigBlock: {
    flexDirection: 'row',
    marginTop: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 4,
    backgroundColor: C.surface,
    gap: 18,
  },
  sigCol: {
    flex: 1,
    flexDirection: 'column',
  },
  sigLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  sigLine: {
    height: 1,
    backgroundColor: C.heading,
    marginTop: 18,
    marginBottom: 3,
  },
  sigName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    marginBottom: 1,
  },
  sigRole: {
    fontSize: 8,
    color: C.subtle,
  },
  // Risk matrix
  riskMatrix: {
    marginVertical: 10,
  },
  riskMatrixRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  riskMatrixLabel: {
    width: 70,
    fontSize: 8,
    color: C.subtle,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 6,
    letterSpacing: 0.4,
  },
  riskMatrixCell: {
    flex: 1,
    marginLeft: 3,
    padding: 12,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    textAlign: 'center',
    borderRadius: 3,
  },
  // Do / Don't grid
  doDontGrid: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  doCol: {
    flex: 1,
    backgroundColor: C.greenBg,
    borderWidth: 1,
    borderColor: C.doBorder,
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 12,
  },
  dontCol: {
    flex: 1,
    backgroundColor: C.riskHigh,
    borderWidth: 1,
    borderColor: C.dontBorder,
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 12,
  },
  doTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.greenText,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  dontTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.dontHeading,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  doItem: {
    fontSize: 8.5,
    color: C.greenText,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  dontItem: {
    fontSize: 8.5,
    color: C.dontText,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  // Timeline
  timeline: {
    marginVertical: 10,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    color: C.white,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 5,
    marginRight: 10,
  },
  timelineBody: {
    flex: 1,
  },
  timelineMeta: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  timelineTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    marginBottom: 2,
  },
  timelineText: {
    fontSize: 8.5,
    color: C.body,
    lineHeight: 1.45,
  },
  // Document control
  docControlTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.subtle,
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 6,
  },
  docControlTable: {
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'solid',
    borderRadius: 3,
    marginBottom: 8,
  },
  docControlRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  docControlRowLast: {
    borderBottomWidth: 0,
  },
  docControlLabel: {
    width: '38%',
    backgroundColor: C.surface,
    padding: 6,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.subtle,
    letterSpacing: 0.5,
  },
  docControlValue: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    color: C.body,
  },
  docControlNote: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Oblique',
    color: C.muted,
    lineHeight: 1.5,
    marginTop: 6,
  },
  // Status indicators (Doc 09)
  statusOk: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
  },
  statusWarn: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.amberBorder,
  },
  // Cover page
  coverPage: {
    backgroundColor: C.white,
    fontFamily: 'Helvetica',
    paddingHorizontal: 45,
    paddingVertical: 60,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPageBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.accent,
  },
  coverPackTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 10,
    maxWidth: 420,
  },
  coverPackSub: {
    fontSize: 13,
    color: C.subtle,
    textAlign: 'center',
    marginBottom: 28,
  },
  coverClientLogoBox: {
    width: 160,
    height: 56,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 10,
    textAlign: 'center',
    paddingTop: 22,
    borderRadius: 4,
    marginBottom: 28,
  },
  coverDivider: {
    width: 48,
    height: 2,
    backgroundColor: C.accent,
    marginVertical: 18,
  },
  coverMetaLineLarge: {
    fontSize: 10,
    color: C.subtle,
    textAlign: 'center',
    marginVertical: 2,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 32,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    fontSize: 8,
    color: C.muted,
  },
  coverPageLogo: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    letterSpacing: -0.5,
  },
})

// ── Primitives ──

type RenderOpts = {
  showWatermark: boolean
  logoUrl?: string
  companyName: string
}

type PageProps = {
  documentNumber: string
  documentTitle: string
  companyName: string
  isFirstPage?: boolean
  pageNumber: number
  totalPages: number
  showWatermark: boolean
  logoUrl?: string
  children: React.ReactNode
}

function PdfDocumentPage({
  documentNumber,
  documentTitle,
  companyName,
  isFirstPage = false,
  pageNumber,
  totalPages,
  showWatermark,
  logoUrl,
  children,
}: PageProps) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.brandBar} fixed />
      {showWatermark && <Text style={s.watermark} fixed>DRAFT</Text>}
      <View style={s.pagePadding}>
        {isFirstPage ? (
          <CoverHeader
            documentNumber={documentNumber}
            documentTitle={documentTitle}
            companyName={companyName}
            logoUrl={logoUrl}
          />
        ) : (
          <RunningHeader
            documentNumber={documentNumber}
            documentTitle={documentTitle}
            companyName={companyName}
            logoUrl={logoUrl}
          />
        )}
        {children}
      </View>
      <View style={s.footer} fixed>
        <Text>Confidential — Prepared for {companyName}</Text>
        <Text>
          Page {pageNumber} of {totalPages}
        </Text>
      </View>
      <Text style={s.aiActDisclosure} fixed>
        This document was securely generated utilizing the ReadyPack compliance
        orchestration framework under deterministic code-enforced guardrails.
      </Text>
    </Page>
  )
}

function CoverHeader({
  documentNumber,
  documentTitle,
  companyName,
  logoUrl,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
  logoUrl?: string
}) {
  return (
    <View>
      <Text style={s.coverEyebrow}>DOCUMENT {documentNumber}</Text>
      <Text style={s.coverTitle}>{documentTitle}</Text>
      <Text style={s.coverPrepared}>Prepared for {companyName}</Text>
      <View style={s.coverRule} />
      <View style={s.coverMetaRow}>
        <View style={s.coverMeta}>
          <Text style={s.coverMetaLine}>Version 1.0</Text>
          <Text style={s.coverMetaLine}>Prepared by ReadyPack Compliance Platform</Text>
          <Text style={s.coverConfidential}>CONFIDENTIAL</Text>
        </View>
        {logoUrl ? (
          <Image src={logoUrl} style={s.clientLogoImage} />
        ) : (
          <Text style={s.clientLogo}>CLIENT LOGO</Text>
        )}
      </View>
    </View>
  )
}

function RunningHeader({
  documentNumber,
  documentTitle,
  companyName,
  logoUrl,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
  logoUrl?: string
}) {
  return (
    <View style={s.runningHeader}>
      <View style={s.runningHeaderLeft}>
        {logoUrl ? (
          <Image src={logoUrl} style={s.runningHeaderClientImage} />
        ) : (
          <Text style={s.runningHeaderClient}>CLIENT</Text>
        )}
        <View>
          <Text style={s.runningHeaderTitle}>{companyName}</Text>
          <Text style={s.runningHeaderDoc}>
            Document {documentNumber} · {documentTitle}
          </Text>
        </View>
      </View>
      <Text style={s.runningHeaderRight}>v1.0</Text>
    </View>
  )
}

function H1({ number, children }: { number?: string; children: string }) {
  return (
    <Text style={s.sectionH1}>
      {number ? <Text style={s.sectionH1Num}>{number} </Text> : null}
      {children}
    </Text>
  )
}

function H2({ number, children }: { number?: string; children: string }) {
  return (
    <Text style={s.sectionH2}>
      {number ? <Text style={s.sectionH1Num}>{number} </Text> : null}
      {children}
    </Text>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.bodyText}>{children}</Text>
}

function PdfTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: (string | React.ReactNode)[][]
}) {
  const colCount = columns.length
  const colWidth = `${100 / colCount}%`

  return (
    <View style={s.table}>
      <View style={s.tableHeaderRow}>
        {columns.map((col, i) => (
          <View
            key={i}
            style={[
              s.tableHeaderCell,
              { width: colWidth },
              i === 0 ? s.tableHeaderCellFirst : {},
            ] as Style[]}
          >
            <Text>{col.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rIdx) => {
        const isLast = rIdx === rows.length - 1
        const isAlt = rIdx % 2 === 1
        return (
          <View
            key={rIdx}
            style={[
              s.tableRow,
              isAlt ? s.tableRowAlt : {},
              isLast ? s.tableRowLast : {},
            ] as Style[]}
            wrap={false}
          >
            {row.map((cell, cIdx) => (
              <View key={cIdx} style={[s.tableCell, { width: colWidth }] as Style[]}>
                {typeof cell === 'string' ? <Text>{cell}</Text> : cell}
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

function NoticeBlock({ title, children }: { title: string; children: string }) {
  return (
    <View style={s.noticeBlock} wrap={false}>
      <Text style={s.noticeTitle}>{title}</Text>
      <Text style={s.noticeBody}>{children}</Text>
    </View>
  )
}

function WarningBlock({ title, children }: { title: string; children: string }) {
  return (
    <View style={s.warningBlock} wrap={false}>
      <Text style={s.warningTitle}>{title}</Text>
      <Text style={s.warningBody}>{children}</Text>
    </View>
  )
}

function SnippetCard({
  label,
  tag,
  body,
}: {
  label: string
  tag: string
  body: string
}) {
  return (
    <View style={s.snippetCard} wrap={false}>
      <View style={s.snippetHead}>
        <Text style={s.snippetLabel}>{label.toUpperCase()}</Text>
        <Text style={s.snippetTag}>{tag.toUpperCase()}</Text>
      </View>
      <Text style={s.snippetBody}>{body}</Text>
    </View>
  )
}

function SignatureBlock({
  leftLabel,
  leftName,
  leftRole,
  rightLabel,
  rightDate,
  rightSubtext,
}: {
  leftLabel: string
  leftName: string
  leftRole: string
  rightLabel: string
  rightDate: string
  rightSubtext: string
}) {
  return (
    <View style={s.sigBlock} wrap={false}>
      <View style={s.sigCol}>
        <Text style={s.sigLabel}>{leftLabel.toUpperCase()}</Text>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{leftName}</Text>
        <Text style={s.sigRole}>{leftRole}</Text>
      </View>
      <View style={s.sigCol}>
        <Text style={s.sigLabel}>{rightLabel.toUpperCase()}</Text>
        <View style={s.sigLine} />
        <Text style={s.sigName}>{rightDate}</Text>
        <Text style={s.sigRole}>{rightSubtext}</Text>
      </View>
    </View>
  )
}

function RiskMatrix({
  matrix,
}: {
  matrix: RiskRegisterContent['risk_matrix']
}) {
  const bg = (level: string) => {
    const v = level.toLowerCase()
    if (v.includes('critical') || v.includes('high')) return C.riskHigh
    if (v.includes('medium') || v.includes('med')) return C.riskMed
    return C.riskLow
  }
  return (
    <View style={s.riskMatrix} wrap={false}>
      {/* header row */}
      <View style={s.riskMatrixRow}>
        <Text style={s.riskMatrixLabel}>SEVERITY ↑</Text>
        <Text style={s.riskMatrixLabel}>LOW LIKELIHOOD</Text>
        <Text style={s.riskMatrixLabel}>MEDIUM</Text>
        <Text style={s.riskMatrixLabel}>HIGH LIKELIHOOD</Text>
      </View>
      {/* High severity */}
      <View style={s.riskMatrixRow}>
        <Text style={s.riskMatrixLabel}>HIGH</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.high_low) }] as Style[]}>{matrix.high_low}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.high_med) }] as Style[]}>{matrix.high_med}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.high_high) }] as Style[]}>{matrix.high_high}</Text>
      </View>
      {/* Medium severity */}
      <View style={s.riskMatrixRow}>
        <Text style={s.riskMatrixLabel}>MEDIUM</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.med_low) }] as Style[]}>{matrix.med_low}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.med_med) }] as Style[]}>{matrix.med_med}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.med_high) }] as Style[]}>{matrix.med_high}</Text>
      </View>
      {/* Low severity */}
      <View style={s.riskMatrixRow}>
        <Text style={s.riskMatrixLabel}>LOW</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.low_low) }] as Style[]}>{matrix.low_low}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.low_med) }] as Style[]}>{matrix.low_med}</Text>
        <Text style={[s.riskMatrixCell, { backgroundColor: bg(matrix.low_high) }] as Style[]}>{matrix.low_high}</Text>
      </View>
    </View>
  )
}

function DoDontGrid({
  doItems,
  dontItems,
}: {
  doItems: string[]
  dontItems: string[]
}) {
  return (
    <View style={s.doDontGrid} wrap={false}>
      <View style={s.doCol}>
        <Text style={s.doTitle}>✓ DO</Text>
        {doItems.map((item, i) => (
          <Text key={i} style={s.doItem}>✓ {item}</Text>
        ))}
      </View>
      <View style={s.dontCol}>
        <Text style={s.dontTitle}>✗ DON&apos;T</Text>
        {dontItems.map((item, i) => (
          <Text key={i} style={s.dontItem}>✗ {item}</Text>
        ))}
      </View>
    </View>
  )
}

function Timeline({
  steps,
}: {
  steps: ComplaintsProcedureContent['process_steps']
}) {
  return (
    <View style={s.timeline}>
      {steps.map((step) => (
        <View key={step.step_number} style={s.timelineStep} wrap={false}>
          <Text style={s.timelineNum}>{step.step_number}</Text>
          <View style={s.timelineBody}>
            <Text style={s.timelineMeta}>{step.day_range.toUpperCase()}</Text>
            <Text style={s.timelineTitle}>{step.title}</Text>
            <Text style={s.timelineText}>{step.description}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function DocumentControl({
  documentTitle,
  documentNumber,
  companyName,
  preparedDate,
  reviewDate,
}: {
  documentTitle: string
  documentNumber: string
  companyName: string
  preparedDate: string
  reviewDate: string
}) {
  const rows: [string, string][] = [
    ['Document Title', `${documentTitle} (Document ${documentNumber})`],
    ['Prepared For', companyName],
    ['Document Owner', companyName],
    ['Version', '1.0'],
    ['Issue Date', preparedDate],
    ['Next Review Date', `${reviewDate} (or upon material change)`],
    ['Reviewed By', 'Olu Tayo, ReadyPack Compliance Reviewer'],
    ['Classification', 'Confidential — Internal & Customer Use'],
  ]
  return (
    <View wrap={false}>
      <Text style={s.docControlTitle}>DOCUMENT CONTROL</Text>
      <View style={s.docControlTable}>
        {rows.map(([label, value], i) => (
          <View
            key={i}
            style={[
              s.docControlRow,
              i === rows.length - 1 ? s.docControlRowLast : {},
            ] as Style[]}
          >
            <Text style={s.docControlLabel}>{label.toUpperCase()}</Text>
            <Text style={s.docControlValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={s.docControlNote}>
        This document was generated by ReadyPack&apos;s compliance documentation platform
        and reviewed by an experienced compliance professional. It does not constitute
        legal advice.
      </Text>
    </View>
  )
}

// ── Page wrapper helper ──
function makePage(
  opts: RenderOpts,
  docType: keyof typeof DOCUMENT_TYPE_NUMBERS,
  pageNumber: number,
  isFirstPage: boolean,
  children: React.ReactNode,
) {
  return (
    <PdfDocumentPage
      documentNumber={DOCUMENT_TYPE_NUMBERS[docType]}
      documentTitle={DOCUMENT_TYPE_TITLES[docType]}
      companyName={opts.companyName}
      isFirstPage={isFirstPage}
      pageNumber={pageNumber}
      totalPages={3}
      showWatermark={opts.showWatermark}
      logoUrl={opts.logoUrl}
    >
      {children}
    </PdfDocumentPage>
  )
}

// ── Doc 01 — AI Use Statement ──
function renderAiUseStatement(c: AiUseStatementContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'ai_use_statement', 1, true, (
        <>
          <H1 number="1.">Introduction and Scope</H1>
          <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
          {c.sections[0]?.blocks?.[1]?.text && <P>{c.sections[0].blocks[1].text}</P>}
          <H1 number="2.">Purpose of This Document</H1>
          <P>{c.sections[1]?.blocks?.[0]?.text || ''}</P>
          <NoticeBlock title="Regulatory Reference">
            {c.sections[1]?.blocks?.find((b) => b.type === 'notice')?.text ||
              'Article 50 of the EU AI Act requires providers and deployers of certain AI systems to inform natural persons that they are interacting with an AI system. This statement satisfies that obligation.'}
          </NoticeBlock>
        </>
      ))}
      {makePage(opts, 'ai_use_statement', 2, false, (
        <>
          <H1 number="3.">AI Systems in Use</H1>
          <P>The following table sets out the AI systems used internally by the Company, their purpose, and the regulatory classification we have applied to each system following our internal risk assessment.</P>
          <PdfTable columns={c.ai_systems_table.columns} rows={c.ai_systems_table.rows} />
          <H1 number="4.">Systems Not in Use</H1>
          <P>{c.systems_not_in_use_text}</P>
          <H1 number="5.">Human Oversight</H1>
          <P>{c.human_oversight_text}</P>
        </>
      ))}
      {makePage(opts, 'ai_use_statement', 3, false, (
        <>
          <H1 number="6.">Controls and Safeguards</H1>
          <H2 number="6.1">Data minimisation</H2>
          <P>{c.controls.data_minimisation}</P>
          <H2 number="6.2">Training and acceptable use</H2>
          <P>{c.controls.training_and_acceptable_use}</P>
          <H2 number="6.3">Review schedule</H2>
          <P>{c.controls.review_schedule}</P>
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.ai_use_statement}
            documentNumber={DOCUMENT_TYPE_NUMBERS.ai_use_statement}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 02 — Privacy Notice Addendum ──
function renderPrivacyNotice(c: PrivacyNoticeContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'privacy_notice_addendum', 1, true, (
        <>
          <H1 number="1.">About This Addendum</H1>
          <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
          <H1 number="2.">Controller Details</H1>
          <PdfTable columns={c.controller_details.columns} rows={c.controller_details.rows} />
          <H1 number="3.">Scope</H1>
          <P>{c.sections[2]?.blocks?.[0]?.text || c.sections[1]?.blocks?.[0]?.text || ''}</P>
        </>
      ))}
      {makePage(opts, 'privacy_notice_addendum', 2, false, (
        <>
          <H1 number="4.">AI-Specific Processing Activities</H1>
          <PdfTable columns={c.processing_activities_table.columns} rows={c.processing_activities_table.rows} />
          <WarningBlock title="No Solely-Automated Decisions">
            {c.no_automated_decisions_text}
          </WarningBlock>
        </>
      ))}
      {makePage(opts, 'privacy_notice_addendum', 3, false, (
        <>
          <H1 number="5.">Your Rights</H1>
          <P>{c.your_rights_text}</P>
          <H1 number="6.">International Transfers</H1>
          <P>{c.international_transfers_text}</P>
          <H1 number="7.">Complaints</H1>
          <P>{c.complaints_text}</P>
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.privacy_notice_addendum}
            documentNumber={DOCUMENT_TYPE_NUMBERS.privacy_notice_addendum}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 03 — AI Risk Register ──
function renderRiskRegister(c: RiskRegisterContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'ai_risk_register', 1, true, (
        <>
          <H1 number="1.">Purpose</H1>
          <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
          <H1 number="2.">Methodology</H1>
          <P>{c.methodology_text}</P>
          <H1 number="3.">Risk Matrix</H1>
          <RiskMatrix matrix={c.risk_matrix} />
        </>
      ))}
      {makePage(opts, 'ai_risk_register', 2, false, (
        <>
          <H1 number="4.">Risk Register</H1>
          <PdfTable columns={c.risk_register_table.columns} rows={c.risk_register_table.rows} />
        </>
      ))}
      {makePage(opts, 'ai_risk_register', 3, false, (
        <>
          <H1 number="5.">Review Schedule</H1>
          <P>{c.review_schedule_text}</P>
          <H1 number="6.">Escalation</H1>
          <P>{c.escalation_text}</P>
          <NoticeBlock title="Cross-references">
            Mitigations are operationalised through the Internal AI Use Policy (Document 05) and the Vendor AI Register (Document 07). High-impact processing activities are separately assessed through the DPIA-Lite Template (Document 04).
          </NoticeBlock>
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.ai_risk_register}
            documentNumber={DOCUMENT_TYPE_NUMBERS.ai_risk_register}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 04 — DPIA-Lite ──
function renderDpiaLite(c: DpiaLiteContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'dpia_lite', 1, true, (
        <>
          <H1 number="1.">Processing Under Assessment</H1>
          <P>{c.processing_description}</P>
          <H1 number="2.">Necessity and Proportionality</H1>
          <P>{c.necessity_proportionality}</P>
        </>
      ))}
      {makePage(opts, 'dpia_lite', 2, false, (
        <>
          <H1 number="3.">Risks to Individuals</H1>
          <PdfTable columns={c.risks_table.columns} rows={c.risks_table.rows} />
          <NoticeBlock title="ICO Reference">
            This template follows the structure recommended by the Information Commissioner&apos;s Office in its &ldquo;DPIA template for AI&rdquo; guidance. Where a higher-risk processing activity is identified, a full DPIA is completed in place of this Lite version.
          </NoticeBlock>
        </>
      ))}
      {makePage(opts, 'dpia_lite', 3, false, (
        <>
          <H1 number="4.">Conclusion</H1>
          <P>{c.conclusion_text}</P>
          <H1 number="5.">Sign-off</H1>
          <SignatureBlock
            leftLabel="Prepared by"
            leftName={c.sign_off.prepared_by_name}
            leftRole={`${c.sign_off.prepared_by_role} · ${opts.companyName}`}
            rightLabel="Date"
            rightDate={c.sign_off.date}
            rightSubtext={`Next review: ${c.sign_off.next_review}`}
          />
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.dpia_lite}
            documentNumber={DOCUMENT_TYPE_NUMBERS.dpia_lite}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 05 — Internal AI Use Policy ──
function renderInternalPolicy(c: InternalPolicyContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'internal_ai_use_policy', 1, true, (
        <>
          <H1 number="1.">Purpose</H1>
          <P>{c.purpose_text}</P>
          <H1 number="2.">Scope</H1>
          <P>{c.scope_text}</P>
          <H1 number="3.">Roles</H1>
          <P>{c.roles_text}</P>
        </>
      ))}
      {makePage(opts, 'internal_ai_use_policy', 2, false, (
        <>
          <H1 number="4.">Acceptable Use</H1>
          <DoDontGrid doItems={c.do_items} dontItems={c.dont_items} />
        </>
      ))}
      {makePage(opts, 'internal_ai_use_policy', 3, false, (
        <>
          <H1 number="5.">Enforcement</H1>
          <P>{c.enforcement_text}</P>
          <H1 number="6.">Training and Acknowledgement</H1>
          <P>{c.training_text}</P>
          <SignatureBlock
            leftLabel="Approved by"
            leftName={c.sign_off.approved_by_name}
            leftRole={`${c.sign_off.approved_by_role} · ${opts.companyName}`}
            rightLabel="Effective Date"
            rightDate={c.sign_off.effective_date}
            rightSubtext={c.sign_off.review_cycle}
          />
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.internal_ai_use_policy}
            documentNumber={DOCUMENT_TYPE_NUMBERS.internal_ai_use_policy}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 06 — Customer Disclosure Snippets ──
function renderDisclosureSnippets(c: DisclosureSnippetsContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'customer_disclosure_snippets', 1, true, (
        <>
          <H1 number="1.">How to Use This Document</H1>
          <P>{c.how_to_use_text}</P>
          <NoticeBlock title="When to disclose">
            Article 50 of the EU AI Act requires that natural persons be informed when they are interacting with an AI system unless this is obvious from the circumstances. The snippets below are calibrated for the Company&apos;s use cases and should not be edited without sign-off from the document owner.
          </NoticeBlock>
          <H1 number="2.">Snippet Index</H1>
          <PdfTable columns={c.snippet_index_table.columns} rows={c.snippet_index_table.rows} />
        </>
      ))}
      {makePage(opts, 'customer_disclosure_snippets', 2, false, (
        <>
          <H1 number="3.">Snippets — Public-Facing</H1>
          {c.public_snippets.map((sn, i) => (
            <SnippetCard key={i} label={sn.label} tag={sn.tag} body={sn.body} />
          ))}
        </>
      ))}
      {makePage(opts, 'customer_disclosure_snippets', 3, false, (
        <>
          <H1 number="4.">Snippets — Client-Facing Deliverables</H1>
          {c.client_snippets.map((sn, i) => (
            <SnippetCard key={i} label={sn.label} tag={sn.tag} body={sn.body} />
          ))}
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.customer_disclosure_snippets}
            documentNumber={DOCUMENT_TYPE_NUMBERS.customer_disclosure_snippets}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 07 — Vendor AI Register ──
function renderVendorRegister(c: VendorRegisterContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'vendor_ai_register', 1, true, (
        <>
          <H1 number="1.">About This Register</H1>
          <P>{c.about_text}</P>
          <H1 number="2.">Maintenance</H1>
          <P>{c.maintenance_text}</P>
          <NoticeBlock title="Connected documents">
            Risk treatment for each vendor is recorded in the AI Risk Register (Document 03). Customer-facing disclosure about these tools is covered by the AI Use Statement (Document 01) and Customer Disclosure Snippets (Document 06).
          </NoticeBlock>
        </>
      ))}
      {makePage(opts, 'vendor_ai_register', 2, false, (
        <>
          <H1 number="3.">Vendor Register</H1>
          <PdfTable columns={c.vendor_table.columns} rows={c.vendor_table.rows} />
        </>
      ))}
      {makePage(opts, 'vendor_ai_register', 3, false, (
        <>
          <H1 number="4.">Decommissioning</H1>
          <P>{c.decommissioning_text}</P>
          <H1 number="5.">Onboarding New Vendors</H1>
          <P>{c.onboarding_text}</P>
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.vendor_ai_register}
            documentNumber={DOCUMENT_TYPE_NUMBERS.vendor_ai_register}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 08 — Complaints Procedure ──
function renderComplaintsProcedure(c: ComplaintsProcedureContent, opts: RenderOpts) {
  return (
    <Document>
      {makePage(opts, 'complaints_procedure_pack', 1, true, (
        <>
          <H1 number="1.">Purpose</H1>
          <P>{c.purpose_text}</P>
          <NoticeBlock title="DUAA Section 103">
            From 19 June 2026, organisations that process personal data must operate a documented complaints handling procedure and must acknowledge complaints promptly. The Information Commissioner&apos;s Office can investigate non-compliance.
          </NoticeBlock>
          <H1 number="2.">How to Complain</H1>
          <P>{c.how_to_complain_text}</P>
        </>
      ))}
      {makePage(opts, 'complaints_procedure_pack', 2, false, (
        <>
          <H1 number="3.">Process</H1>
          <Timeline steps={c.process_steps} />
        </>
      ))}
      {makePage(opts, 'complaints_procedure_pack', 3, false, (
        <>
          <H1 number="4.">Records</H1>
          <P>{c.records_text}</P>
          <H1 number="5.">Confidentiality and Non-Retaliation</H1>
          <P>{c.confidentiality_text}</P>
          <H1 number="6.">Escalation Contacts</H1>
          <PdfTable columns={c.escalation_contacts_table.columns} rows={c.escalation_contacts_table.rows} />
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.complaints_procedure_pack}
            documentNumber={DOCUMENT_TYPE_NUMBERS.complaints_procedure_pack}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Doc 09 — Procurement Response Memo ──
function renderProcurementMemo(c: ProcurementMemoContent, opts: RenderOpts) {
  // The compliance snapshot table has status indicators — colour them.
  const styledSnapshotRows: (string | React.ReactNode)[][] =
    c.compliance_snapshot_table.rows.map((row, rIdx) =>
      row.map((cell, idx) => {
        if (idx !== 1) return cell
        const v = String(cell)
        if (v.includes('✓')) {
          return <Text key={`ok-${rIdx}`} style={s.statusOk}>{v}</Text>
        }
        if (v.includes('⚠')) {
          return <Text key={`warn-${rIdx}`} style={s.statusWarn}>{v}</Text>
        }
        return cell
      }),
    )

  return (
    <Document>
      {makePage(opts, 'procurement_response_memo', 1, true, (
        <>
          <H1 number="1.">Executive Summary</H1>
          <P>{c.executive_summary}</P>
          <H1 number="2.">Compliance Snapshot</H1>
          <PdfTable
            columns={c.compliance_snapshot_table.columns}
            rows={styledSnapshotRows}
          />
        </>
      ))}
      {makePage(opts, 'procurement_response_memo', 2, false, (
        <>
          <H1 number="3.">Documentation Index</H1>
          <P>The following documents are available on request from any enterprise customer and form the complete ReadyPack compliance documentation set for the Company.</P>
          <PdfTable columns={c.documentation_index_table.columns} rows={c.documentation_index_table.rows} />
          <NoticeBlock title="Bid use">
            This Memo is the recommended single attachment when a vendor questionnaire asks for a high-level AI &amp; data governance summary. Individual documents can be released under NDA where the customer requires the underlying detail.
          </NoticeBlock>
        </>
      ))}
      {makePage(opts, 'procurement_response_memo', 3, false, (
        <>
          <H1 number="4.">Points of Contact</H1>
          <PdfTable columns={c.contacts_table.columns} rows={c.contacts_table.rows} />
          <H1 number="5.">Review Cycle</H1>
          <P>{c.review_cycle_text}</P>
          <DocumentControl
            documentTitle={DOCUMENT_TYPE_TITLES.procurement_response_memo}
            documentNumber={DOCUMENT_TYPE_NUMBERS.procurement_response_memo}
            companyName={opts.companyName}
            preparedDate={c.prepared_date}
            reviewDate={c.review_date}
          />
        </>
      ))}
    </Document>
  )
}

// ── Dispatcher ──
export function renderDocumentPdf(
  content: SpecificDocumentContent,
  opts: RenderOpts,
): React.ReactElement {
  switch (content.document_type) {
    case 'ai_use_statement':
      return renderAiUseStatement(content, opts)
    case 'privacy_notice_addendum':
      return renderPrivacyNotice(content, opts)
    case 'ai_risk_register':
      return renderRiskRegister(content, opts)
    case 'dpia_lite':
      return renderDpiaLite(content, opts)
    case 'internal_ai_use_policy':
      return renderInternalPolicy(content, opts)
    case 'customer_disclosure_snippets':
      return renderDisclosureSnippets(content, opts)
    case 'vendor_ai_register':
      return renderVendorRegister(content, opts)
    case 'complaints_procedure_pack':
      return renderComplaintsProcedure(content, opts)
    case 'procurement_response_memo':
      return renderProcurementMemo(content, opts)
  }
}

// ── Combined Pack Cover ──
export function renderCombinedPackCover(opts: {
  companyName: string
  logoUrl?: string
  documentCount: number
  totalPages: number
  issueDate: string
}): React.ReactElement {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.coverPageBar} />
        <View style={s.coverPage}>
          <Text style={s.coverPageLogo}>ReadyPack</Text>
          <Text style={s.coverPackTitle}>
            AI &amp; Data Governance Compliance Documentation Pack
          </Text>
          <Text style={s.coverPackSub}>Prepared for {opts.companyName}</Text>
          {opts.logoUrl ? (
            <Image src={opts.logoUrl} style={{ width: 160, height: 56, objectFit: 'contain', marginBottom: 28 }} />
          ) : (
            <Text style={s.coverClientLogoBox}>CLIENT LOGO</Text>
          )}
          <View style={s.coverDivider} />
          <Text style={s.coverMetaLineLarge}>
            {opts.documentCount} Documents · {opts.totalPages} Pages · Version 1.0
          </Text>
          <Text style={s.coverMetaLineLarge}>Issued {opts.issueDate}</Text>
        </View>
        <View style={s.coverFooter} fixed>
          <Text>MOFE LTD · Registered in England &amp; Wales</Text>
          <Text>Confidential</Text>
        </View>
        <Text style={s.aiActDisclosure} fixed>
          This document was securely generated utilizing the ReadyPack compliance
          orchestration framework under deterministic code-enforced guardrails.
        </Text>
      </Page>
    </Document>
  )
}
