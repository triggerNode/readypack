// lib/documents/qa-runner.ts
// Stage 6: QA Layer runner.
// Calls Haiku with a token-lean view of the generated docs, parses the JSON
// QaReport, writes qa_reports + generation_events.

import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildQaPrompt } from '@/lib/documents/prompts/qa-check'
import { parseModelJson } from '@/lib/documents/parse-model-json'
import type { PromptIntake } from '@/lib/documents/prompts/types'
import type { SpecificDocumentContent } from '@/lib/documents/content-schemas'
import type {
  DocumentType,
  QaRecommendation,
  QaReport,
} from '@/types/database'

const QA_MODEL = 'claude-haiku-4-5-20251001'
// Haiku 4.5 pricing per 1M tokens: $1.00 input, $5.00 output.
const COST_INPUT_PER_M = 1.0
const COST_OUTPUT_PER_M = 5.0

function calcCostUsd(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens * COST_INPUT_PER_M + completionTokens * COST_OUTPUT_PER_M) /
    1_000_000
  )
}

export interface QaRunResult {
  report: QaReport
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

const VALID_RECOMMENDATIONS: QaRecommendation[] = [
  'approve',
  'request_more_info',
  'escalate',
  'specialist_route',
]

function asRecommendation(v: unknown): QaRecommendation | null {
  if (typeof v !== 'string') return null
  return (VALID_RECOMMENDATIONS as string[]).includes(v)
    ? (v as QaRecommendation)
    : null
}

export async function runQaChecks(
  orderId: string,
  submissionId: string,
  orgId: string,
  intake: PromptIntake,
  generatedDocs: Partial<Record<DocumentType, SpecificDocumentContent>>,
): Promise<QaRunResult> {
  const prompt = buildQaPrompt(
    intake,
    generatedDocs as unknown as Record<string, unknown>,
  )

  let promptTokens = 0
  let completionTokens = 0
  let parsed: Record<string, unknown>

  try {
    const response = await anthropic.messages.create({
      model: QA_MODEL,
      // A premium 9-document pack produces a QA report larger than the old 4096
      // cap, which truncated mid-array and yielded invalid JSON the tolerant
      // parser cannot recover (the "QA layer failed: Expected ',' or ']'" crash).
      // The cap only bounds the ceiling — we are billed for tokens actually
      // produced — so a generous ceiling is free insurance against truncation.
      max_tokens: 12000,
      messages: [{ role: 'user', content: prompt }],
    })

    promptTokens = response.usage.input_tokens
    completionTokens = response.usage.output_tokens

    const textContent = response.content.find((c) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in QA response')
    }
    // Fail loudly on truncation rather than handing the parser a cut-off array.
    if (response.stop_reason === 'max_tokens') {
      throw new Error('QA report truncated at the 12000-token cap')
    }

    // Use the shared tolerant parser (strips code fences + recovers from
    // leading/trailing prose) rather than a strict JSON.parse, which previously
    // threw a SyntaxError and silently skipped the entire QA layer.
    parsed = parseModelJson(textContent.text, 'QA report') as Record<string, unknown>
  } catch (error) {
    // Log the failure so it is visible in generation_events, then rethrow so
    // the caller can decide how to surface it.
    await supabaseAdmin.from('generation_events').insert({
      order_id: orderId,
      document_type: 'qa_report',
      model: QA_MODEL,
      prompt_tokens: promptTokens || null,
      completion_tokens: completionTokens || null,
      cost_usd: calcCostUsd(promptTokens, completionTokens),
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown QA error',
      content_reused: false,
    })
    throw error
  }

  const completenessScore = asNumber(parsed.completeness_score)
  const riskScore = asNumber(parsed.risk_score)
  const consistencyIssues = asArray(parsed.consistency_issues)
  const missingInfo = asArray(parsed.missing_info)
  const redFlags = asArray(parsed.red_flags)
  const recommendation = asRecommendation(parsed.recommended_action)
  const llmHumanEscalation =
    typeof parsed.human_escalation_required === 'boolean'
      ? parsed.human_escalation_required
      : recommendation === 'escalate' || recommendation === 'specialist_route'

  // Deterministic override: any high or critical risk intake bypasses the LLM
  // verdict and forces human escalation. This propagates to case escalation
  // states and order statuses downstream.
  const deterministicEscalation =
    intake.riskLevel === 'critical' || intake.riskLevel === 'high'
  const humanEscalation = deterministicEscalation || llmHumanEscalation

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('qa_reports')
    .insert({
      submission_id: submissionId,
      org_id: orgId,
      completeness_score: completenessScore,
      risk_score: riskScore,
      consistency_issues: consistencyIssues,
      missing_info: missingInfo,
      red_flags: redFlags,
      recommended_action: recommendation,
      human_escalation_required: humanEscalation,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    throw new Error(
      'Failed to insert qa_report: ' + (insertError?.message || 'unknown'),
    )
  }

  const costUsd = calcCostUsd(promptTokens, completionTokens)
  await supabaseAdmin.from('generation_events').insert({
    order_id: orderId,
    document_type: 'qa_report',
    model: QA_MODEL,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
    status: 'success',
    content_reused: false,
  })

  return {
    report: inserted as QaReport,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: costUsd,
  }
}
