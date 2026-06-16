import Anthropic from '@anthropic-ai/sdk'

if (process.env.ANTHROPIC_ZDR_VERIFIED !== 'true') {
  throw new Error(
    'Assertion Failure: Zero Data Retention (ZDR) configuration is not verified at the console/organization level. API execution aborted.',
  )
}

// Bound every request. The SDK defaults (10-min timeout × 2 retries) let a slow
// document call — notably the procurement-tier `procurement_response_memo`
// (40-question Q&A bank, 12k-token output) — hang the SYNCHRONOUS generation
// request with no exception. That left the job stuck `running` and the order
// stuck `generating`, and the per-document failure handler never fired because
// nothing threw (Smoke Test 2 finding ST2-5). With an explicit per-request
// timeout + a single retry, a stalled call now throws promptly; the generation
// loop's per-document catch logs a `failed` event and the run finalises as
// `escalated` (8 of 9, 1 failed) instead of wedging. The deeper completion fix
// (shrink the memo / move generation to the background queue, #7) is tracked
// separately.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 240_000, // 4 min/request — well above a normal doc, below an infinite hang
  maxRetries: 1,
})
