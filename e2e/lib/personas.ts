// Smoke Test 2 — the 10 personas. Realistic, varied SMEs that would actually
// buy ReadyPack, each designed to land on a specific risk level and exercise a
// specific path (approve / revision / high-risk hold / critical / adviser).
//
// Risk rules (from app/api/intake/submit/route.ts > scoreRisk):
//   high flag   = ai_decision_making Yes/Partly | Annex III decision category | special-category data
//   medium flag = customer-facing AI + no disclosure | (uk_eu|uk_eu_row) & EU>=25% + customer-facing
//                 | non-UK/EEA vendor without DPA
//   critical    = >=2 high flags AND an Annex III hit AND (special-category data OR
//                 children's data via either the s6 chip or the s4 ai_children_data answer)
//   level       = critical | high(>=1 high flag) | medium(>=2 medium flags) | low
//   auto-gen    = low/medium only; high/critical are HELD for the admin "Generate Pack" button.
//
// NOTE on medium: a SINGLE medium flag still scores LOW — medium needs >=2.
// NOTE on children's data (ST2-3, resolved 2026-06-17): BOTH the s6 "Children's
//   data" chip AND the dedicated s4 ai_children_data='Yes' answer feed special-
//   category scoring. Brightpath answers ai_children_data='Yes' (edtech for
//   under-18s) and so now correctly lands CRITICAL.

export type Tier = 'solo' | 'procurement_ready' | 'adviser'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface GovernanceContact {
  name: string
  job_title: string
  email: string
}

export interface Persona {
  key: string
  company: string
  blurb: string
  tier: Tier
  /** Distinct test email so portals / magic links are separable (Gmail +addressing → all reach olutags@gmail.com). */
  email: string
  expectedRisk: RiskLevel
  expectAutoGen: boolean
  /** The journey this persona exercises (for the run log / verification). */
  path: 'approve' | 'revision' | 'high-risk-hold' | 'critical-hold' | 'adviser-multi-client'
  /** PNG logo fixture key in e2e/fixtures/logos/<key>.png. */
  logoKey: string
  answers: Record<string, Record<string, unknown>>
}

const declaration = { '10': { declaration_accepted: true } }

// Section 7 governance block with a real, per-persona contact (no "Test Owner").
// governance_owner is a real value ('internal_owner'); only 'none' trips a flag.
const gov = (contact: GovernanceContact) => ({
  '7': {
    governance_owner: 'internal_owner',
    governance_contact: contact,
    has_ropa: 'No',
    has_dpia: 'No',
    has_ai_policy: 'No',
    certifications: ['None of these'],
  },
})
const noComplaints = { '8': { has_complaints_procedure: 'No', has_past_complaints: 'No', ico_contact: 'No' } }
const proactive = { '9': { purchase_reason: 'proactive', additional_context: 'Smoke Test 2 persona.' } }

export const PERSONAS: Persona[] = [
  // 1. LUMEN STUDIO — Solo £249 — target LOW — auto-gen — approve path.
  // Boutique brand & design studio, multi-tool but ALL internal, no decisions,
  // names/contact only, UK-only. Vendors all US with DPA+SCCs → no flags. → LOW.
  {
    key: 'lumen',
    company: 'Lumen Studio',
    blurb: 'Boutique brand & design studio; 4 internal AI tools, UK-only, no decisions. Clean rich low-risk pack.',
    tier: 'solo',
    email: 'olutags+lumen@gmail.com',
    expectedRisk: 'low',
    expectAutoGen: true,
    path: 'approve',
    logoKey: 'lumen',
    answers: {
      '1': { company_name: 'Lumen Studio Ltd', sector: 'Marketing / advertising', employee_count: '1-9' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Retail / e-commerce'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'ChatGPT / OpenAI': { selected: true, purposes: ['Content creation / writing'], customer_facing: 'No' },
          'Midjourney': { selected: true, purposes: ['Moodboards / concept imagery'], customer_facing: 'No' },
          'Notion AI': { selected: true, purposes: ['Internal docs / wiki'], customer_facing: 'No' },
          'Otter.ai': { selected: true, purposes: ['Client-call transcription'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Midjourney', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: [] },
          { vendor_name: 'Notion', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Otter.ai', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: [] },
        ],
      },
      ...gov({ name: 'Maya Ellison', job_title: 'Studio Director', email: 'olutags+lumen@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 2. COBALT LABS — Procurement-Ready £499 — target MEDIUM — auto-gen — flagship approve.
  // AI automation agency. Customer-facing client chatbots/agents + EU>50% + no
  // disclosure → medium#1 (customer-facing+no-disclosure) + medium#2 (EU+customer-facing). → MEDIUM.
  {
    key: 'cobalt',
    company: 'Cobalt Labs',
    blurb: 'AI automation agency (22 staff) building client chatbots/agents; customer-facing, EU>50%, no disclosure. Meatiest vendor + AI register.',
    tier: 'procurement_ready',
    email: 'olutags+cobalt@gmail.com',
    expectedRisk: 'medium',
    expectAutoGen: true,
    path: 'approve',
    logoKey: 'cobalt',
    answers: {
      '1': { company_name: 'Cobalt Labs Ltd', sector: 'B2B SaaS / technology', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2b', customer_sectors: ['B2B SaaS / technology', 'Retail / e-commerce'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'ChatGPT / OpenAI': { selected: true, purposes: ['Client chatbots'], customer_facing: 'Yes' },
          'Anthropic Claude': { selected: true, purposes: ['Client AI agents'], customer_facing: 'Yes' },
          'Zapier AI': { selected: true, purposes: ['Workflow automation'], customer_facing: 'No' },
          'Make.com': { selected: true, purposes: ['Workflow automation'], customer_facing: 'No' },
          'Pinecone': { selected: true, purposes: ['RAG vector store'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot or live chat'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Anthropic', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Zapier', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Make (Celonis)', hq_location: 'EU/EEA', dpa_signed: 'Yes', transfer_mechanism: 'N/A (EU/EEA)', training_reuse: 'No', certifications: ['ISO 27001'] },
          { vendor_name: 'Pinecone', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Daniel Okafor', job_title: 'Head of Engineering & Data Protection Lead', email: 'olutags+cobalt@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 3. HARBORVIEW LETTINGS — Solo £249 — target MEDIUM — auto-gen — REVISION path.
  // Tenant-referencing tool scores applicants but a HUMAN makes the final call
  // (ai_decision_making='No' → no high flag). Customer-facing chatbot + no
  // disclosure → medium#1. US vendor without DPA → medium#2. UK-only. → MEDIUM.
  {
    key: 'harborview',
    company: 'Harborview Lettings',
    blurb: 'Property lettings (15 staff); referencing tool scores but human decides, customer chatbot no disclosure, US vendor no DPA. Customer requests a revision.',
    tier: 'solo',
    email: 'olutags+harborview@gmail.com',
    expectedRisk: 'medium',
    expectAutoGen: true,
    path: 'revision',
    logoKey: 'harborview',
    answers: {
      '1': { company_name: 'Harborview Lettings Ltd', sector: 'Professional services', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2c', customer_sectors: ['Professional services'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'ChatGPT / OpenAI': { selected: true, purposes: ['Listing copy'], customer_facing: 'No' },
          'TenantVet Referencing': { selected: true, purposes: ['Applicant referencing (human-reviewed)'], customer_facing: 'No' },
          'Enquiry chatbot': { selected: true, purposes: ['Customer enquiries'], customer_facing: 'Yes' },
        },
        custom_tools: [],
      },
      // Human makes the final call → 'No'. Keep ai_decision_categories empty so no Annex III high flag.
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot or live chat'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'TenantVet Inc', hq_location: 'USA', dpa_signed: 'No', transfer_mechanism: 'None', training_reuse: 'No', certifications: [] },
        ],
      },
      ...gov({ name: 'Sarah Whitcombe', job_title: 'Operations Manager', email: 'olutags+harborview@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 4. NORTHWIND TALENT — Procurement-Ready £499 — target HIGH — HELD — high-risk admin flow.
  // AI CV screening/ranking: ai_decision_making='Yes' (high#1) + Annex III
  // 'Screening or ranking job applications' (high#2). EU candidates, US vendor no
  // DPA. No special/children → HIGH (not critical).
  {
    key: 'northwind',
    company: 'Northwind Talent',
    blurb: 'Recruitment firm (30 staff); AI CV screening that ranks candidates (Annex III + decision-making). HELD for admin.',
    tier: 'procurement_ready',
    email: 'olutags+northwind@gmail.com',
    expectedRisk: 'high',
    expectAutoGen: false,
    path: 'high-risk-hold',
    logoKey: 'northwind',
    answers: {
      '1': { company_name: 'Northwind Talent Ltd', sector: 'Recruitment / staffing', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'Custom screening / ranking model': { selected: true, purposes: ['Screening / shortlisting candidates'], customer_facing: 'No' },
          'Video-assessment tool': { selected: true, purposes: ['Candidate assessment'], customer_facing: 'Yes' },
          'ChatGPT / OpenAI': { selected: true, purposes: ['Job-description drafting'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Screening or ranking job applications'], ai_customer_facing: 'Yes', ai_customer_channels: ['Mobile app'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'HireRank AI', hq_location: 'USA', dpa_signed: 'No', transfer_mechanism: 'None', training_reuse: 'Yes', certifications: [] },
        ],
      },
      ...gov({ name: 'James Calloway', job_title: 'Head of Talent Operations', email: 'olutags+northwind@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 5. MEDIMIND HEALTH — Procurement-Ready £499 — target CRITICAL — HELD — critical path.
  // AI triage on health data + access-to-care decisions: decision 'Yes' (high#1)
  // + Annex III 'Access to healthcare...' (high#2) + special-category health data
  // (high#3). >=2 high + Annex + special → CRITICAL.
  {
    key: 'medimind',
    company: 'MediMind Health',
    blurb: 'Digital health app (25 staff); AI triage on health data + access-to-care decisions. CRITICAL — HELD, "team will be in touch".',
    tier: 'procurement_ready',
    email: 'olutags+medimind@gmail.com',
    expectedRisk: 'critical',
    expectAutoGen: false,
    path: 'critical-hold',
    logoKey: 'medimind',
    answers: {
      '1': { company_name: 'MediMind Health Ltd', sector: 'Healthcare / life sciences', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '25-50', customer_type: 'b2c', customer_sectors: ['Healthcare / life sciences'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'Custom triage model': { selected: true, purposes: ['In-app symptom triage'], customer_facing: 'Yes' },
          'ChatGPT / OpenAI': { selected: true, purposes: ['Internal productivity / admin'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Access to healthcare, benefits, or essential services'], ai_customer_facing: 'Yes', ai_customer_channels: ['Mobile app'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details', 'Health or medical information'],
        special_category_basis: 'Explicit consent',
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Dr. Priya Nair', job_title: 'Chief Clinical Officer', email: 'olutags+medimind@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 6. BRIGHTPATH TUTORING — Solo £249 — target CRITICAL — HELD — children's-data path.
  // Edtech for under-18s. AI tutor + AI that assesses learning progress: decision
  // 'Yes' (high#1) + Annex III 'Assessing students, candidates, or learners'
  // (high#2) + children's data via ai_children_data='Yes' (special-category high#3).
  // With ST2-3 resolved (both children's-data signals count), this correctly lands
  // CRITICAL — the honest outcome for an edtech firm handling under-18s' data.
  {
    key: 'brightpath',
    company: 'Brightpath Tutoring',
    blurb: 'Edtech for under-18s (12 staff); AI tutor + progress assessment (Annex III education + decision). Children\'s data via s4. HELD critical.',
    tier: 'solo',
    email: 'olutags+brightpath@gmail.com',
    expectedRisk: 'critical',
    expectAutoGen: false,
    path: 'high-risk-hold',
    logoKey: 'brightpath',
    answers: {
      '1': { company_name: 'Brightpath Tutoring Ltd', sector: 'Education / training', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2c', customer_sectors: ['Education / training'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'AI tutor': { selected: true, purposes: ['In-app tutoring'], customer_facing: 'Yes' },
          'Progress-assessment model': { selected: true, purposes: ['Assessing learning progress & recommending pathways'], customer_facing: 'Yes' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'Yes', ai_decision_categories: ['Assessing students, candidates, or learners'], ai_customer_facing: 'Yes', ai_customer_channels: ['Mobile app'], ai_children_data: 'Yes' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        // Children's data is declared via ai_children_data='Yes' (s4 above), which
        // now feeds special-category scoring (ST2-3) → this case lands CRITICAL.
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Rachel Donovan', job_title: 'Safeguarding & Data Protection Lead', email: 'olutags+brightpath@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 7. LEDGERLY — Solo £249 — target LOW — auto-gen — minimal approve path.
  // Bookkeeping micro-firm. ChatGPT (internal) + Dext OCR (internal). Vendors with
  // DPA. No decisions, no customer-facing AI. → LOW. Contrast vs Cobalt.
  {
    key: 'ledgerly',
    company: 'Ledgerly',
    blurb: 'Bookkeeping micro-firm (4 staff); ChatGPT + Dext OCR, both internal. Smallest footprint, still a full 9-doc pack.',
    tier: 'solo',
    email: 'olutags+ledgerly@gmail.com',
    expectedRisk: 'low',
    expectAutoGen: true,
    path: 'approve',
    logoKey: 'ledgerly',
    answers: {
      '1': { company_name: 'Ledgerly Ltd', sector: 'Financial services', employee_count: '1-9' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'ChatGPT / OpenAI': { selected: true, purposes: ['Drafting emails'], customer_facing: 'No' },
          'Dext': { selected: true, purposes: ['Receipt OCR'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Dext', hq_location: 'UK', dpa_signed: 'Yes', transfer_mechanism: 'N/A (UK)', training_reuse: 'No', certifications: ['ISO 27001'] },
        ],
      },
      ...gov({ name: 'Tom Bridges', job_title: 'Managing Director', email: 'olutags+ledgerly@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 8. ATLAS FREIGHT — Procurement-Ready £499 — target MEDIUM — auto-gen — approve.
  // Logistics SaaS. Customer-facing support chatbot + no disclosure → medium#1.
  // EU>25% + customer-facing → medium#2. Operational AI internal. US vendor
  // SCCs+DPA → no extra flag. → MEDIUM.
  {
    key: 'atlas',
    company: 'Atlas Freight',
    blurb: 'Logistics SaaS (40 staff), UK+EU; route-opt + demand-forecast internal, support chatbot customer-facing no disclosure. Larger SME, procurement tier.',
    tier: 'procurement_ready',
    email: 'olutags+atlas@gmail.com',
    expectedRisk: 'medium',
    expectAutoGen: true,
    path: 'approve',
    logoKey: 'atlas',
    answers: {
      '1': { company_name: 'Atlas Freight Ltd', sector: 'B2B SaaS / technology', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '25-50', customer_type: 'b2b', customer_sectors: ['Retail / e-commerce'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'Route-optimisation model': { selected: true, purposes: ['Route optimisation'], customer_facing: 'No' },
          'Support chatbot': { selected: true, purposes: ['Customer support'], customer_facing: 'Yes' },
          'Demand-forecast model': { selected: true, purposes: ['Demand forecasting'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot or live chat'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Elena Vasquez', job_title: 'Head of Platform', email: 'olutags+atlas@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 9. VERDE CONSULTING — Adviser £799 — target LOW — auto-gen — adviser multi-client.
  // Sustainability consultancy buying the Adviser pack to deliver to 3 of its own
  // clients. Its OWN profile: ChatGPT + Power BI Copilot, internal only. → LOW.
  // NOTE: full multi-client (3 separate intakes/packs) is only partially built —
  // the harness seeds ONE order per persona, so the 3-client flow is surfaced as a
  // gap, not exercised. Verde here is the adviser org's own clean low-risk pack.
  {
    key: 'verde',
    company: 'Verde Consulting',
    blurb: 'Sustainability consultancy (18 staff) on the Adviser tier; ChatGPT + Power BI Copilot internal. Adviser multi-client flow (partially built — surface gaps).',
    tier: 'adviser',
    email: 'olutags+verde@gmail.com',
    expectedRisk: 'low',
    expectAutoGen: true,
    path: 'adviser-multi-client',
    logoKey: 'verde',
    answers: {
      '1': { company_name: 'Verde Consulting Ltd', sector: 'Professional services', employee_count: '10-49' },
      '2': { customer_geography: 'uk', eu_customer_proportion: '0', customer_type: 'b2b', customer_sectors: ['Professional services'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'ChatGPT / OpenAI': { selected: true, purposes: ['Report drafting'], customer_facing: 'No' },
          'Power BI Copilot': { selected: true, purposes: ['Internal analytics'], customer_facing: 'No' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'No', ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Microsoft', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['ISO 27001', 'SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Marcus Feld', job_title: 'Principal Consultant', email: 'olutags+verde@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },

  // 10. PIXEL & PULSE — Solo £249 — target MEDIUM — auto-gen — REVISION path.
  // DTC e-commerce. Customer-facing personalisation (Klaviyo, product-rec) + no
  // disclosure → medium#1. EU>25% B2C + customer-facing → medium#2. No legal-effect
  // decisions. → MEDIUM. Customer asks to change the disclosure-snippet wording.
  {
    key: 'pixelpulse',
    company: 'Pixel & Pulse',
    blurb: 'DTC e-commerce & marketing (18 staff), B2C with EU customers; Klaviyo AI + product-rec customer-facing, no disclosure. Customer requests a disclosure-wording revision.',
    tier: 'solo',
    email: 'olutags+pixelpulse@gmail.com',
    expectedRisk: 'medium',
    expectAutoGen: true,
    path: 'revision',
    logoKey: 'pixelpulse',
    answers: {
      '1': { company_name: 'Pixel & Pulse Ltd', sector: 'Retail / e-commerce', employee_count: '10-49' },
      '2': { customer_geography: 'uk_eu', eu_customer_proportion: '>50', customer_type: 'b2c', customer_sectors: ['Retail / e-commerce'] },
      '3': {
        no_ai_tools: false,
        tools: {
          'Klaviyo AI': { selected: true, purposes: ['Email personalisation'], customer_facing: 'Yes' },
          'Meta Advantage+': { selected: true, purposes: ['Ad targeting'], customer_facing: 'Yes' },
          'ChatGPT / OpenAI': { selected: true, purposes: ['Content creation / writing'], customer_facing: 'No' },
          'Product-recommendation engine': { selected: true, purposes: ['On-site product recommendations'], customer_facing: 'Yes' },
        },
        custom_tools: [],
      },
      '4': { ai_decision_making: 'No', ai_decision_categories: [], ai_customer_facing: 'Yes', ai_customer_channels: ['Website chatbot or live chat', 'Email (AI-written messages sent to named individuals)'], ai_children_data: 'No' },
      '5': { current_ai_disclosure: 'No', ai_opt_out_mechanism: 'Not applicable' },
      '6': {
        data_categories: ['Names and contact details'],
        vendors: [
          { vendor_name: 'Klaviyo', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
          { vendor_name: 'Meta', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: [] },
          { vendor_name: 'OpenAI', hq_location: 'USA', dpa_signed: 'Yes', transfer_mechanism: 'Standard Contractual Clauses (SCCs)', training_reuse: 'No', certifications: ['SOC 2 Type II'] },
        ],
      },
      ...gov({ name: 'Chloe Hartman', job_title: 'Head of Growth', email: 'olutags+pixelpulse@gmail.com' }),
      ...noComplaints, ...proactive, ...declaration,
    },
  },
]
