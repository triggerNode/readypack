// lib/documents/content-schemas.ts
// Strict JSON schemas for each of the 9 document types.
// Claude's output MUST conform to these. The React-PDF templates consume them.

import type { DocumentContent, DocumentTable } from './renderer'
import type { DocumentType } from '@/types/database'

// ── Per-document content shapes ──

export interface AiUseStatementContent extends DocumentContent {
  document_type: 'ai_use_statement'
  ai_systems_table: DocumentTable
  systems_not_in_use_text: string
  human_oversight_text: string
  controls: {
    data_minimisation: string
    training_and_acceptable_use: string
    review_schedule: string
  }
}

export interface PrivacyNoticeContent extends DocumentContent {
  document_type: 'privacy_notice_addendum'
  controller_details: DocumentTable
  processing_activities_table: DocumentTable
  no_automated_decisions_text: string
  your_rights_text: string
  international_transfers_text: string
  complaints_text: string
}

export interface RiskRegisterContent extends DocumentContent {
  document_type: 'ai_risk_register'
  methodology_text: string
  risk_matrix: {
    low_low: string; low_med: string; low_high: string
    med_low: string; med_med: string; med_high: string
    high_low: string; high_med: string; high_high: string
  }
  risk_register_table: DocumentTable
  review_schedule_text: string
  escalation_text: string
}

export interface DpiaLiteContent extends DocumentContent {
  document_type: 'dpia_lite'
  processing_description: string
  necessity_proportionality: string
  risks_table: DocumentTable
  conclusion_text: string
  sign_off: {
    prepared_by_name: string
    prepared_by_role: string
    date: string
    next_review: string
  }
}

export interface InternalPolicyContent extends DocumentContent {
  document_type: 'internal_ai_use_policy'
  purpose_text: string
  scope_text: string
  roles_text: string
  do_items: string[]
  dont_items: string[]
  enforcement_text: string
  training_text: string
  sign_off: {
    approved_by_name: string
    approved_by_role: string
    effective_date: string
    review_cycle: string
  }
}

export interface DisclosureSnippetsContent extends DocumentContent {
  document_type: 'customer_disclosure_snippets'
  how_to_use_text: string
  snippet_index_table: DocumentTable
  public_snippets: Array<{
    label: string
    tag: string
    body: string
  }>
  client_snippets: Array<{
    label: string
    tag: string
    body: string
  }>
}

export interface VendorRegisterContent extends DocumentContent {
  document_type: 'vendor_ai_register'
  about_text: string
  maintenance_text: string
  vendor_table: DocumentTable
  decommissioning_text: string
  onboarding_text: string
}

export interface ComplaintsProcedureContent extends DocumentContent {
  document_type: 'complaints_procedure_pack'
  purpose_text: string
  how_to_complain_text: string
  process_steps: Array<{
    step_number: number
    day_range: string
    title: string
    description: string
  }>
  records_text: string
  confidentiality_text: string
  escalation_contacts_table: DocumentTable
}

export interface ProcurementMemoContent extends DocumentContent {
  document_type: 'procurement_response_memo'
  executive_summary: string
  compliance_snapshot_table: DocumentTable
  documentation_index_table: DocumentTable
  contacts_table: DocumentTable
  review_cycle_text: string
}

export type SpecificDocumentContent =
  | AiUseStatementContent
  | PrivacyNoticeContent
  | RiskRegisterContent
  | DpiaLiteContent
  | InternalPolicyContent
  | DisclosureSnippetsContent
  | VendorRegisterContent
  | ComplaintsProcedureContent
  | ProcurementMemoContent

export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
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

export const DOCUMENT_TYPE_TITLES: Record<DocumentType, string> = {
  ai_use_statement: 'AI Use Statement',
  privacy_notice_addendum: 'Privacy Notice Addendum',
  ai_risk_register: 'AI Risk Register',
  dpia_lite: 'DPIA-Lite Template',
  internal_ai_use_policy: 'Internal AI Use Policy',
  customer_disclosure_snippets: 'Customer Disclosure Snippets',
  vendor_ai_register: 'Vendor AI Register',
  complaints_procedure_pack: 'Complaints Procedure Pack',
  procurement_response_memo: 'Procurement Response Memo',
}

export const DOCUMENT_TYPE_NUMBERS: Record<DocumentType, string> = {
  ai_use_statement: '01',
  privacy_notice_addendum: '02',
  ai_risk_register: '03',
  dpia_lite: '04',
  internal_ai_use_policy: '05',
  customer_disclosure_snippets: '06',
  vendor_ai_register: '07',
  complaints_procedure_pack: '08',
  procurement_response_memo: '09',
}
