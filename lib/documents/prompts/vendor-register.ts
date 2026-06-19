// lib/documents/prompts/vendor-register.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatVendors,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'vendor_ai_register'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for a Vendor AI Register (Art. 30 record of processing-style document).

${companyProfileBlock(intake)}

VENDORS:
${formatVendors(intake.vendors)}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "vendor_ai_register",
  "title": "Vendor AI Register",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [],
  "about_text": "A paragraph stating that this register lists every third-party AI tool used by ${intake.companyName}, supporting UK GDPR Article 30 record of processing activities.",
  "maintenance_text": "A paragraph on quarterly review, sign-off for new vendors, and decommissioned-vendor retention.",
  "vendor_table": {
    "table_id": "vendors",
    "columns": ["Vendor / Product", "Data Touched", "Region / Transfer Mechanism"],
    "rows": [
      /* One row per vendor above. Each cell is a multi-line string.
         Cell 1: "Vendor — Product\\nUse: ..."  (use \\n for line break inside cell)
         Cell 2: data categories that touch the vendor.
         Cell 3: region + transfer mechanism + training-reuse posture. */
    ]
  },
  "decommissioning_text": "A paragraph on what happens at vendor end-of-life — deletion, register marking, retention.",
  "onboarding_text": "A paragraph on the new-vendor sign-off process: review of DPA terms, transfer mechanisms, security posture."
}

RULES:
- One row per vendor above. Do not invent vendors.
- Strings may contain a single \\n line break — that is supported by the PDF renderer.
- Output ONLY the JSON object.`
}
