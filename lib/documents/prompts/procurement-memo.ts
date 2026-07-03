// lib/documents/prompts/procurement-memo.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'procurement_response_memo'

// The canonical 9-document index. Every cross-reference the memo makes MUST use
// these exact numbers and titles. The model was inventing document titles for
// numbers (e.g. "Doc 04 = Records of Processing", "Doc 06 = Data Subject Rights
// Register") that do not match the real pack, which the QA layer then correctly
// flagged as a cross-document inconsistency and escalated on. The base memo
// prompt already carries the index inside documentation_index_table, but the
// chunked Q&A sub-calls did not — so injecting this into every memo sub-call
// removes the guesswork at the source.
const DOCUMENT_INDEX_REFERENCE = `DOCUMENT REFERENCE INDEX — when citing a supporting document by number, you MUST use these exact numbers and titles. NEVER invent a different title for a number, and NEVER cite a document number that is not in this list:
- Doc 01: AI Use Statement
- Doc 02: Privacy Notice Addendum
- Doc 03: AI Risk Register
- Doc 04: DPIA-Lite (Data Protection Impact Assessment)
- Doc 05: Internal AI Use Policy
- Doc 06: Customer Disclosure Snippets
- Doc 07: Vendor AI Register
- Doc 08: Complaints Procedure Pack
- Doc 09: Procurement Response Memo (this document)
IMPORTANT MAPPINGS: Records of Processing (UK GDPR Art. 30) content lives in the Privacy Notice Addendum (Doc 02) — there is NO standalone "Records of Processing" document. Data-subject-rights content lives in the Privacy Notice Addendum (Doc 02) and Customer Disclosure Snippets (Doc 06) — there is NO standalone "Data Subject Rights Register". If a topic has no dedicated document, cite the document that actually contains it (or state it is handled as a process) — never a made-up document title.`

// Core memo prompt. `includeQaBank` controls whether the 40-question procurement
// Q&A bank is requested inline.
//   • Single-call path  (buildPrompt)         → includes the bank for premium tiers.
//   • Chunked path       (buildBaseMemoPrompt) → omits the bank; it is generated
//     separately in grouped sub-calls (ST2-5) so no single call approaches the
//     output-token cap. The two paths assemble to the same content_json shape.
function memoPrompt(intake: PromptIntake, includeQaBank: boolean): string {
  const qaBankSchemaField = includeQaBank
    ? `,
  "procurement_qa_bank": [
    { "question": "string — one of the 40 standard enterprise RFP questions on AI/Data compliance", "answer": "string — a highly specific answer synthesised from this customer's actual AI tools, vendors, jurisdictions, DPA status, transfer mechanisms, and risk flags" }
  ]`
    : ''

  const qaBankRules = includeQaBank
    ? `
- procurement_qa_bank: Generate EXACTLY 40 question/answer objects. No more, no fewer.
- Questions MUST be the kind of items asked in real enterprise RFPs and vendor due-diligence questionnaires on AI and data compliance. Cover, at minimum: training data ring-fencing and isolation, data retention for AI inferences and prompts, model training reuse of customer data, sub-processor disclosure, cross-border transfers and SCC/DPF reliance, EU AI Act risk classification of deployed systems, Article 50 transparency obligations, human oversight controls, automated decision-making safeguards (UK GDPR Art. 22), DPIA coverage, incident notification timelines, model output logging and auditability, prompt-injection and output filtering controls, bias and discrimination testing, accuracy and performance monitoring, vendor SOC 2 / ISO 27001 / ISO 42001 status, encryption in transit and at rest, access controls and least privilege, employee AI usage policy, deletion-on-request workflows, complaint handling under DUAA Section 103, records of processing (Art. 30), lawful basis selection, special category data handling, children's data, marketing and profiling, breach notification, data residency, business continuity, and AI system decommissioning.
- Example phrasings (do NOT just copy verbatim — adapt to this customer): "How is training data ring-fenced from other tenants?", "What is your data retention policy for AI inferences and prompts?", "Do any of your AI vendors reuse customer data to train their models?"
- Answers MUST be highly specific to THIS customer: name the actual AI tools, vendors, jurisdictions, DPA status, transfer mechanisms, and risk flags from the intake data above. When citing supporting documents, use ONLY the DOCUMENT REFERENCE INDEX above — never invent a document title for a number. Never give a generic boilerplate answer.
- If a question cannot be answered from the intake data, state explicitly what is in place and what is not (e.g. "No Annex III high-risk AI systems are currently deployed; this is reviewed quarterly.").`
    : ''

  return `Generate the content_json for a Procurement Response Memo (cover note for enterprise vendor questionnaires).

CUSTOMER TIER: ${intake.tier}

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

${DOCUMENT_INDEX_REFERENCE}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "procurement_response_memo",
  "title": "Procurement Response Memo",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [],
  "executive_summary": "A paragraph summarising ${intake.companyName}'s compliance posture across UK GDPR, the EU AI Act, and the UK Data (Use and Access) Act 2025. Mention the purpose: accompany procurement responses and supplier questionnaires.",
  "compliance_snapshot_table": {
    "table_id": "snapshot",
    "columns": ["Area", "Status", "Evidence"],
    "rows": [
      ["UK GDPR — Records of Processing (Art. 30)", "✓ In place", "Privacy Notice Addendum (Doc 02), Vendor AI Register (Doc 07)"],
      ["EU AI Act — Article 50 Transparency", "✓ In place", "AI Use Statement (Doc 01), Customer Disclosure Snippets (Doc 06)"],
      ["EU AI Act — Risk Management", "✓ In place", "AI Risk Register (Doc 03)"],
      ["DUAA Section 103 — Complaints", "✓ In place", "Complaints Procedure Pack (Doc 08)"],
      ["High-risk AI systems (Annex III)", "⚠ Not in scope", "No Annex III systems deployed; reviewed quarterly"],
      ["Cross-border transfers — Adequacy", "⚠ Reliance on DPF/SCCs", "TIA on file; reviewed annually"]
    ]
  },
  "documentation_index_table": {
    "table_id": "doc-index",
    "columns": ["Doc", "Title", "Owner"],
    "rows": [
      ["01", "AI Use Statement", "${intake.contactName}, ${intake.contactRole}"],
      ["02", "Privacy Notice Addendum", "${intake.contactName}, ${intake.contactRole}"],
      ["03", "AI Risk Register", "${intake.contactName}, ${intake.contactRole}"],
      ["04", "DPIA-Lite Template", "${intake.contactName}, ${intake.contactRole}"],
      ["05", "Internal AI Use Policy", "${intake.contactName}, ${intake.contactRole}"],
      ["06", "Customer Disclosure Snippets", "${intake.contactName}, ${intake.contactRole}"],
      ["07", "Vendor AI Register", "${intake.contactName}, ${intake.contactRole}"],
      ["08", "Complaints Procedure Pack", "${intake.contactName}, ${intake.contactRole}"],
      ["09", "Procurement Response Memo", "${intake.contactName}, ${intake.contactRole}"]
    ]
  },
  "contacts_table": {
    "table_id": "contacts",
    "columns": ["Topic", "Contact"],
    "rows": [
      ["Data protection enquiries", "${intake.contactEmail || 'privacy@' + intake.companyName.toLowerCase().replace(/[^a-z]/g, '') + '.example'}"],
      ["AI governance enquiries", "${intake.contactName}, ${intake.contactRole}"],
      ["Security and incident reporting", "[security email]"],
      ["Commercial / procurement", "[sales email]"]
    ]
  },
  "review_cycle_text": "A short paragraph stating the memo is refreshed annually and on any material change in the underlying documents."${qaBankSchemaField}
}

RULES:
- Compliance snapshot rows: keep the status indicators '✓ In place' / '⚠ Not in scope' / '⚠ Reliance on DPF/SCCs' exactly.
- Tailor the executive summary to ${intake.companyName}'s actual context.${qaBankRules}
- Output ONLY the JSON object. The JSON must be strictly valid (no trailing commas, no comments).`
}

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  const isPremiumTier = intake.tier === 'procurement_ready' || intake.tier === 'adviser'
  return memoPrompt(intake, isPremiumTier)
}

// ── Chunked premium generation (ST2-5) ───────────────────────────────────────
// The 40-question Q&A bank is the only part of the memo large enough to risk the
// output-token cap. We generate the memo body without it, then generate the bank
// in grouped sub-calls (10 questions each) and merge. Preserves the full 40-Q
// premium value while keeping every call well under the cap.

/** Memo body WITHOUT the Q&A bank — for the chunked premium path. */
export function buildBaseMemoPrompt(intake: PromptIntake): string {
  return memoPrompt(intake, false)
}

export interface QaChunkGroup {
  label: string
  count: number
  topics: string
}

/** Four groups × 10 questions = the full 40-question bank, split for chunking. */
export const QA_CHUNK_GROUPS: QaChunkGroup[] = [
  {
    label: 'Data handling, retention & transfers',
    count: 10,
    topics:
      'training data ring-fencing and tenant isolation; data retention for AI inferences and prompts; model training reuse of customer data; sub-processor disclosure; cross-border transfers and SCC/DPF reliance; data residency; deletion-on-request workflows; records of processing (Art. 30); lawful basis selection; special category data handling',
  },
  {
    label: 'EU AI Act, transparency & automated decisions',
    count: 10,
    topics:
      'EU AI Act risk classification of deployed systems; Article 50 transparency obligations; human oversight controls; automated decision-making safeguards (UK GDPR Art. 22); DPIA coverage; bias and discrimination testing; accuracy and performance monitoring; model output logging and auditability; prompt-injection and output filtering controls; AI system decommissioning',
  },
  {
    label: 'Security, certifications & incident response',
    count: 10,
    topics:
      'vendor SOC 2 / ISO 27001 / ISO 42001 status; encryption in transit and at rest; access controls and least privilege; incident notification timelines; breach notification; business continuity and disaster recovery; data backup and recovery; vulnerability management and penetration testing; secure software development lifecycle; logging and monitoring of access',
  },
  {
    label: 'Governance, people & individual rights',
    count: 10,
    topics:
      'employee AI usage policy; complaint handling under DUAA Section 103; children’s data; marketing and profiling; AI governance roles and ownership; individual rights handling (access, erasure, objection); staff training and awareness; vendor due-diligence process; contractual DPA coverage with vendors; AI governance review cadence',
  },
]

/** Generate one group of the procurement Q&A bank, customer-specific. */
export function buildQaChunkPrompt(intake: PromptIntake, group: QaChunkGroup): string {
  return `You are generating part of a Procurement Response Memo's enterprise Q&A bank for ${intake.companyName}.

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

${DOCUMENT_INDEX_REFERENCE}

TASK: Generate EXACTLY ${group.count} question/answer objects covering this theme — ${group.label}.
Topics to cover (one or more questions each, ${group.count} total): ${group.topics}.

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "procurement_qa_bank": [
    { "question": "string — a realistic enterprise RFP / vendor due-diligence question on the theme above", "answer": "string — a highly specific answer for THIS customer" }
  ]
}

RULES:
- Generate EXACTLY ${group.count} objects. No more, no fewer.
- Questions MUST read like real enterprise RFP / supplier-questionnaire items (e.g. "How is training data ring-fenced from other tenants?", "What is your data retention policy for AI inferences and prompts?").
- Answers MUST be specific to THIS customer: name the actual AI tools, vendors, jurisdictions, DPA status, transfer mechanisms, and risk flags from the intake above. When citing supporting documents, use ONLY the DOCUMENT REFERENCE INDEX above — never invent a document title for a number. Never give generic boilerplate.
- If something cannot be answered from the intake, state explicitly what is in place and what is not (e.g. "No Annex III high-risk AI systems are currently deployed; this is reviewed quarterly.").
- Output ONLY the JSON object. Strictly valid JSON (no trailing commas, no comments).`
}
