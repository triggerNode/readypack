// lib/documents/react-pdf-templates.tsx
// React-PDF templates for all 9 document types + combined pack cover.
// Visual spec: app/samples/page.tsx (the /samples page is the source of truth).
//
// eslint-disable jsx-a11y/alt-text — react-pdf's <Image> is a PDF primitive with
// no `alt` attribute; the jsx-a11y rule is a false positive here.
/* eslint-disable jsx-a11y/alt-text */

import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font, Svg, Path } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'

// Disable mid-word hyphenation. The built-in hyphenator breaks words across
// lines ("commu-nications") which reads badly in narrow table columns. Returning
// the whole word as a single chunk makes words wrap intact instead.
Font.registerHyphenationCallback((word) => [word])
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.accent,
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
    width: 84,
    height: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 7,
    textAlign: 'center',
    paddingTop: 9,
    borderRadius: 2,
    marginRight: 10,
  },
  runningHeaderClientImage: {
    height: 30,
    maxWidth: 100,
    objectFit: 'contain',
    marginRight: 10,
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
  // Procurement Q&A bank
  qaItem: {
    marginBottom: 14,
  },
  qaQuestion: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    lineHeight: 1.4,
    marginBottom: 5,
  },
  qaAnswer: {
    fontSize: 9,
    lineHeight: 1.5,
    color: C.body,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusOkText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    marginLeft: 5,
  },
  statusWarnText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.amberBorder,
    marginLeft: 5,
  },
  // Do / Don't drawn-symbol rows
  symTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symTitleText: {
    marginLeft: 6,
  },
  symItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  symBullet: {
    width: 12,
    marginTop: 1.5,
  },
  doItemText: {
    flex: 1,
    fontSize: 8.5,
    color: C.greenText,
    lineHeight: 1.5,
  },
  dontItemText: {
    flex: 1,
    fontSize: 8.5,
    color: C.dontText,
    lineHeight: 1.5,
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
    width: 220,
    height: 78,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 10,
    textAlign: 'center',
    paddingTop: 32,
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
  // ── Flowing content page (pages 2+). Padding reserves the sacred header band
  // (top) and footer band (bottom); content flows between them and paginates
  // naturally, so the repeating header/footer are never overlapped. ──
  contentPage: {
    backgroundColor: C.white,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.body,
    paddingTop: 30,
    // The fixed Footer (footer row + AI-Act disclosure, pinned at bottom:18) can
    // reach ~60pt tall when the disclosure wraps; a 70pt reserve left only a
    // razor-thin gap, so a table row sitting at the page bottom could cross into
    // the footer band (the observed Privacy Notice bleed). 90pt keeps a
    // comfortable clearance so flowing content always breaks before the footer.
    // Purely a break-position change — no visual/style change to pages that fit.
    paddingBottom: 90,
    paddingHorizontal: 45,
  },
  // ── Per-document cover page ──
  coverDocPage: {
    backgroundColor: C.white,
    fontFamily: 'Helvetica',
    paddingHorizontal: 45,
    paddingTop: 78,
    paddingBottom: 70,
    flexGrow: 1,
  },
  coverDocLogo: {
    // Height-only: react-pdf sizes the width from the logo's own aspect ratio and
    // the box hugs the image, so it sits hard against the left margin. (The old
    // maxWidth:300 + objectFit:'contain' let a square logo float centred inside a
    // 300pt-wide box — the "awkward, not-quite-left" position.) maxWidth guards a
    // freak ultra-wide upload; alignSelf keeps the box left even if a parent ever
    // stretches it.
    height: 72,
    maxWidth: 300,
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  coverDocLogoPlaceholder: {
    width: 210,
    height: 66,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.muted,
    fontSize: 9,
    textAlign: 'center',
    paddingTop: 27,
    borderRadius: 4,
    marginBottom: 28,
  },
  coverDocEyebrow: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 8,
  },
  coverDocTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    marginBottom: 10,
    maxWidth: 460,
  },
  coverDocPrepared: {
    fontSize: 13,
    color: C.subtle,
  },
  coverDocSpacer: {
    flexGrow: 1,
  },
  // ── Combined footer block (footer row + disclosure as one fixed unit so they
  // can never overlap each other or the content). ──
  footerWrap: {
    position: 'absolute',
    bottom: 18,
    left: 45,
    right: 45,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    paddingTop: 8,
    fontSize: 8,
    color: C.muted,
  },
  footerDisclosure: {
    textAlign: 'center',
    fontSize: 6.5,
    color: C.muted,
    marginTop: 6,
    lineHeight: 1.3,
  },
  // ── Risk matrix top-row likelihood labels (stretch to align over the cells) ──
  riskMatrixCorner: {
    width: 70,
  },
  riskMatrixHeadCell: {
    flex: 1,
    marginLeft: 3,
    fontSize: 8,
    color: C.subtle,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 6,
    letterSpacing: 0.4,
  },
})

// ── Primitives ──

type RenderOpts = {
  showWatermark: boolean
  logoUrl?: string
  companyName: string
}

// ── Drawn symbols ──
// The built-in Helvetica font has no ✓ / ✗ / ⚠ glyphs (they render as garbage),
// so we draw them as small vectors instead.
function Check({ color = C.accent, size = 9 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 13 L9 18 L20 5" stroke={color} strokeWidth={2.6} fill="none" />
    </Svg>
  )
}

function Cross({ color = C.dontHeading, size = 9 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5 L19 19" stroke={color} strokeWidth={2.6} fill="none" />
      <Path d="M19 5 L5 19" stroke={color} strokeWidth={2.6} fill="none" />
    </Svg>
  )
}

function WarnMark({ color = C.amberBorder, size = 9 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3 L22 20 L2 20 Z" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M12 9 L12 14.5" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M12 17 L12 17.6" stroke={color} strokeWidth={2.4} fill="none" />
    </Svg>
  )
}

// ── Page chrome ──
// Footer + AI-Act disclosure as ONE fixed block pinned to the bottom, so they
// can never overlap each other or the flowing content above them.
function Footer({ companyName }: { companyName: string }) {
  return (
    <View style={s.footerWrap} fixed>
      <View style={s.footerRow}>
        <Text>Confidential · Prepared for {companyName}</Text>
        <Text
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
      <Text style={s.footerDisclosure}>
        This document was securely generated utilizing the ReadyPack compliance
        orchestration framework under deterministic code-enforced guardrails.
      </Text>
    </View>
  )
}

// Slim header repeated on every content page (a true repeating header, so a
// continuation page never starts headerless at the top edge).
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

// Dedicated cover page: large client logo (confident ownership), big title.
function CoverPage({
  documentNumber,
  documentTitle,
  companyName,
  logoUrl,
  showWatermark,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
  logoUrl?: string
  showWatermark: boolean
}) {
  return (
    <Page size="A4" style={s.coverDocPage}>
      <View style={s.brandBar} fixed />
      {showWatermark && <Text style={s.watermark} fixed>DRAFT</Text>}
      {logoUrl ? (
        <Image src={logoUrl} style={s.coverDocLogo} />
      ) : (
        <Text style={s.coverDocLogoPlaceholder}>CLIENT LOGO</Text>
      )}
      <Text style={s.coverDocEyebrow}>DOCUMENT {documentNumber}</Text>
      <Text style={s.coverDocTitle}>{documentTitle}</Text>
      <Text style={s.coverDocPrepared}>Prepared for {companyName}</Text>
      <View style={s.coverRule} />
      <View style={s.coverMeta}>
        <Text style={s.coverMetaLine}>Version 1.0</Text>
        <Text style={s.coverMetaLine}>Prepared by ReadyPack Compliance Platform</Text>
        <Text style={s.coverConfidential}>CONFIDENTIAL</Text>
      </View>
      <View style={s.coverDocSpacer} />
      <Footer companyName={companyName} />
    </Page>
  )
}

// Single flowing content page: react-pdf paginates it naturally across as many
// physical pages as the content needs — no manual page splits, so no bleed, no
// ghost blank pages, and the header/footer repeat on every page.
function ContentPage({
  documentNumber,
  documentTitle,
  companyName,
  logoUrl,
  showWatermark,
  children,
}: {
  documentNumber: string
  documentTitle: string
  companyName: string
  logoUrl?: string
  showWatermark: boolean
  children: React.ReactNode
}) {
  return (
    <Page size="A4" style={s.contentPage}>
      <View style={s.brandBar} fixed />
      {showWatermark && <Text style={s.watermark} fixed>DRAFT</Text>}
      <View fixed>
        <RunningHeader
          documentNumber={documentNumber}
          documentTitle={documentTitle}
          companyName={companyName}
          logoUrl={logoUrl}
        />
      </View>
      {children}
      <Footer companyName={companyName} />
    </Page>
  )
}

// Wraps a document: cover page + one flowing content page.
function DocumentShell({
  docType,
  opts,
  children,
}: {
  docType: keyof typeof DOCUMENT_TYPE_NUMBERS
  opts: RenderOpts
  children: React.ReactNode
}) {
  const documentNumber = DOCUMENT_TYPE_NUMBERS[docType]
  const documentTitle = DOCUMENT_TYPE_TITLES[docType]
  return (
    <Document>
      <CoverPage
        documentNumber={documentNumber}
        documentTitle={documentTitle}
        companyName={opts.companyName}
        logoUrl={opts.logoUrl}
        showWatermark={opts.showWatermark}
      />
      <ContentPage
        documentNumber={documentNumber}
        documentTitle={documentTitle}
        companyName={opts.companyName}
        logoUrl={opts.logoUrl}
        showWatermark={opts.showWatermark}
      >
        {children}
      </ContentPage>
    </Document>
  )
}

// minPresenceAhead keeps a heading from being orphaned at the bottom of a page:
// react-pdf will only render the heading on the current page if at least this many
// points remain for the content that follows it; otherwise the heading breaks to
// the next page and travels WITH its section instead of sitting alone above a gap.
const H1_KEEP_WITH_NEXT = 150
const H2_KEEP_WITH_NEXT = 120

function H1({ number, children }: { number?: string; children: string }) {
  return (
    <Text style={s.sectionH1} minPresenceAhead={H1_KEEP_WITH_NEXT}>
      {number ? <Text style={s.sectionH1Num}>{number} </Text> : null}
      {children}
    </Text>
  )
}

function H2({ number, children }: { number?: string; children: string }) {
  return (
    <Text style={s.sectionH2} minPresenceAhead={H2_KEEP_WITH_NEXT}>
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
  colWidths,
}: {
  columns: string[]
  rows: (string | React.ReactNode)[][]
  // Optional relative column weights (e.g. [0.7, 2.3, 1.6]). Defaults to equal.
  // Lets text-heavy columns breathe instead of forcing every column equal-width
  // (which squashes long cells into a few words per line).
  colWidths?: number[]
}) {
  const colCount = columns.length
  const weights =
    colWidths && colWidths.length === colCount ? colWidths : columns.map(() => 1)
  const total = weights.reduce((a, b) => a + b, 0)
  const widthOf = (i: number) => `${(weights[i] / total) * 100}%`

  return (
    <View style={s.table}>
      <View style={s.tableHeaderRow}>
        {columns.map((col, i) => (
          <View
            key={i}
            style={[
              s.tableHeaderCell,
              { width: widthOf(i) },
              i === 0 ? s.tableHeaderCellFirst : {},
            ] as Style[]}
          >
            <Text>{col.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      {/* Rows are atomic (wrap={false}): a row that doesn't fit the remaining
          space moves WHOLE to the next page rather than tearing its cells across
          the break (which mis-aligned columns — e.g. a doc-index "01" stranded on
          one page while its title/owner landed on the next). Safe here because no
          PdfTable row approaches a full page in height (the long-form Q&A bank is
          rendered as text blocks, not a table). */}
      {rows.map((row, rIdx) => {
        const isLast = rIdx === rows.length - 1
        const isAlt = rIdx % 2 === 1
        return (
          <View
            key={rIdx}
            wrap={false}
            style={[
              s.tableRow,
              isAlt ? s.tableRowAlt : {},
              isLast ? s.tableRowLast : {},
            ] as Style[]}
          >
            {row.map((cell, cIdx) => (
              <View key={cIdx} style={[s.tableCell, { width: widthOf(cIdx) }] as Style[]}>
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
      {/* header row — likelihood labels stretch to sit centred over each cell */}
      <View style={s.riskMatrixRow}>
        <Text style={s.riskMatrixLabel}>SEVERITY</Text>
        <Text style={s.riskMatrixHeadCell}>LOW LIKELIHOOD</Text>
        <Text style={s.riskMatrixHeadCell}>MEDIUM</Text>
        <Text style={s.riskMatrixHeadCell}>HIGH LIKELIHOOD</Text>
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
        <View style={s.symTitleRow}>
          <Check size={12} />
          <Text style={[s.doTitle, s.symTitleText] as Style[]}>DO</Text>
        </View>
        {doItems.map((item, i) => (
          <View key={i} style={s.symItemRow}>
            <View style={s.symBullet}>
              <Check size={8} />
            </View>
            <Text style={s.doItemText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={s.dontCol}>
        <View style={s.symTitleRow}>
          <Cross size={12} />
          <Text style={[s.dontTitle, s.symTitleText] as Style[]}>DON&apos;T</Text>
        </View>
        {dontItems.map((item, i) => (
          <View key={i} style={s.symItemRow}>
            <View style={s.symBullet}>
              <Cross size={8} />
            </View>
            <Text style={s.dontItemText}>{item}</Text>
          </View>
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
    ['Quality Assurance', 'ReadyPack Compliance Assurance: multi-stage automated QA and risk review'],
    ['Classification', 'Confidential: Internal and Customer Use'],
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
        and verified through ReadyPack&apos;s multi-stage compliance assurance process. It
        does not constitute legal advice.
      </Text>
    </View>
  )
}

// ── Doc 01 — AI Use Statement ──
function renderAiUseStatement(c: AiUseStatementContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="ai_use_statement" opts={opts}>
      <H1 number="1.">Introduction and Scope</H1>
      <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
      {c.sections[0]?.blocks?.[1]?.text && <P>{c.sections[0].blocks[1].text}</P>}
      <H1 number="2.">Purpose of This Document</H1>
      <P>{c.sections[1]?.blocks?.[0]?.text || ''}</P>
      <NoticeBlock title="Regulatory Reference">
        {c.sections[1]?.blocks?.find((b) => b.type === 'notice')?.text ||
          'Article 50 of the EU AI Act requires providers and deployers of certain AI systems to inform natural persons that they are interacting with an AI system. This statement satisfies that obligation.'}
      </NoticeBlock>
      <H1 number="3.">AI Systems in Use</H1>
      <P>The following table sets out the AI systems used internally by the Company, their purpose, and the regulatory classification we have applied to each system following our internal risk assessment.</P>
      <PdfTable columns={c.ai_systems_table.columns} rows={c.ai_systems_table.rows} />
      <H1 number="4.">Systems Not in Use</H1>
      <P>{c.systems_not_in_use_text}</P>
      <H1 number="5.">Human Oversight</H1>
      <P>{c.human_oversight_text}</P>
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
    </DocumentShell>
  )
}

// ── Doc 02 — Privacy Notice Addendum ──
function renderPrivacyNotice(c: PrivacyNoticeContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="privacy_notice_addendum" opts={opts}>
      <H1 number="1.">About This Addendum</H1>
      <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
      <H1 number="2.">Controller Details</H1>
      <PdfTable columns={c.controller_details.columns} rows={c.controller_details.rows} />
      <H1 number="3.">Scope</H1>
      <P>{c.sections[2]?.blocks?.[0]?.text || c.sections[1]?.blocks?.[0]?.text || ''}</P>
      <H1 number="4.">AI-Specific Processing Activities</H1>
      <PdfTable columns={c.processing_activities_table.columns} rows={c.processing_activities_table.rows} />
      <WarningBlock title="No Solely-Automated Decisions">
        {c.no_automated_decisions_text}
      </WarningBlock>
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
    </DocumentShell>
  )
}

// ── Doc 03 — AI Risk Register ──
function renderRiskRegister(c: RiskRegisterContent, opts: RenderOpts) {
  // The register has a tiny ID column and four text-heavy columns; equal widths
  // starved the prose into 3-4 words a line. Weight the ID narrow, text wide.
  const registerColWidths =
    c.risk_register_table.columns.length === 5
      ? [0.6, 2.3, 1.7, 2.4, 1.5]
      : undefined

  return (
    <DocumentShell docType="ai_risk_register" opts={opts}>
      <H1 number="1.">Purpose</H1>
      <P>{c.sections[0]?.blocks?.[0]?.text || ''}</P>
      <H1 number="2.">Methodology</H1>
      <P>{c.methodology_text}</P>
      <H1 number="3.">Risk Matrix</H1>
      <RiskMatrix matrix={c.risk_matrix} />
      <H1 number="4.">Risk Register</H1>
      <PdfTable
        columns={c.risk_register_table.columns}
        rows={c.risk_register_table.rows}
        colWidths={registerColWidths}
      />
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
    </DocumentShell>
  )
}

// ── Doc 04 — DPIA-Lite ──
function renderDpiaLite(c: DpiaLiteContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="dpia_lite" opts={opts}>
      <H1 number="1.">Processing Under Assessment</H1>
      <P>{c.processing_description}</P>
      <H1 number="2.">Necessity and Proportionality</H1>
      <P>{c.necessity_proportionality}</P>
      <H1 number="3.">Risks to Individuals</H1>
      <PdfTable columns={c.risks_table.columns} rows={c.risks_table.rows} />
      <NoticeBlock title="ICO Reference">
        This template follows the structure recommended by the Information Commissioner&apos;s Office in its &ldquo;DPIA template for AI&rdquo; guidance. Where a higher-risk processing activity is identified, a full DPIA is completed in place of this Lite version.
      </NoticeBlock>
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
    </DocumentShell>
  )
}

// ── Doc 05 — Internal AI Use Policy ──
function renderInternalPolicy(c: InternalPolicyContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="internal_ai_use_policy" opts={opts}>
      <H1 number="1.">Purpose</H1>
      <P>{c.purpose_text}</P>
      <H1 number="2.">Scope</H1>
      <P>{c.scope_text}</P>
      <H1 number="3.">Roles</H1>
      <P>{c.roles_text}</P>
      <H1 number="4.">Acceptable Use</H1>
      <DoDontGrid doItems={c.do_items} dontItems={c.dont_items} />
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
    </DocumentShell>
  )
}

// ── Doc 06 — Customer Disclosure Snippets ──
function renderDisclosureSnippets(c: DisclosureSnippetsContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="customer_disclosure_snippets" opts={opts}>
      <H1 number="1.">How to Use This Document</H1>
      <P>{c.how_to_use_text}</P>
      <NoticeBlock title="When to disclose">
        Article 50 of the EU AI Act requires that natural persons be informed when they are interacting with an AI system unless this is obvious from the circumstances. The snippets below are calibrated for the Company&apos;s use cases and should not be edited without sign-off from the document owner.
      </NoticeBlock>
      <H1 number="2.">Snippet Index</H1>
      <PdfTable columns={c.snippet_index_table.columns} rows={c.snippet_index_table.rows} />
      <H1 number="3.">Public-Facing Snippets</H1>
      {c.public_snippets.map((sn, i) => (
        <SnippetCard key={i} label={sn.label} tag={sn.tag} body={sn.body} />
      ))}
      <H1 number="4.">Client-Facing Deliverable Snippets</H1>
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
    </DocumentShell>
  )
}

// ── Doc 07 — Vendor AI Register ──
function renderVendorRegister(c: VendorRegisterContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="vendor_ai_register" opts={opts}>
      <H1 number="1.">About This Register</H1>
      <P>{c.about_text}</P>
      <H1 number="2.">Maintenance</H1>
      <P>{c.maintenance_text}</P>
      <NoticeBlock title="Connected documents">
        Risk treatment for each vendor is recorded in the AI Risk Register (Document 03). Customer-facing disclosure about these tools is covered by the AI Use Statement (Document 01) and Customer Disclosure Snippets (Document 06).
      </NoticeBlock>
      <H1 number="3.">Vendor Register</H1>
      <PdfTable columns={c.vendor_table.columns} rows={c.vendor_table.rows} />
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
    </DocumentShell>
  )
}

// ── Doc 08 — Complaints Procedure ──
function renderComplaintsProcedure(c: ComplaintsProcedureContent, opts: RenderOpts) {
  return (
    <DocumentShell docType="complaints_procedure_pack" opts={opts}>
      <H1 number="1.">Purpose</H1>
      <P>{c.purpose_text}</P>
      <NoticeBlock title="DUAA Section 103">
        From 19 June 2026, organisations that process personal data must operate a documented complaints handling procedure and must acknowledge complaints promptly. The Information Commissioner&apos;s Office can investigate non-compliance.
      </NoticeBlock>
      <H1 number="2.">How to Complain</H1>
      <P>{c.how_to_complain_text}</P>
      <H1 number="3.">Process</H1>
      <Timeline steps={c.process_steps} />
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
    </DocumentShell>
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
        // Strip the model's ✓/⚠ characters (the built-in font can't render them)
        // and draw the mark as a vector instead.
        if (v.includes('✓')) {
          return (
            <View key={`ok-${rIdx}`} style={s.statusRow}>
              <Check size={8} />
              <Text style={s.statusOkText}>{v.replace(/✓/g, '').trim()}</Text>
            </View>
          )
        }
        if (v.includes('⚠')) {
          return (
            <View key={`warn-${rIdx}`} style={s.statusRow}>
              <WarnMark size={8} />
              <Text style={s.statusWarnText}>{v.replace(/⚠/g, '').trim()}</Text>
            </View>
          )
        }
        return cell
      }),
    )

  // Premium Q&A bank (ST2-5) — render only when present (non-premium memos omit it).
  const qaBank = Array.isArray(c.procurement_qa_bank) ? c.procurement_qa_bank : []
  const hasQaBank = qaBank.length > 0

  // The generation prompt seeds two contact rows with literal "[security email]" /
  // "[sales email]" placeholders the model often leaves verbatim. Fall back to the
  // data-protection contact (the one real email in the table) so a paid deliverable
  // never ships visible [bracketed] stubs. Sanitises existing content_json too.
  const fallbackContact =
    c.contacts_table.rows
      .map((r) => String(r[1] ?? ''))
      .find((v) => v.includes('@')) || 'Available on request'
  const sanitisedContactRows: (string | React.ReactNode)[][] = c.contacts_table.rows.map((row) =>
    row.map((cell) =>
      typeof cell === 'string' && /^\[.*\]$/.test(cell.trim()) ? fallbackContact : cell,
    ),
  )

  return (
    <DocumentShell docType="procurement_response_memo" opts={opts}>
      <H1 number="1.">Executive Summary</H1>
      <P>{c.executive_summary}</P>
      <H1 number="2.">Compliance Snapshot</H1>
      <PdfTable
        columns={c.compliance_snapshot_table.columns}
        rows={styledSnapshotRows}
        colWidths={
          c.compliance_snapshot_table.columns.length === 3 ? [1.7, 1.0, 1.9] : undefined
        }
      />
      <H1 number="3.">Documentation Index</H1>
      <P>The following documents are available on request from any enterprise customer and form the complete ReadyPack compliance documentation set for the Company.</P>
      <PdfTable columns={c.documentation_index_table.columns} rows={c.documentation_index_table.rows} />
      <NoticeBlock title="Bid use">
        This Memo is the recommended single attachment when a vendor questionnaire asks for a high-level AI &amp; data governance summary. Individual documents can be released under NDA where the customer requires the underlying detail.
      </NoticeBlock>
      <H1 number="4.">Points of Contact</H1>
      <PdfTable columns={c.contacts_table.columns} rows={sanitisedContactRows} />
      <H1 number="5.">Review Cycle</H1>
      <P>{c.review_cycle_text}</P>
      {hasQaBank && (
        <>
          <H1 number="6.">Enterprise Compliance Q&amp;A</H1>
          <P>
            Structured responses to the questions most frequently raised in enterprise
            vendor due-diligence and procurement questionnaires, tailored to{' '}
            {opts.companyName}&apos;s AI tools, vendors, jurisdictions, and data-handling
            controls.
          </P>
          {qaBank.map((qa, i) => (
            <View key={i} style={s.qaItem}>
              <Text style={s.qaQuestion}>
                Q{i + 1}. {qa.question}
              </Text>
              <Text style={s.qaAnswer}>{qa.answer}</Text>
            </View>
          ))}
        </>
      )}
      <DocumentControl
        documentTitle={DOCUMENT_TYPE_TITLES.procurement_response_memo}
        documentNumber={DOCUMENT_TYPE_NUMBERS.procurement_response_memo}
        companyName={opts.companyName}
        preparedDate={c.prepared_date}
        reviewDate={c.review_date}
      />
    </DocumentShell>
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
            <Image src={opts.logoUrl} style={{ maxWidth: 240, height: 84, objectFit: 'contain', marginBottom: 28 }} />
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
          <Text>ReadyPack is a service of MOFE Ltd (No. 16633320)</Text>
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
