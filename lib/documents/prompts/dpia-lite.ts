// lib/documents/prompts/dpia-lite.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'dpia_lite'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for a DPIA-Lite (Data Protection Impact Assessment, lightweight).

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "dpia_lite",
  "title": "DPIA-Lite Template",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [],
  "processing_description": "A paragraph describing the AI-supported processing being assessed (drafting, summarisation, lead enrichment, etc.) specific to ${intake.companyName}.",
  "necessity_proportionality": "A paragraph on why the AI-assisted processing is necessary and proportionate.",
  "risks_table": {
    "table_id": "dpia-risks",
    "columns": ["Risk to Individual", "Likelihood", "Severity", "Mitigation"],
    "rows": [
      /* 3-5 rows. Each row is 4 short strings.
         Likelihood / Severity values: Low, Medium, High. */
    ]
  },
  "conclusion_text": "A short paragraph stating the residual risk position (Low/Medium/High) and whether ICO prior consultation is required.",
  "sign_off": {
    "prepared_by_name": "${intake.contactName}",
    "prepared_by_role": "${intake.contactRole}",
    "date": "${intake.preparedDate}",
    "next_review": "${intake.reviewDate}"
  }
}

RULES:
- The risks_table must reflect the actual AI use cases above.
- Output ONLY the JSON object.`
}
