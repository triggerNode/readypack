// lib/documents/prompts/internal-policy.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'internal_ai_use_policy'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for an Internal AI Use Policy (staff-facing).

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "internal_ai_use_policy",
  "title": "Internal AI Use Policy",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [],
  "purpose_text": "A paragraph stating the policy's purpose and that it is binding on employees, contractors, freelancers.",
  "scope_text": "A paragraph describing the AI tools covered (specifically referencing the tools above) and where the policy applies.",
  "roles_text": "A paragraph naming who is accountable (the document owner / founder) and team-lead responsibilities.",
  "do_items": [
    "Use approved enterprise accounts for any work involving client material.",
    "Review every AI-generated output before it leaves the Company.",
    "Disclose AI assistance in client deliverables where required.",
    "Report suspected near-misses or breaches to the Founder within 24 hours."
  ],
  "dont_items": [
    "Paste client personal data, payment details, or confidential briefs into consumer accounts.",
    "Use AI to make hiring, performance, or disciplinary decisions about colleagues.",
    "Adopt a new AI tool for work purposes without written sign-off.",
    "Treat AI output as factually verified — every claim must be checked."
  ],
  "enforcement_text": "A paragraph on breach handling under the normal disciplinary procedure and personal-data-breach procedure where relevant.",
  "training_text": "A paragraph on training, induction, and acknowledgement record-keeping.",
  "sign_off": {
    "approved_by_name": "${intake.contactName}",
    "approved_by_role": "${intake.contactRole}",
    "effective_date": "${intake.preparedDate}",
    "review_cycle": "Review annually"
  }
}

RULES:
- do_items and dont_items must each be exactly 4 items, calibrated to the company's actual AI tools.
- Items are single sentences, not lists or sub-bullets.
- Output ONLY the JSON object.`
}
