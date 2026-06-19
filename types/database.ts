// types/database.ts
// Hand-written types matching the Supabase schema.
// Regenerate via `supabase gen types typescript` after running the migration
// if you want Supabase-generated types instead.

export type OrgType = 'platform' | 'direct' | 'partner' | 'client'
export type UserRole = 'customer' | 'admin' | 'partner'
export type AccountStatus = 'active' | 'suspended'
export type MemberRole = 'owner' | 'admin' | 'member' | 'readonly'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed'
export type DeliveryStatus =
  | 'pending' | 'generating' | 'qa_review' | 'escalated'
  | 'approved' | 'delivered' | 'failed'
export type IntakeCompletionStatus = 'not_started' | 'in_progress' | 'submitted'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type RiskFlagSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RiskFlagStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated'
export type AiInteractionDirection = 'internal' | 'customer_facing' | 'both'
export type DecisionMakingRole = 'none' | 'informing' | 'automated'
export type EuAiRiskClass = 'minimal' | 'limited' | 'high' | 'unacceptable'
export type ProcessorRole = 'processor' | 'controller' | 'joint_controller'
export type DpaStatus = 'signed' | 'requested' | 'not_in_place' | 'not_required'
export type DocumentType =
  | 'ai_use_statement'
  | 'privacy_notice_addendum'
  | 'ai_risk_register'
  | 'dpia_lite'
  | 'internal_ai_use_policy'
  | 'customer_disclosure_snippets'
  | 'vendor_ai_register'
  | 'complaints_procedure_pack'
  | 'procurement_response_memo'
export type QaStatus = 'pending' | 'passed' | 'flagged' | 'failed'
export type DocDeliveryStatus = 'pending' | 'approved' | 'delivered' | 'failed'

// ── Portal "Request More Info" remediation (ST2-4, migration 007) ──
export type InfoRequestStatus = 'open' | 'submitted' | 'resolved' | 'cancelled'

export interface InfoRequest {
  id: string
  order_id: string
  submission_id: string | null
  /** NULL = case-level (top-level banner); otherwise tied to one document card. */
  document_type: DocumentType | null
  prompt: string
  options: string[]
  answer_text: string | null
  answer_selections: string[]
  status: InfoRequestStatus
  created_by: string | null
  answered_at: string | null
  answered_by: string | null
  resolved_at: string | null
  resolved_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
export type QaRecommendation = 'approve' | 'request_more_info' | 'escalate' | 'specialist_route'
export type ReviewerType = 'system' | 'founder' | 'specialist'
export type ReviewDecision = 'approve' | 'request_more_info' | 'escalate' | 'reject'
export type PlanSelected = 'solo' | 'team' | 'adviser'
export type GenerationStatus = 'success' | 'failed' | 'retry'
export type AuditActionType =
  | 'login' | 'case_view' | 'generate_rerun' | 'approve_delivery'
  | 'delivery_resend' | 'escalation_set' | 'escalation_cleared'
  | 'intake_answer_view' | 'document_edit' | 'template_edit'
  | 'refund_issued' | 'data_deletion_requested' | 'data_export_requested'
  | 'settings_change'
  | 'request_more_info' | 'mark_flag_resolved' | 'override_decision'
  | 'customer_revision_requested' | 'customer_pack_approved'
export type EmailType = 'magic_link' | 'needs_more_info' | 'delivery' | 'escalation_notice' | 'welcome'
export type EmailDeliveryStatus = 'sent' | 'delivered' | 'bounced' | 'failed'
export type CaseStatus =
  | 'awaiting_payment'
  | 'intake_not_started'
  | 'intake_in_progress'
  | 'intake_submitted'
  | 'generation_queued'
  | 'generating'
  | 'generation_failed'
  | 'qa_running'
  | 'qa_passed'
  | 'escalated'
  | 'high_risk_escalation'
  | 'needs_more_info'
  | 'specialist_route'
  | 'ready_for_delivery'
  | 'delivered'
  | 'refunded'
  | 'cancelled'
  | 'qa_review'

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ContentBlockType = 'paragraph' | 'table' | 'list' | 'clause' | 'heading'
export type CoBrandType = 'none' | 'powered_by' | 'white_label'

export interface Organisation {
  id: string
  name: string
  type: OrgType
  credit_balance: number
  plan: string | null
  billing_email: string | null
  partner_display_name: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
  company_name: string | null
  trading_name: string | null
  role: UserRole
  account_status: AccountStatus
  created_at: string
  updated_at: string
}

export interface OrganisationMember {
  id: string
  org_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  billing_org_id: string
  client_org_id: string
  stripe_payment_id: string | null
  stripe_session_id: string | null
  plan_selected: PlanSelected
  amount_pence: number | null
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  created_at: string
  updated_at: string
}

export interface IntakeSubmission {
  id: string
  user_id: string
  order_id: string
  org_id: string
  completion_status: IntakeCompletionStatus
  last_saved: string | null
  section_completion: Record<string, boolean>
  raw_answers: Record<string, unknown>
  normalised_answers: Record<string, unknown>
  risk_level: RiskLevel | null
  created_at: string
  updated_at: string
}

export interface AiTool {
  id: string
  submission_id: string
  org_id: string
  tool_name: string
  vendor: string | null
  purpose: string | null
  internal_or_customer_facing: AiInteractionDirection | null
  data_involved: string[] | null
  ai_interaction_type: string | null
  decision_making_role: DecisionMakingRole | null
  jurisdiction: string[] | null
  risk_classification: EuAiRiskClass | null
  created_at: string
}

export interface Vendor {
  id: string
  submission_id: string
  org_id: string
  vendor_name: string
  product: string | null
  processor_controller_role: ProcessorRole | null
  jurisdiction: string | null
  data_categories: string[] | null
  dpa_status: DpaStatus | null
  transfer_mechanism: string | null
  training_data_reuse: boolean | null
  security_certifications: string[] | null
  created_at: string
}

export interface RiskFlag {
  id: string
  submission_id: string
  org_id: string
  severity: RiskFlagSeverity
  triggering_answer: string | null
  explanation: string
  required_action: string | null
  status: RiskFlagStatus
  created_at: string
}

export interface GeneratedDocument {
  id: string
  submission_id: string
  org_id: string
  document_type: DocumentType
  version_number: number
  generated_at: string | null
  qa_status: QaStatus
  delivery_status: DocDeliveryStatus
  file_url: string | null
  // Document generation architecture fields
  content_json: Record<string, unknown> | null  // structured AI output (pre-render)
  template_version: string | null
  renderer: 'react_pdf' | 'typst' | 'playwright' | null
  render_metadata: Record<string, unknown>
  page_count: number | null
  file_size_bytes: number | null
  created_at: string
}

export interface QaReport {
  id: string
  submission_id: string
  org_id: string
  completeness_score: number | null
  risk_score: number | null
  consistency_issues: unknown[]
  missing_info: unknown[]
  red_flags: unknown[]
  recommended_action: QaRecommendation | null
  human_escalation_required: boolean
  created_at: string
  updated_at: string
}

export interface ReviewNote {
  id: string
  qa_report_id: string
  reviewer_type: ReviewerType
  notes: string | null
  decision: ReviewDecision | null
  created_at: string
}

export interface ScanReport {
  id: string
  domain: string
  email: string | null
  scan_date: string
  findings: Record<string, unknown>
  pdf_url: string | null
  created_at: string
}

export interface GenerationEvent {
  id: string
  order_id: string
  document_type: string | null
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  cost_usd: number | null
  status: GenerationStatus
  error_message: string | null
  // Content reuse tracking
  content_reused: boolean
  reused_block_ids: string[] | null
  pattern_id: string | null
  created_at: string
}

export interface DocumentGenerationJob {
  id: string
  order_id: string
  submission_id: string
  org_id: string
  status: GenerationJobStatus
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  attempt_count: number
  created_at: string
}

export interface ContentBlock {
  id: string
  block_type: ContentBlockType
  document_type: DocumentType
  section_id: string
  heading: string | null
  content: string
  risk_levels: string[]
  conditions: Record<string, unknown>
  tags: string[]
  approved: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface BrandProfile {
  id: string
  org_id: string
  display_name: string | null
  logo_url: string | null
  accent_colour: string | null
  co_brand_type: CoBrandType
  created_at: string
  updated_at: string
}

export interface AuditEvent {
  id: string
  admin_user_id: string | null
  action_type: AuditActionType
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface CustomerCommunication {
  id: string
  order_id: string
  email_type: EmailType
  sent_at: string | null
  resend_id: string | null
  delivery_status: EmailDeliveryStatus | null
  created_at: string
}

export type CaseRevisionStatus =
  | 'submitted'
  | 'in_review'
  | 'completed'
  | 'approved'
  | 'cancelled'
export type CaseRevisionKind = 'revision' | 'approval'

export interface CaseRevision {
  id: string
  order_id: string
  submission_id: string | null
  user_id: string | null
  document_types: DocumentType[]
  feedback_text: string | null
  status: CaseRevisionStatus
  kind: CaseRevisionKind
  resolved_at: string | null
  resolved_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Computed view — used in admin cases queue
export interface Case {
  order_id: string
  user_id: string
  billing_org_id: string
  client_org_id: string
  plan_selected: PlanSelected
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  stripe_payment_id: string | null
  stripe_session_id: string | null
  order_created_at: string
  delivery_deadline: string
  hours_remaining: number
  customer_email: string
  company_name: string | null
  trading_name: string | null
  client_org_name: string
  billing_org_name: string
  submission_id: string | null
  intake_status: IntakeCompletionStatus | null
  risk_level: RiskLevel | null
  last_saved: string | null
  qa_report_id: string | null
  qa_recommendation: QaRecommendation | null
  human_escalation_required: boolean | null
  completeness_score: number | null
  risk_score: number | null
  generation_job_id: string | null
  generation_job_status: GenerationJobStatus | null
  case_status: CaseStatus
}
