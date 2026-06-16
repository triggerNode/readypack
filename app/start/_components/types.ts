// Types for the intake questionnaire. raw_answers is stored on
// intake_submissions.raw_answers as a JSONB keyed by section number ("1"–"10").

export type RawAnswers = Partial<{
  '1': Section1Answers
  '2': Section2Answers
  '3': Section3Answers
  '4': Section4Answers
  '5': Section5Answers
  '6': Section6Answers
  '7': Section7Answers
  '8': Section8Answers
  '9': Section9Answers
  '10': Section10Answers
}>

export type SectionCompletion = Partial<Record<
  '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10',
  { completed: boolean; completed_at: string } | boolean
>>

export interface Section1Answers {
  company_name?: string
  trading_name?: string
  company_number?: string
  sector?: string
  sector_other?: string
  employee_count?: string
  logo_url?: string
  logo_filename?: string
}

export interface Section2Answers {
  customer_geography?: string
  eu_customer_proportion?: string
  customer_type?: string
  customer_sectors?: string[]
}

export interface ToolDetail {
  selected: boolean
  purposes?: string[]
  purpose_other?: string
  customer_facing?: 'Yes' | 'No' | 'Sometimes'
}

export interface Section3Answers {
  no_ai_tools?: boolean
  tools?: Record<string, ToolDetail>
  custom_tools?: string[]
}

export interface Section4Answers {
  ai_decision_making?: 'Yes' | 'Partly' | 'No'
  ai_decision_categories?: string[]
  ai_decision_categories_other?: string
  ai_customer_facing?: 'Yes' | 'No'
  ai_customer_channels?: string[]
  ai_customer_channels_other?: string
  ai_children_data?: 'Yes' | 'No' | 'Possibly / not sure'
}

export interface Section5Answers {
  current_ai_disclosure?: string
  current_disclosure_wording?: string
  ai_opt_out_mechanism?: string
  ai_opt_out_method?: string
}

export interface VendorDetail {
  vendor_name: string
  hq_location?: string
  hq_location_other?: string
  dpa_signed?: string
  transfer_mechanism?: string
  training_reuse?: string
  certifications?: string[]
}

export interface Section6Answers {
  data_categories?: string[]
  special_category_basis?: string
  special_category_basis_other?: string
  vendors?: VendorDetail[]
}

export interface Section7Answers {
  governance_owner?: string
  governance_contact?: { name?: string; job_title?: string; email?: string }
  has_ropa?: string
  has_dpia?: string
  has_ai_policy?: string
  certifications?: string[]
}

export interface Section8Answers {
  has_complaints_procedure?: string
  has_past_complaints?: string
  past_complaint_detail?: string
  ico_contact?: string
  ico_contact_type?: string
}

export interface Section9Answers {
  purchase_reason?: string
  purchase_reason_other?: string
  procurement_context?: { client_name?: string; deadline?: string }
  procurement_policy_owner?: { name?: string; job_title?: string }
  additional_context?: string
}

export interface Section10Answers {
  declaration_accepted?: boolean
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export const SECTION_NAMES: Record<number, string> = {
  1: 'Your business',
  2: 'Markets & customers',
  3: 'AI tools',
  4: 'How AI is used',
  5: 'AI & people',
  6: 'Data & vendors',
  7: 'Existing documents',
  8: 'Complaints & incidents',
  9: 'Procurement',
  10: 'Review & submit',
}

export const PREPOPULATED_TOOLS: { name: string; category: string }[] = [
  { name: 'ChatGPT / OpenAI', category: 'Writing & content' },
  { name: 'Microsoft Copilot / Azure OpenAI', category: 'Productivity assistant' },
  { name: 'Google Gemini / Bard', category: 'Writing & content' },
  { name: 'Claude / Anthropic', category: 'Writing & content' },
  { name: 'GitHub Copilot', category: 'Code assistant' },
  { name: 'Notion AI', category: 'Productivity assistant' },
  { name: 'Grammarly Business', category: 'Writing & content' },
  { name: 'HubSpot AI Tools', category: 'CRM / sales' },
  { name: 'Salesforce Einstein AI', category: 'CRM / sales' },
  { name: 'Jasper / Copy.ai', category: 'Writing & content' },
  { name: 'Midjourney / DALL·E / Adobe Firefly', category: 'Image generation' },
  { name: 'Zoom AI Companion', category: 'Meetings & comms' },
]

export const SPECIAL_CATEGORY_CHIPS = new Set([
  'Health or medical information',
  'Biometric data (e.g. face recognition, fingerprints)',
  'Ethnic or racial data',
  'Political or religious opinions',
  'Sexual orientation or gender identity',
  "Children's data",
])
