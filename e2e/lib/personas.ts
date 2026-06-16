// The 10 friends — test customers, each designed to land on a specific risk
// level so we can confirm the system routes and gates each one correctly.
//
// Risk rules (from app/api/intake/submit/route.ts > scoreRisk):
//   high flag   = ai_decision_making Yes/Partly | Annex III category | special data
//   medium flag = customer-facing AI + no disclosure | EU>25% + customer-facing
//                 | non-UK/EEA vendor without DPA
//   critical    = >=2 high flags AND an Annex III hit AND (special OR children's data)
//   level       = critical | high(>=1 high) | medium(>=2 medium) | low
//   auto-gen    = low/medium only; high/critical are HELD for admin review.

export type Tier = 'solo' | 'procurement_ready' | 'adviser'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Persona {
  key: string
  company: string
  blurb: string
  tier: Tier
  expectedRisk: RiskLevel
  expectAutoGen: boolean
  answers: Record<string, Record<string, unknown>>
}

const declaration = { '10': { declaration_accepted: true } }

// Shared minimal section blocks reused across personas.
const gov = (owner = 'internal_owner') => ({
  governance_owner: owner,
  governance_contact: { name: 'Test Owner', job_title: 'Director', email: 'olutags@gmail.com' },
  has_ropa: 'No',
  has_dpia: 'No',
  has_ai_policy: 'No',
  certifications: ['None of these'],
})
const noComplaints = { has_complaints_procedure: 'No', has_past_complaints: 'No', ico_contact: 'No' }
const proactive = { purchase_reason: 'proactive', additional_context: 'Smoke-test persona.' }

export const PERSONAS: Persona[] = [
  {
    key: 'greenleaf',
    company: 'Greenleaf Digital',
    blurb: 'Marketing agency, ChatGPT internal only.',
    tier: 'solo',
    expectedRisk: 'low',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'Greenleaf Digital Ltd', sector: 'Marketing / advertising', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Technology'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Content creation / writing'], customer_facing: 'No' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'ChatGPT / OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'harbour',
    company: 'Harbour & Co',
    blurb: 'B2B SaaS chasing an enterprise tender; customer-facing AI, EU-heavy.',
    tier: 'procurement_ready',
    expectedRisk: 'medium',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'Harbour & Co Ltd', sector: 'Technology / SaaS', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2b', customer_sectors: ['Technology'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Customer support'], customer_facing: 'Yes' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'ChatGPT / OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'talentbridge',
    company: 'TalentBridge',
    blurb: 'Recruitment firm using AI to screen CVs — Annex III high risk.',
    tier: 'procurement_ready',
    expectedRisk: 'high',
    expectAutoGen: false,
    answers: {
      '1': { company_name: 'TalentBridge Recruitment Ltd', sector: 'Recruitment / HR', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': { no_ai_tools: false, tools: { 'Custom screening tool': { selected: true, purposes: ['Screening / shortlisting'], customer_facing: 'No' } }, custom_tools: [] },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Screening or ranking job applications'], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'vitalsigns',
    company: 'VitalSigns Health',
    blurb: 'Wellness app running AI on health data and access decisions — critical.',
    tier: 'procurement_ready',
    expectedRisk: 'critical',
    expectAutoGen: false,
    answers: {
      '1': { company_name: 'VitalSigns Health Ltd', sector: 'Health / wellness', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '25-50', customer_type: 'b2c', customer_sectors: ['Healthcare'] },
      '3': { no_ai_tools: false, tools: { 'Custom triage model': { selected: true, purposes: ['Risk assessment'], customer_facing: 'Yes' } }, custom_tools: [] },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Access to healthcare, benefits, or essential services'], ai_customer_facing: 'Yes', ai_customer_channels: ['In-app'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details', 'Health or medical information'], special_category_basis: 'Explicit consent', vendors: [] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'nimbuseu',
    company: 'NimbusEU',
    blurb: 'SaaS founder, EU customers, AI features in product (ActReady door).',
    tier: 'solo',
    expectedRisk: 'medium',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'NimbusEU GmbH', sector: 'Technology / SaaS', employee_count: '1-9' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2b', customer_sectors: ['Technology'] },
      '3': { no_ai_tools: false, tools: { 'Anthropic Claude': { selected: true, purposes: ['Product feature'], customer_facing: 'Yes' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['In-app'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'Anthropic', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'threeoaks',
    company: 'Three Oaks Agency',
    blurb: 'Agency buying a multi-client pack — Adviser tier.',
    tier: 'adviser',
    expectedRisk: 'low',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'Three Oaks Agency Ltd', sector: 'Marketing / advertising', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Retail'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Content creation / writing'], customer_facing: 'No' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'ChatGPT / OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'peak',
    company: 'Peak Bookkeeping',
    blurb: 'Tiny firm, barely uses AI, wants ICO peace of mind.',
    tier: 'solo',
    expectedRisk: 'low',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'Peak Bookkeeping Ltd', sector: 'Accounting / finance', employee_count: '1-9' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Internal productivity / admin'], customer_facing: 'No' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'eurohire',
    company: 'EuroHire',
    blurb: 'Recruitment firm with EU candidates — high risk and cross-border.',
    tier: 'procurement_ready',
    expectedRisk: 'high',
    expectAutoGen: false,
    answers: {
      '1': { company_name: 'EuroHire Ltd', sector: 'Recruitment / HR', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': { no_ai_tools: false, tools: { 'Custom screening tool': { selected: true, purposes: ['Screening / shortlisting'], customer_facing: 'Yes' } }, custom_tools: [] },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Screening or ranking job applications'], ai_customer_facing: 'Yes', ai_customer_channels: ['Website'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'No', transfer_mechanism: 'None', training_reuse: 'Yes', certifications: [] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'meridian',
    company: 'Meridian Legal',
    blurb: 'Has a privacy notice already, customer-facing AI, US vendor no DPA.',
    tier: 'solo',
    expectedRisk: 'medium',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'Meridian Legal Ltd', sector: 'Legal', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Customer support'], customer_facing: 'Yes' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [{ vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'No', transfer_mechanism: 'None', training_reuse: 'No', certifications: [] }] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
  {
    key: 'dropoff',
    company: 'DropOff Ltd',
    blurb: 'Low risk; used for the revision/approve + download path.',
    tier: 'solo',
    expectedRisk: 'low',
    expectAutoGen: true,
    answers: {
      '1': { company_name: 'DropOff Ltd', sector: 'Logistics', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Retail'] },
      '3': { no_ai_tools: false, tools: { 'ChatGPT / OpenAI': { selected: true, purposes: ['Internal productivity / admin'], customer_facing: 'No' } }, custom_tools: [] },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': { data_categories: ['Names and contact details'], vendors: [] },
      '7': gov(), '8': noComplaints, '9': proactive, ...declaration,
    },
  },
]
