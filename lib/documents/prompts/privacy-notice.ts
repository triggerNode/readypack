// lib/documents/prompts/privacy-notice.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  formatVendors,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'privacy_notice_addendum'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for a Privacy Notice Addendum (AI-specific).

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

VENDORS:
${formatVendors(intake.vendors)}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "privacy_notice_addendum",
  "title": "Privacy Notice Addendum",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [
    {
      "section_id": "about",
      "section_number": "1.",
      "heading": "About This Addendum",
      "blocks": [ { "type": "paragraph", "text": "Two-sentence paragraph describing what this addendum supplements and who it covers." } ]
    },
    {
      "section_id": "scope",
      "section_number": "3.",
      "heading": "Scope",
      "blocks": [ { "type": "paragraph", "text": "Paragraph describing whose personal data is covered (prospective clients, existing clients, end-users, staff)." } ]
    }
  ],
  "controller_details": {
    "table_id": "controller",
    "columns": ["Field", "Detail"],
    "rows": [
      ["Controller", "${intake.companyName}"],
      ["Address", "[address from intake — placeholder if not provided]"],
      ["ICO Registration", "[ICO reg or 'Pending']"],
      ["Contact for data rights", "${intake.contactEmail || 'privacy@' + intake.companyName.toLowerCase().replace(/[^a-z]/g, '') + '.example'}"]
    ]
  },
  "processing_activities_table": {
    "table_id": "activities",
    "columns": ["Activity", "Personal Data", "Lawful Basis", "Retention"],
    "rows": [ /* 3-5 rows tailored to the company's actual AI use cases above. Each row is 4 short strings. */ ]
  },
  "no_automated_decisions_text": "A paragraph stating the company does not make solely-automated decisions producing legal/significant effects on individuals, with the human review safeguard.",
  "your_rights_text": "A paragraph listing the UK GDPR rights (access, rectify, erase, restrict, object).",
  "international_transfers_text": "A paragraph specific to the vendors above describing the transfer mechanisms (DPF, SCCs) and TIA practice.",
  "complaints_text": "A short paragraph pointing to the ICO and to the Complaints Procedure (Document 08)."
}

RULES:
- The processing_activities_table must reflect the actual AI tools the company uses.
- Lawful basis options: legitimate interests (Art. 6(1)(f)), consent (Art. 6(1)(a)), contract (Art. 6(1)(b)).
- Output ONLY the JSON object.`
}
