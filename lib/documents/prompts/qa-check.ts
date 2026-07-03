// lib/documents/prompts/qa-check.ts
// Prompt template for the Stage 6 QA Layer.
// Runs against claude-3-5-haiku and outputs ONLY a JSON QaReport.

import {
  companyProfileBlock,
  formatAiTools,
  formatVendors,
  type PromptIntake,
} from './types'

// Compact, token-lean view of the generated documents.
// Strips out boilerplate paragraphs and keeps only what QA needs to reason over:
// declared AI systems, risk register entries, vendor register entries,
// procurement compliance snapshot + documentation index, disclosure tags,
// and sign-offs/dates.
function extractQaRelevantSlice(
  generatedDocs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [docType, raw] of Object.entries(generatedDocs)) {
    const doc = (raw ?? {}) as Record<string, unknown>

    switch (docType) {
      case 'ai_use_statement':
        out[docType] = {
          ai_systems_table: doc.ai_systems_table,
          systems_not_in_use_text: doc.systems_not_in_use_text,
        }
        break

      case 'privacy_notice_addendum':
        out[docType] = {
          processing_activities_table: doc.processing_activities_table,
          international_transfers_text: doc.international_transfers_text,
        }
        break

      case 'ai_risk_register':
        out[docType] = {
          risk_register_table: doc.risk_register_table,
          escalation_text: doc.escalation_text,
        }
        break

      case 'dpia_lite':
        out[docType] = {
          risks_table: doc.risks_table,
          conclusion_text: doc.conclusion_text,
          sign_off: doc.sign_off,
        }
        break

      case 'internal_ai_use_policy':
        out[docType] = {
          do_items: doc.do_items,
          dont_items: doc.dont_items,
          sign_off: doc.sign_off,
        }
        break

      case 'customer_disclosure_snippets':
        out[docType] = {
          snippet_index_table: doc.snippet_index_table,
          public_snippet_tags: Array.isArray(doc.public_snippets)
            ? (doc.public_snippets as Array<Record<string, unknown>>).map((s) => ({
                label: s.label,
                tag: s.tag,
              }))
            : [],
          client_snippet_tags: Array.isArray(doc.client_snippets)
            ? (doc.client_snippets as Array<Record<string, unknown>>).map((s) => ({
                label: s.label,
                tag: s.tag,
              }))
            : [],
        }
        break

      case 'vendor_ai_register':
        out[docType] = {
          vendor_table: doc.vendor_table,
        }
        break

      case 'complaints_procedure_pack':
        out[docType] = {
          escalation_contacts_table: doc.escalation_contacts_table,
          process_steps: Array.isArray(doc.process_steps)
            ? (doc.process_steps as Array<Record<string, unknown>>).map((p) => ({
                step_number: p.step_number,
                day_range: p.day_range,
                title: p.title,
              }))
            : [],
        }
        break

      case 'procurement_response_memo':
        out[docType] = {
          executive_summary: doc.executive_summary,
          compliance_snapshot_table: doc.compliance_snapshot_table,
          documentation_index_table: doc.documentation_index_table,
          contacts_table: doc.contacts_table,
          procurement_qa_bank: doc.procurement_qa_bank,
        }
        break

      default:
        // Unknown doc — keep nothing rather than blow up token budget.
        break
    }
  }

  return out
}

export function buildQaPrompt(
  intake: PromptIntake,
  generatedDocs: Record<string, unknown>,
): string {
  const isPremiumTier =
    intake.tier === 'procurement_ready' || intake.tier === 'adviser'

  const slice = extractQaRelevantSlice(generatedDocs)
  const docsBlock = JSON.stringify(slice)

  const procurementRule = isPremiumTier
    ? `
- PROCUREMENT EVIDENCE MAPPING (STRICT — this customer is on the '${intake.tier}' tier):
  - The Procurement Response Memo (Doc 09) MUST cite exact document cross-references in the form "AR-XX" or "Doc XX" (e.g. "AR-03", "Doc 03") in its compliance_snapshot_table 'Evidence' column and in procurement_qa_bank answers, where XX is one of the document numbers 01–09.
  - If the procurement memo cites a document number that does not correspond to one of the 9 generated documents, raise a consistency_issue with severity 'high'.
  - If procurement_qa_bank exists, it MUST contain exactly 40 question/answer objects. If the count is wrong, add a missing_info entry.
  - Every procurement_qa_bank answer that references "our policy", "our register", or similar MUST cite the specific Doc number it relies on; flag any that do not as a consistency_issue with severity 'medium'.`
    : ''

  return `You are the ReadyPack QA Layer. Your job is to audit a generated 9-document UK AI compliance pack for risk, completeness, and cross-document consistency BEFORE it is delivered to the customer.

CUSTOMER TIER: ${intake.tier}

${companyProfileBlock(intake)}

DECLARED AI TOOLS (intake):
${formatAiTools(intake.aiTools)}

DECLARED VENDORS (intake):
${formatVendors(intake.vendors)}

DECLARED RISK FLAGS (intake):
${intake.riskFlags.length === 0
    ? '  (No risk flags declared)'
    : intake.riskFlags
        .map(
          (f, i) =>
            `${i + 1}. [${f.severity}] ${f.explanation}${f.required_action ? ' — action: ' + f.required_action : ''}`,
        )
        .join('\n')}

OVERALL RISK LEVEL (intake): ${intake.riskLevel}
EU CUSTOMERS: ${intake.hasEuCustomers ? 'Yes' : 'No'}${intake.euRevenuePercentage ? ` (~${intake.euRevenuePercentage}% of revenue)` : ''}

GENERATED DOCUMENT SLICE (token-lean, vital tables/sections only):
${docsBlock}

YOU MUST PERFORM THESE 6 CORE CHECKS:

1. INTAKE COMPLETENESS — Does the intake have enough information to defensibly generate the pack? Flag any structural gaps (no AI tools declared but pack references AI use; no vendors declared but cross-border transfers asserted; no contact email; etc.).

2. RISK CLASSIFICATION — Does the AI Risk Register (and DPIA-Lite) accurately reflect the declared AI tools' EU AI Act risk classifications and the declared risk flags? Flag any tool whose declared classification is 'high' or 'unacceptable' but does not appear with proportionate mitigation in the register. Flag any 'critical' intake risk flag that is absent from the register.

3. CROSS-DOCUMENT CONSISTENCY — The 9 documents must agree with each other:
   - The AI Use Statement's ai_systems_table must list the same tools that appear in the Internal AI Use Policy and Risk Register.
   - The Vendor AI Register must include every vendor referenced anywhere else (privacy notice transfers, risk register, procurement memo).
   - The Privacy Notice Addendum's international_transfers_text must be consistent with the vendor jurisdictions and DPA statuses.
   - The Procurement Response Memo's documentation_index_table must list all 9 documents and reference them coherently.
   - Contact name/role/email must be the same wherever it appears.

4. REGULATORY MAPPING — UK GDPR, EU AI Act (Regulation 2024/1689), and UK Data (Use and Access) Act 2025 obligations must be addressed: Article 13/14 (privacy notice content), Article 30 (records of processing), Article 22 (automated decisions), Article 50 EU AI Act (transparency), Annex III high-risk systems, DUAA Section 103 (complaints). Flag missing or wrongly attributed citations.

5. PROCUREMENT-READINESS — Is the pack actually usable to respond to an enterprise vendor questionnaire? The Procurement Response Memo must have a coherent executive summary, a compliance snapshot mapping to the other documents, and a contacts table.${procurementRule}

6. RED-FLAG ESCALATION — Identify anything that should NOT ship without human review: undeclared high-risk or unacceptable-risk AI systems, vendors with 'not_in_place' DPA status processing personal data, unresolved 'critical' risk flags, regulated-sector indicators (legal, healthcare, financial advice) that suggest specialist routing is required, or any content that appears legally unsafe.

CALIBRATION — WHAT IS *NOT* A RED FLAG (this is critical to get right):
ReadyPack exists to take a business that is NOT YET compliant and give it the documents and action plan to BECOME compliant. So a customer having OPEN, FORWARD-LOOKING remediation actions is the EXPECTED, NORMAL baseline — it is the entire reason they bought the pack. Do NOT raise red_flags, and do NOT escalate, merely because the customer has not yet completed an action the pack itself prescribes. The following are EXPECTED and belong in the AI Risk Register as action items — they are NOT red_flags and NOT grounds for escalation:
- Transparency/disclosure notices "not yet live", not yet published, or pending deployment (the pack provides them).
- Transfer Impact Assessments (TIAs) or Legitimate Interests Assessments (LIAs) "in progress", "to be completed", "being finalised", or "available on request" (the pack provides the templates).
- A privacy notice, ROPA, or policy newly created by this pack and not yet published to customers.
- Inventories, logs, or registers the pack recommends building that do not yet exist.
- Certifications (ISO 27001, SOC 2, ISO 42001) described as "on the roadmap", "targeted", or aspirational.
- Any item whose only issue is "confirm the customer has done X" where X is a remediation step the pack assigns with a future deadline.
Surface these inside the documents as remediation actions; NEVER treat them as a reason to withhold the pack. A pack whose only concerns are forward-looking remediation actions of this kind should be APPROVED.

ONLY escalate (or specialist_route) for a GENUINE problem that makes the pack unsafe or defective to ship, i.e. one of:
- A real PACK DEFECT: two documents materially contradict each other; a document is missing; a risk classification is plainly wrong; a cited document number/title does not correspond to a real document in the index.
- An undeclared HIGH-risk or UNACCEPTABLE-risk AI system (EU AI Act Annex III / Article 5).
- A vendor with DPA status 'not in place' that is actually processing personal data (a real safeguard gap — not a paperwork-in-progress note).
- An unresolved 'critical' intake risk flag.
- A regulated-sector indicator (legal, healthcare, financial advice, biometrics, children's data at scale) that genuinely needs a specialist.
- Content that is legally incorrect or unsafe as written.

OUTPUT FORMAT — RESPOND WITH ONLY THIS JSON OBJECT. NO MARKDOWN. NO CODE FENCES. NO PREAMBLE. NO COMMENTARY.

{
  "completeness_score": number between 0 and 100 (100 = no missing information),
  "risk_score": number between 0 and 100 (0 = no residual risk, 100 = unsafe to ship),
  "consistency_issues": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "documents_involved": ["document_type", "..."],
      "issue": "short description of the inconsistency",
      "evidence": "the specific value(s) that disagree"
    }
  ],
  "missing_info": [
    {
      "field": "the missing field or topic",
      "where": "document_type or 'intake'",
      "why_it_matters": "short rationale"
    }
  ],
  "red_flags": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "category": "high_risk_ai" | "vendor_dpa" | "regulated_sector" | "automated_decisions" | "transfers" | "transparency" | "other",
      "explanation": "what is wrong",
      "recommended_action": "what a human should do"
    }
  ],
  "recommended_action": "approve" | "request_more_info" | "escalate" | "specialist_route",
  "human_escalation_required": true | false
}

RECOMMENDED_ACTION RULES:
- "approve" — completeness_score >= 85, risk_score <= 25, no genuine 'critical' or 'high' red_flags (per the CALIBRATION above — forward-looking remediation actions are NOT red_flags), and no 'critical' consistency_issues. This is the correct verdict for a normal self-serve pack whose only open items are the remediation actions it prescribes.
- "request_more_info" — there are missing_info entries blocking confident generation but no safety concerns.
- "escalate" — a GENUINE 'high' or 'critical' red_flag exists (a real pack defect or unsafe/mis-declared situation as defined in the CALIBRATION section — do NOT count expected forward-looking remediation actions) OR risk_score > 60. Set human_escalation_required = true.
- "specialist_route" — a regulated-sector red_flag is present (legal, healthcare, financial advice, children's data at scale, biometrics). Set human_escalation_required = true.

CRITICAL: Output ONLY the raw JSON object. Strictly valid JSON. No trailing commas. No comments. No \`\`\`json wrapper.`
}
