// lib/documents/prompts/complaints-procedure.ts
import type { DocumentType } from '@/types/database'
import { companyProfileBlock, type PromptBuilder, type PromptIntake } from './types'

export const DOC_TYPE: DocumentType = 'complaints_procedure_pack'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for a Complaints Procedure Pack (DUAA s.103 compliant).

${companyProfileBlock(intake)}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "complaints_procedure_pack",
  "title": "Complaints Procedure Pack",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [],
  "purpose_text": "A paragraph stating how ${intake.companyName} receives, acknowledges, investigates, and resolves complaints about personal data — referencing Section 103 of the UK Data (Use and Access) Act 2025.",
  "how_to_complain_text": "A paragraph specifying the channels (email${intake.contactEmail ? ' to ' + intake.contactEmail : ''}, post to registered address, in person).",
  "process_steps": [
    { "step_number": 1, "day_range": "Day 0",      "title": "Acknowledge receipt",     "description": "We acknowledge every complaint within one working day, naming the individual handling the matter." },
    { "step_number": 2, "day_range": "Day 1 – 7",  "title": "Investigate",             "description": "The handler reviews processing records, vendor logs, and internal correspondence. Additional information may be requested from the complainant." },
    { "step_number": 3, "day_range": "Day 7 – 30", "title": "Substantive response",    "description": "A written response is issued setting out findings and remedial action. If we cannot respond within 30 days, we explain why and provide a revised timeline." },
    { "step_number": 4, "day_range": "Day 30+",    "title": "Escalation to the ICO",   "description": "Complainants who remain dissatisfied are told how to escalate to the Information Commissioner's Office." }
  ],
  "records_text": "A paragraph on the six-year minimum retention of complaint records and quarterly review for trends.",
  "confidentiality_text": "A paragraph on confidentiality of complaints and the no-retaliation commitment.",
  "escalation_contacts_table": {
    "table_id": "escalation-contacts",
    "columns": ["Route", "Contact"],
    "rows": [
      ["Internal — First contact", "${intake.contactEmail || 'privacy@' + intake.companyName.toLowerCase().replace(/[^a-z]/g, '') + '.example'}"],
      ["Internal — Escalation", "${intake.contactName}, ${intake.contactRole}"],
      ["External — Regulator", "Information Commissioner's Office (ICO) — ico.org.uk"]
    ]
  }
}

RULES:
- Keep the 4 process_steps exactly as specified above (DUAA-aligned timing).
- Output ONLY the JSON object.`
}
