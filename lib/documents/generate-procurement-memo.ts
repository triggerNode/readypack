// lib/documents/generate-procurement-memo.ts
// ST2-5: chunked generation of the premium Procurement Response Memo.
//
// The 40-question Q&A bank is the only part large enough to risk the output
// cap (and it truncated every time at the old 12k cap). We generate the memo
// body without the bank, then generate the bank in grouped sub-calls (10 Q&A
// each) and merge. Every call stays well under the cap; the full 40-question
// premium value is preserved. Sums token usage across all calls so the caller's
// cost accounting is unchanged.

import { anthropic } from '@/lib/anthropic'
import { SYSTEM_PROMPT } from '@/lib/documents/prompts/system-prompt'
import { parseModelJson } from '@/lib/documents/parse-model-json'
import {
  buildBaseMemoPrompt,
  buildQaChunkPrompt,
  QA_CHUNK_GROUPS,
} from '@/lib/documents/prompts/procurement-memo'
import type { PromptIntake } from '@/lib/documents/prompts/types'

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const BASE_MAX_TOKENS = 6000
const CHUNK_MAX_TOKENS = 8000

interface QaPair {
  question: string
  answer: string
}

export interface ProcurementMemoResult {
  content: Record<string, unknown>
  promptTokens: number
  completionTokens: number
}

async function callModel(
  prompt: string,
  maxTokens: number,
  label: string,
): Promise<{ json: unknown; promptTokens: number; completionTokens: number }> {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error(`${label}: no text content in model response`)
  }
  // A max_tokens stop means the JSON was cut off — fail clearly here (each
  // chunk is sized to never hit this; if it does, the cap or grouping is wrong).
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`${label}: response truncated at the ${maxTokens}-token cap`)
  }
  return {
    json: parseModelJson(textContent.text, label),
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  }
}

export async function generateProcurementMemo(
  intake: PromptIntake,
  deeperTailoring: string,
): Promise<ProcurementMemoResult> {
  let promptTokens = 0
  let completionTokens = 0

  // 1. Memo body (no Q&A bank).
  const base = await callModel(
    buildBaseMemoPrompt(intake) + deeperTailoring,
    BASE_MAX_TOKENS,
    'procurement_response_memo (base)',
  )
  promptTokens += base.promptTokens
  completionTokens += base.completionTokens
  const content = (base.json && typeof base.json === 'object' ? base.json : {}) as Record<string, unknown>

  // 2. Q&A bank — grouped sub-calls, merged into one 40-item array.
  const qaBank: QaPair[] = []
  for (const group of QA_CHUNK_GROUPS) {
    const chunk = await callModel(
      buildQaChunkPrompt(intake, group),
      CHUNK_MAX_TOKENS,
      `procurement_response_memo (${group.label})`,
    )
    promptTokens += chunk.promptTokens
    completionTokens += chunk.completionTokens

    const obj = chunk.json as { procurement_qa_bank?: unknown }
    const arr = Array.isArray(obj?.procurement_qa_bank) ? obj.procurement_qa_bank : []
    for (const item of arr) {
      if (item && typeof item === 'object' && 'question' in item && 'answer' in item) {
        const pair = item as QaPair
        qaBank.push({ question: String(pair.question), answer: String(pair.answer) })
      }
    }
  }

  content.procurement_qa_bank = qaBank
  return { content, promptTokens, completionTokens }
}
