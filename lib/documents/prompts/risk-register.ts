// lib/documents/prompts/risk-register.ts
import type { DocumentType } from '@/types/database'
import {
  companyProfileBlock,
  formatAiTools,
  formatVendors,
  type PromptBuilder,
  type PromptIntake,
} from './types'

export const DOC_TYPE: DocumentType = 'ai_risk_register'

export const buildPrompt: PromptBuilder = (intake: PromptIntake) => {
  const flagsText =
    intake.riskFlags.length === 0
      ? '  (No specific risk flags from intake)'
      : intake.riskFlags
          .map((f, i) => `${i + 1}. [${f.severity}] ${f.explanation}${f.required_action ? ' — Action: ' + f.required_action : ''}`)
          .join('\n')

  return `Generate the content_json for an AI Risk Register.

${companyProfileBlock(intake)}

AI TOOLS:
${formatAiTools(intake.aiTools)}

VENDORS:
${formatVendors(intake.vendors)}

RISK FLAGS FROM INTAKE:
${flagsText}

OUTPUT SCHEMA (respond with ONLY this JSON object):
{
  "document_type": "ai_risk_register",
  "title": "AI Risk Register",
  "prepared_for": "${intake.companyName}",
  "prepared_by": "ReadyPack Compliance Platform",
  "version": "1.0",
  "prepared_date": "${intake.preparedDate}",
  "review_date": "${intake.reviewDate}",
  "sections": [
    {
      "section_id": "purpose",
      "section_number": "1.",
      "heading": "Purpose",
      "blocks": [ { "type": "paragraph", "text": "Two-sentence paragraph on what this register records and how often it is reviewed." } ]
    }
  ],
  "methodology_text": "A paragraph describing the Low/Medium/High likelihood × severity scoring methodology.",
  "risk_matrix": {
    "low_low": "Low",  "low_med": "Low",     "low_high": "Medium",
    "med_low": "Low",  "med_med": "Medium",  "med_high": "High",
    "high_low": "Medium", "high_med": "High", "high_high": "Critical"
  },
  "risk_register_table": {
    "table_id": "risks",
    "columns": ["ID", "Risk", "Likelihood / Severity", "Mitigation", "Residual"],
    "rows": [
      /* 4-6 rows tailored to the company's actual AI tools and risk flags.
         Examples of risk types: prompt-based disclosure, hallucination in client deliverables,
         vendor lock-in, cross-border transfer non-compliance, automated-decision drift, model training reuse. */
    ]
  },
  "review_schedule_text": "A paragraph on quarterly review by the document owner, plus interim review triggers.",
  "escalation_text": "A paragraph on how High/Critical residual risks are escalated and what mitigations are taken."
}

RULES:
- Risk register rows: ID format R-01, R-02 ...; each row is 5 short strings.
- Tailor risks to the actual AI tools and vendors above.
- Output ONLY the JSON object.`
}
