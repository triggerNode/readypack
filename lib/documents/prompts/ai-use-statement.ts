// lib/documents/prompts/ai-use-statement.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'ai_use_statement'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  return `Generate the content_json for an AI Use Statement.

${companyProfileBlock(intake)}

AI TOOLS IN USE:
${formatAiTools(intake.aiTools)}

OUTPUT SCHEMA (respond with ONLY this JSON object — no markdown, no code fences):
{
  "document_type": "ai_use_statement",
  "title": "AI Use Statement",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [
    {
      "section_id": "intro",
      "section_number": "1.",
      "heading": "Introduction and Scope",
      "blocks": [
        { "type": "paragraph", "text": "Two-to-three-sentence paragraph describing the company, its use of AI, and why this statement exists. Reference Article 50 of the EU AI Act and UK GDPR Article 13-14." },
        { "type": "paragraph", "text": "Optional second paragraph adding industry and EU-customer context specific to ${intake.companyName}." }
      ]
    },
    {
      "section_id": "purpose",
      "section_number": "2.",
      "heading": "Purpose of This Document",
      "blocks": [
        { "type": "paragraph", "text": "Paragraph explaining who this document is for (clients, regulators, staff) and how often it is reviewed." },
        { "type": "notice", "text": "Reference to Article 50 EU AI Act and the cross-link to Customer Disclosure Snippets (Document 06)." }
      ]
    }
  ],
  "ai_systems_table": {
    "table_id": "ai-systems",
    "title": "AI Systems in Use",
    "columns": ["System", "Vendor", "Purpose", "AI Act Classification"],
    "rows": [ /* one row per AI tool above — concise cell content, e.g. ["ChatGPT", "OpenAI", "Drafting", "Limited risk (Art. 50)"] */ ]
  },
  "systems_not_in_use_text": "A paragraph confirming that no Annex III high-risk AI systems are in use. Be specific about biometric ID, employment decision-making, access to essential services.",
  "human_oversight_text": "A paragraph describing the company's human oversight model — who reviews AI output before client release, who is overall accountable.",
  "controls": {
    "data_minimisation": "A paragraph on data minimisation: what staff are instructed not to enter into AI tools, what tier of tool is used for sensitive content.",
    "training_and_acceptable_use": "A paragraph referencing the Internal AI Use Policy (Document 05) and the staff training requirement.",
    "review_schedule": "A paragraph describing the annual + triggered review cycle."
  }
}

RULES:
- Populate ai_systems_table.rows with EXACTLY one row per tool listed above. Each row is an array of 4 short strings.
- All prose must be specific to ${intake.companyName} and its industry (${intake.industry}).
- Do not invent AI tools or vendors that were not listed.
- Output ONLY the JSON object. No markdown.`
}
