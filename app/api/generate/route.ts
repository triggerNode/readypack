// app/api/generate/route.ts
// Full document generation pipeline.
//
// Pipeline:
// 1. Validate request payload ({ order_id })
// 2. Create generation job record
// 3. Fetch intake + AI tools + vendors + risk flags + org + user + brand profile
// 4. For each of 9 document types:
//    a. Check content reuse engine (fingerprint match?)
//    b. If reuse hit → clone content_json, personalise → skip Claude
//    c. If no reuse → call Claude API with doc-specific prompt → parse JSON
//    d. Render PDF via ReactPdfRenderer (with DRAFT watermark)
//    e. Upload PDF to Supabase Storage
//    f. Insert generated_documents row with content_json, file_url, qa_status='pending'
//    g. Log generation_event (tokens, cost, reuse flag)
// 5. Update generation job status → 'completed'
// 6. Update order delivery_status → 'qa_review'

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ADMIN_EMAIL } from '@/lib/auth'
import { INTERNAL_SECRET_HEADER, verifyInternalSecret } from '@/lib/auth/internal-secret'
import { anthropic } from '@/lib/anthropic'
import { parseModelJson } from '@/lib/documents/parse-model-json'
import { generateProcurementMemo } from '@/lib/documents/generate-procurement-memo'
import { ReactPdfRenderer, type DocumentContent } from '@/lib/documents/renderer'
import { SYSTEM_PROMPT } from '@/lib/documents/prompts/system-prompt'
import {
  DOCUMENT_TYPE_ORDER,
  type SpecificDocumentContent,
} from '@/lib/documents/content-schemas'
import { runQaChecks } from '@/lib/documents/qa-runner'
import {
  buildFingerprint,
  fingerprintHash,
  findReusableContent,
  cloneAndPersonalise,
  deepReplacePlaceholders,
} from '@/lib/documents/content-reuse'
import type { DocumentType } from '@/types/database'
import type { PromptBuilder } from '@/lib/documents/prompts/types'
import { buildGenerationContext } from '@/lib/documents/generation-context'

import { buildPrompt as buildAiUseStatementPrompt } from '@/lib/documents/prompts/ai-use-statement'
import { buildPrompt as buildPrivacyNoticePrompt } from '@/lib/documents/prompts/privacy-notice'
import { buildPrompt as buildRiskRegisterPrompt } from '@/lib/documents/prompts/risk-register'
import { buildPrompt as buildDpiaLitePrompt } from '@/lib/documents/prompts/dpia-lite'
import { buildPrompt as buildInternalPolicyPrompt } from '@/lib/documents/prompts/internal-policy'
import { buildPrompt as buildDisclosureSnippetsPrompt } from '@/lib/documents/prompts/disclosure-snippets'
import { buildPrompt as buildVendorRegisterPrompt } from '@/lib/documents/prompts/vendor-register'
import { buildPrompt as buildComplaintsProcedurePrompt } from '@/lib/documents/prompts/complaints-procedure'
import { buildPrompt as buildProcurementMemoPrompt } from '@/lib/documents/prompts/procurement-memo'
import { sendDeliveryEmailForOrder, sendReviewHoldEmailForOrder } from '@/lib/documents/delivery-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 800s is the GA fluid-compute max on Vercel Pro/Enterprise. The full pipeline
// is ~5 min; this headroom keeps a synchronous run (admin manual + e2e + the
// cron worker) from being cut off. The durable backstop is the queued-job + cron
// model — a dead invocation resumes on the next tick (generation is idempotent).
export const maxDuration = 800

const PROMPT_BUILDERS: Record<DocumentType, PromptBuilder> = {
  ai_use_statement: buildAiUseStatementPrompt,
  privacy_notice_addendum: buildPrivacyNoticePrompt,
  ai_risk_register: buildRiskRegisterPrompt,
  dpia_lite: buildDpiaLitePrompt,
  internal_ai_use_policy: buildInternalPolicyPrompt,
  customer_disclosure_snippets: buildDisclosureSnippetsPrompt,
  vendor_ai_register: buildVendorRegisterPrompt,
  complaints_procedure_pack: buildComplaintsProcedurePrompt,
  procurement_response_memo: buildProcurementMemoPrompt,
}

const CLAUDE_MODEL = 'claude-sonnet-4-6'
// Pricing per 1M tokens: $3 input, $15 output
const COST_INPUT_PER_M = 3
const COST_OUTPUT_PER_M = 15

function calcCostUsd(promptTokens: number, completionTokens: number): number {
  return (promptTokens * COST_INPUT_PER_M + completionTokens * COST_OUTPUT_PER_M) / 1_000_000
}

// Output token ceiling per document. Most documents fit in 4096, but the
// longer ones (DPIA-Lite especially) were truncating at 4096 and returning
// unparseable JSON. The cap only bounds the maximum — we are billed for tokens
// actually produced — so a generous ceiling is free insurance against truncation.
const DEFAULT_MAX_OUTPUT_TOKENS = 8192
const MAX_OUTPUT_TOKENS_BY_DOC: Partial<Record<DocumentType, number>> = {
  dpia_lite: 12000,
  ai_risk_register: 12000,
  procurement_response_memo: 12000,
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      order_id?: string
      _internal?: boolean
    }
    const order_id = body.order_id

    if (!order_id) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    }

    // Auth guard. Either:
    //   • an authenticated admin (external request), OR
    //   • an internal trigger from this same deployment (queue kick / cron /
    //     admin repair), proven by a server-only shared secret header.
    // The secret can't be produced by an outside caller, so the _internal path
    // is no longer reachable by simply POSTing { _internal: true } to the site.
    const isInternalTrigger = body._internal === true
    if (isInternalTrigger) {
      if (!verifyInternalSecret(request.headers.get(INTERNAL_SECRET_HEADER))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // External request — must be the authenticated admin.
      const { getCurrentUser } = await import('@/lib/auth')
      const user = await getCurrentUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Fetch order
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch submission
    const { data: submission } = await supabaseAdmin
      .from('intake_submissions')
      .select('*')
      .eq('order_id', order_id)
      .single()

    if (!submission) {
      return NextResponse.json({ error: 'Intake submission not found' }, { status: 404 })
    }

    // Resumable idempotency. Load any documents already generated for this
    // submission. If all 9 exist, the pack is complete — return rather than
    // regenerating. If a partial set exists (a prior worker invocation died
    // mid-pack), keep them and only generate the MISSING ones below. The queue +
    // cron may re-invoke this worker, so it must converge, never duplicate.
    const { data: existingDocsData } = await supabaseAdmin
      .from('generated_documents')
      .select('document_type, content_json')
      .eq('submission_id', submission.id)

    const existingByType = new Map<DocumentType, SpecificDocumentContent>()
    for (const d of (existingDocsData ?? []) as Array<{
      document_type: DocumentType
      content_json: unknown
    }>) {
      existingByType.set(d.document_type, d.content_json as SpecificDocumentContent)
    }

    if (existingByType.size >= DOCUMENT_TYPE_ORDER.length) {
      const { data: existingJob } = await supabaseAdmin
        .from('document_generation_jobs')
        .select('id, status')
        .eq('submission_id', submission.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        already_generated: true,
        job_id: existingJob?.id ?? null,
        message: 'Documents already generated for this order.',
      })
    }

    // Fetch related data in parallel
    const [
      aiToolsResult,
      vendorsResult,
      riskFlagsResult,
      orgResult,
      userResult,
      brandResult,
    ] = await Promise.all([
      supabaseAdmin.from('ai_tools').select('*').eq('submission_id', submission.id),
      supabaseAdmin.from('vendors').select('*').eq('submission_id', submission.id),
      supabaseAdmin.from('risk_flags').select('*').eq('submission_id', submission.id),
      supabaseAdmin.from('organisations').select('*').eq('id', order.client_org_id).single(),
      supabaseAdmin.from('users').select('*').eq('id', order.user_id).single(),
      supabaseAdmin
        .from('brand_profiles')
        .select('*')
        .eq('org_id', order.client_org_id)
        .maybeSingle(),
    ])

    const aiTools = aiToolsResult.data || []
    const vendors = vendorsResult.data || []
    const riskFlags = riskFlagsResult.data || []
    const org = orgResult.data
    const user = userResult.data
    const brandProfile = brandResult.data

    // Claim an existing queued/running job for this submission (the durable
    // trigger enqueues a 'queued' job; the kick or cron re-invokes us), else
    // create one. Claiming avoids orphan duplicate jobs on the queue.
    const { data: claimable } = await supabaseAdmin
      .from('document_generation_jobs')
      .select('id, attempt_count')
      .eq('submission_id', submission.id)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let job: { id: string }
    if (claimable) {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from('document_generation_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          attempt_count: (claimable.attempt_count ?? 0) + 1,
        })
        .eq('id', claimable.id)
        .select('id')
        .single()
      if (updErr || !updated) {
        return NextResponse.json(
          { error: 'Failed to claim generation job: ' + (updErr?.message || 'unknown') },
          { status: 500 },
        )
      }
      job = updated
    } else {
      const { data: created, error: jobErr } = await supabaseAdmin
        .from('document_generation_jobs')
        .insert({
          order_id,
          submission_id: submission.id,
          org_id: order.client_org_id,
          status: 'running',
          started_at: new Date().toISOString(),
          attempt_count: 1,
        })
        .select('id')
        .single()
      if (jobErr || !created) {
        return NextResponse.json(
          { error: 'Failed to create generation job: ' + (jobErr?.message || 'unknown') },
          { status: 500 },
        )
      }
      job = created
    }

    // Update order delivery_status
    await supabaseAdmin
      .from('orders')
      .update({ delivery_status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', order_id)

    // Build fingerprint
    const normalised = (submission.normalised_answers || {}) as Record<string, unknown>
    const fingerprint = buildFingerprint(
      normalised,
      aiTools.length,
      vendors.length,
      submission.risk_level || 'low',
    )
    const fpHash = fingerprintHash(fingerprint)

    // Client data for personalisation + the LLM-facing PromptIntake. Shared with
    // the single-document regenerate path (lib/documents/generation-context.ts)
    // so the two never disagree on company name, dates, contact, or tailoring.
    const {
      intake,
      companyName,
      tradingName,
      contactName,
      contactRole,
      contactEmail,
      logoUrl,
      preparedDate,
      reviewDate,
      isPremiumTier,
      deeperTailoringInstruction,
      pseudonymReplacements,
    } = buildGenerationContext({
      normalised,
      aiTools,
      vendors,
      riskFlags,
      org,
      user,
      brandProfile,
      riskLevel: submission.risk_level ?? null,
      orderRecord: order as Record<string, unknown>,
    })

    const renderer = new ReactPdfRenderer()
    let totalTokens = 0
    let totalCost = 0
    let reusedCount = 0
    let docsGenerated = 0
    const failures: Array<{ document_type: DocumentType; error: string }> = []
    const generatedContent: Partial<Record<DocumentType, SpecificDocumentContent>> = {}
    // Seed with already-generated documents (resume case) so the QA step below
    // sees the full pack, not just the docs made in this invocation.
    existingByType.forEach((content, seededType) => {
      generatedContent[seededType] = content
    })

    for (const docType of DOCUMENT_TYPE_ORDER) {
      try {
        // Skip documents a prior (partial) run already produced — keep, don't redo.
        if (existingByType.has(docType)) {
          continue
        }
        let contentJson: SpecificDocumentContent
        let contentReused = false
        let promptTokens = 0
        let completionTokens = 0

        const reusableContent = await findReusableContent(docType, fpHash)

        if (reusableContent) {
          const oldMeta =
            ((reusableContent as unknown as Record<string, unknown>).render_metadata as
              | Record<string, unknown>
              | undefined) || {}
          const oldPersonalisation =
            (oldMeta.personalisation as Record<string, string> | undefined) || {
              companyName: (reusableContent as unknown as { prepared_for?: string })
                .prepared_for ?? '',
            }
          contentJson = cloneAndPersonalise(reusableContent, oldPersonalisation, {
            companyName,
            tradingName,
            contactEmail,
            contactName,
            contactRole,
            preparedDate,
            reviewDate,
          })
          contentReused = true
          reusedCount++
        } else if (docType === 'procurement_response_memo' && isPremiumTier) {
          // ST2-5: the premium 40-question memo is generated as a base call +
          // grouped Q&A sub-calls and merged, so no single call nears the output
          // cap (it truncated every time as one call). Tokens are summed inside.
          const memo = await generateProcurementMemo(intake, deeperTailoringInstruction)
          contentJson = memo.content as unknown as SpecificDocumentContent
          // Re-apply real PII into the placeholder slots the model received.
          contentJson = deepReplacePlaceholders(contentJson, pseudonymReplacements)
          promptTokens = memo.promptTokens
          completionTokens = memo.completionTokens
          totalTokens += promptTokens + completionTokens
          totalCost += calcCostUsd(promptTokens, completionTokens)
        } else {
          const userPrompt = PROMPT_BUILDERS[docType](intake) + deeperTailoringInstruction
          const maxTokens = MAX_OUTPUT_TOKENS_BY_DOC[docType] ?? DEFAULT_MAX_OUTPUT_TOKENS

          const response = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          })

          const textContent = response.content.find((c) => c.type === 'text')
          if (!textContent || textContent.type !== 'text') {
            throw new Error(`No text content in Claude response for ${docType}`)
          }
          // A max_tokens stop means the JSON was cut off — fail clearly here
          // rather than emitting an opaque parse error downstream.
          if (response.stop_reason === 'max_tokens') {
            throw new Error(`${docType}: response truncated at the ${maxTokens}-token cap`)
          }

          contentJson = parseModelJson(textContent.text, docType) as SpecificDocumentContent
          // Re-apply real PII into the placeholder slots the model received.
          contentJson = deepReplacePlaceholders(contentJson, pseudonymReplacements)
          promptTokens = response.usage.input_tokens
          completionTokens = response.usage.output_tokens
          totalTokens += promptTokens + completionTokens
          totalCost += calcCostUsd(promptTokens, completionTokens)
        }

        generatedContent[docType] = contentJson

        // Render PDF with DRAFT watermark
        const renderResult = await renderer.render(contentJson as unknown as DocumentContent, {
          showWatermark: true,
          logoUrl,
          companyName,
        })

        // Upload to Supabase Storage
        const fileName = `${order_id}/${docType}_v1_draft.pdf`
        const { error: uploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(fileName, renderResult.buffer, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadError) {
          console.error(`Upload error for ${docType}:`, uploadError)
        }

        // Persist the storage PATH, not a URL. The `documents` bucket is
        // private, so links are signed on demand at serve time (see
        // lib/documents/storage.ts). Storing a public URL here returns 400.

        // Insert generated_documents row
        await supabaseAdmin.from('generated_documents').insert({
          submission_id: submission.id,
          org_id: order.client_org_id,
          document_type: docType,
          version_number: 1,
          generated_at: new Date().toISOString(),
          qa_status: 'pending',
          delivery_status: 'pending',
          file_url: fileName,
          content_json: contentJson as unknown as Record<string, unknown>,
          template_version: '1.0.0',
          renderer: 'react_pdf',
          render_metadata: {
            watermarked: true,
            fingerprint_hash: fpHash,
            content_reused: contentReused,
            personalisation: {
              companyName,
              tradingName: tradingName || null,
              contactName,
              contactRole,
              contactEmail,
              preparedDate,
              reviewDate,
              // Persist the logo so the watermark-free re-render (finaliseOrderPack)
              // can restore it — without this the final PDFs lose the client logo.
              logoUrl: logoUrl || null,
            },
          },
          page_count: renderResult.page_count,
          file_size_bytes: renderResult.file_size_bytes,
        })

        // Log generation event
        await supabaseAdmin.from('generation_events').insert({
          order_id,
          document_type: docType,
          model: contentReused ? null : CLAUDE_MODEL,
          prompt_tokens: promptTokens || null,
          completion_tokens: completionTokens || null,
          cost_usd: contentReused ? 0 : calcCostUsd(promptTokens, completionTokens),
          status: 'success',
          content_reused: contentReused,
          pattern_id: contentReused ? fpHash : null,
        })

        docsGenerated++
      } catch (docError) {
        const message = docError instanceof Error ? docError.message : 'Unknown error'
        console.error(`Error generating ${docType}:`, docError)
        failures.push({ document_type: docType, error: message })
        await supabaseAdmin.from('generation_events').insert({
          order_id,
          document_type: docType,
          model: CLAUDE_MODEL,
          status: 'failed',
          error_message: message,
          content_reused: false,
        })
      }
    }

    // Hard stop: a run that produced zero documents is a FAILURE, not a
    // success. Previously the pipeline reported ok:true with 0 documents and
    // advanced the order to qa_review — which is exactly how the dead-model
    // outage stayed invisible for a month. Mark the job failed, leave the
    // order out of the delivery flow, and surface the reasons.
    if (existingByType.size + docsGenerated === 0) {
      const summary = failures.map((f) => `${f.document_type}: ${f.error}`).join('; ').slice(0, 1000)
      await supabaseAdmin
        .from('document_generation_jobs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: summary })
        .eq('id', job.id)
      await supabaseAdmin
        .from('orders')
        .update({ delivery_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', order_id)
      return NextResponse.json(
        {
          ok: false,
          error: 'No documents were generated',
          job_id: job.id,
          documents_generated: 0,
          documents_failed: failures.length,
          failures,
        },
        { status: 502 },
      )
    }

    // Stage 6: run QA layer on the generated content
    let qaReportId: string | null = null
    let qaRecommendation: string | null = null
    let qaHumanEscalation = false
    try {
      const qaResult = await runQaChecks(
        order_id,
        submission.id,
        order.client_org_id,
        intake,
        generatedContent,
      )
      qaReportId = qaResult.report.id
      qaRecommendation = qaResult.report.recommended_action
      qaHumanEscalation = qaResult.report.human_escalation_required

      // Map QA recommendation onto each generated document's qa_status.
      const newQaStatus: 'passed' | 'flagged' =
        qaRecommendation === 'approve' ? 'passed' : 'flagged'

      await supabaseAdmin
        .from('generated_documents')
        .update({ qa_status: newQaStatus })
        .eq('submission_id', submission.id)
    } catch (qaError) {
      console.error('QA layer failed:', qaError)
      // Do not block delivery if QA itself errored — leave qa_status='pending'
      // so a human or the dev re-trigger endpoint can replay.
    }

    // Update generation job status
    await supabaseAdmin
      .from('document_generation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update order delivery_status — escalate if QA flagged it OR any document
    // failed (a partial pack must never be mistaken for a complete one).
    const finalOrderStatus: 'escalated' | 'qa_review' =
      qaHumanEscalation || failures.length > 0 ? 'escalated' : 'qa_review'
    await supabaseAdmin
      .from('orders')
      .update({ delivery_status: finalOrderStatus, updated_at: new Date().toISOString() })
      .eq('id', order_id)

    // Auto-notify the customer for the SELF-SERVE path (low/medium risk that
    // auto-generated straight through). High/critical cases are HELD — an admin
    // clears the flags and RELEASES them, so they must not be emailed here. Only
    // fire on a clean qa_review (not escalated), skip if a delivery email already
    // went out (idempotent across retries), and never block the response on email.
    const isSelfServe = submission.risk_level === 'low' || submission.risk_level === 'medium'
    if (finalOrderStatus === 'qa_review' && isSelfServe) {
      const { count: priorDeliveries } = await supabaseAdmin
        .from('customer_communications')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', order_id)
        .eq('email_type', 'delivery')
      if (!priorDeliveries) {
        const mail = await sendDeliveryEmailForOrder(order_id)
        if (!mail.ok) console.error('[generate] auto delivery email failed:', mail.error)
      }
    } else if (finalOrderStatus === 'escalated' && isSelfServe) {
      // A self-serve (low/medium) pack the QA layer HELD for a final human
      // review. The customer has paid and submitted, so they must not be left in
      // silence — send a holding notice (no portal link yet; the real delivery
      // email with a secure link goes out when an admin releases the pack).
      // Idempotent (skip if a hold OR delivery email already went out) and never
      // blocks the response.
      const { count: priorHoldOrDelivery } = await supabaseAdmin
        .from('customer_communications')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', order_id)
        .in('email_type', ['escalation_notice', 'delivery'])
      if (!priorHoldOrDelivery) {
        const mail = await sendReviewHoldEmailForOrder(order_id)
        if (!mail.ok) console.error('[generate] review-hold email failed:', mail.error)
      }
    }

    return NextResponse.json({
      ok: true,
      job_id: job.id,
      documents_generated: docsGenerated,
      documents_failed: failures.length,
      failures,
      documents_reused: reusedCount,
      total_tokens: totalTokens,
      estimated_cost_usd: totalCost.toFixed(4),
      qa_report_id: qaReportId,
      qa_recommendation: qaRecommendation,
      human_escalation_required: qaHumanEscalation,
    })
  } catch (error) {
    console.error('Generation pipeline error:', error)
    return NextResponse.json(
      {
        error: 'Generation failed',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 },
    )
  }
}
