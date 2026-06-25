// lib/documents/doc-catalog.ts
//
// The canonical catalogue of the nine pack documents: their display order and
// presentational metadata (reference, title, icon, regulation, audience).
//
// Pure and dependency-free so it can be shared by the portal server component,
// the status/poll API route, the unified portal feed, and the client UI without
// dragging in any server-only code. This is the single source of the doc list —
// previously duplicated inline in app/portal/[id]/page.tsx.

import type { DocumentType } from '@/types/database'

export interface DocCatalogEntry {
  ref: string
  title: string
  icon: string
  reg: string
  audience: string
}

export const DOC_CATALOG: Record<DocumentType, DocCatalogEntry> = {
  ai_use_statement: {
    ref: 'RP-DOC-01',
    title: 'AI Use Statement',
    icon: 'file-text',
    reg: 'EU AI Act',
    audience: 'External',
  },
  privacy_notice_addendum: {
    ref: 'RP-DOC-02',
    title: 'Privacy Notice Addendum',
    icon: 'shield',
    reg: 'UK GDPR',
    audience: 'External',
  },
  ai_risk_register: {
    ref: 'RP-DOC-03',
    title: 'AI Risk Register',
    icon: 'triangle-alert',
    reg: 'EU AI Act',
    audience: 'Internal',
  },
  dpia_lite: {
    ref: 'RP-DOC-04',
    title: 'DPIA-Lite Assessment',
    icon: 'search',
    reg: 'UK GDPR',
    audience: 'Internal',
  },
  internal_ai_use_policy: {
    ref: 'RP-DOC-05',
    title: 'Internal AI Use Policy',
    icon: 'users',
    reg: 'UK GDPR / AI Act',
    audience: 'Staff',
  },
  customer_disclosure_snippets: {
    ref: 'RP-DOC-06',
    title: 'Customer Disclosure Snippets',
    icon: 'message-square',
    reg: 'EU AI Act',
    audience: 'Resource',
  },
  vendor_ai_register: {
    ref: 'RP-DOC-07',
    title: 'Vendor AI Register',
    icon: 'database',
    reg: 'UK GDPR',
    audience: 'Internal',
  },
  complaints_procedure_pack: {
    ref: 'RP-DOC-08',
    title: 'Complaints Procedure Pack',
    icon: 'scroll-text',
    reg: 'DUAA',
    audience: 'External',
  },
  procurement_response_memo: {
    ref: 'RP-DOC-09',
    title: 'Procurement Response Memo',
    icon: 'clipboard-check',
    reg: 'Procurement',
    audience: 'External',
  },
}

// Canonical pack order — the order the cards are displayed and the feed is built.
export const DOC_ORDER: DocumentType[] = [
  'ai_use_statement',
  'privacy_notice_addendum',
  'ai_risk_register',
  'dpia_lite',
  'internal_ai_use_policy',
  'customer_disclosure_snippets',
  'vendor_ai_register',
  'complaints_procedure_pack',
  'procurement_response_memo',
]

// Default page count shown on a card before its real page_count is known (the
// document hasn't been rendered yet). Matches the prior inline default.
export const DEFAULT_PAGE_COUNT = 4
