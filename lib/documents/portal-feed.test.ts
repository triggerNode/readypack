import { describe, it, expect } from 'vitest'
import {
  computeCardState,
  buildPortalFeed,
  type CardStateInput,
  type PortalDocRow,
} from './portal-feed'
import { DOC_ORDER } from './doc-catalog'

// A baseline card-state input: a generated, QA-passed, released draft. Tests
// override only the fields under test (Arrange-Act-Assert).
function input(over: Partial<CardStateInput> = {}): CardStateInput {
  return {
    rowExists: true,
    qaStatus: 'passed',
    deliveryStatus: 'pending',
    isRevised: false,
    hasOpenInfoRequest: false,
    released: true,
    jobStatus: 'completed',
    phaseIndex: 4,
    ...over,
  }
}

describe('computeCardState', () => {
  it('returns queued when no row exists and drafting has not started', () => {
    expect(
      computeCardState(input({ rowExists: false, jobStatus: 'queued', phaseIndex: 1 })),
    ).toBe('queued')
  })

  it('returns drafting when no row exists but the job is running', () => {
    expect(
      computeCardState(input({ rowExists: false, jobStatus: 'running', phaseIndex: 2 })),
    ).toBe('drafting')
  })

  it('returns drafting when no row exists but the phase has reached drafting', () => {
    // Job status unknown/stale, but the tracker says we are drafting.
    expect(
      computeCardState(input({ rowExists: false, jobStatus: null, phaseIndex: 2 })),
    ).toBe('drafting')
  })

  it('returns qa for any generated document not yet released, regardless of qa_status', () => {
    // Pre-release, a row that exists is "with our team" whatever its qa_status.
    expect(computeCardState(input({ qaStatus: 'pending', released: false }))).toBe('qa')
    expect(computeCardState(input({ qaStatus: 'passed', released: false }))).toBe('qa')
    expect(computeCardState(input({ qaStatus: 'flagged', released: false }))).toBe('qa')
  })

  it('returns draft once released, regardless of qa_status (real-data lesson)', () => {
    // Validated against the completed order 3c3f2277…: docs ship delivered with
    // qa_status still 'flagged'/'pending'. qa_status is NOT a review gate, so a
    // released-but-unapproved doc must be a reviewable draft, not stuck in "qa".
    expect(computeCardState(input({ qaStatus: 'passed', released: true }))).toBe('draft')
    expect(computeCardState(input({ qaStatus: 'flagged', released: true }))).toBe('draft')
    expect(computeCardState(input({ qaStatus: 'pending', released: true }))).toBe('draft')
  })

  it('returns flagged when an open info-request is attached, regardless of qa', () => {
    expect(
      computeCardState(input({ hasOpenInfoRequest: true, qaStatus: 'flagged' })),
    ).toBe('flagged')
    // Even a passed+released doc with an open question is actionable, not a draft.
    expect(
      computeCardState(input({ hasOpenInfoRequest: true, qaStatus: 'passed', released: true })),
    ).toBe('flagged')
  })

  it('returns revision when the document is in revision', () => {
    expect(computeCardState(input({ deliveryStatus: 'in_revision' }))).toBe('revision')
  })

  it('returns final when the document is delivered', () => {
    expect(computeCardState(input({ deliveryStatus: 'delivered' }))).toBe('final')
  })

  it('returns failed when delivery or qa failed (failure wins over everything)', () => {
    expect(computeCardState(input({ deliveryStatus: 'failed' }))).toBe('failed')
    expect(computeCardState(input({ qaStatus: 'failed' }))).toBe('failed')
    // Failure takes precedence even if an info-request is open.
    expect(
      computeCardState(input({ qaStatus: 'failed', hasOpenInfoRequest: true })),
    ).toBe('failed')
  })

  it('keeps final/revision authoritative even before release', () => {
    expect(computeCardState(input({ deliveryStatus: 'delivered', released: false }))).toBe('final')
    expect(
      computeCardState(input({ deliveryStatus: 'in_revision', released: false })),
    ).toBe('revision')
  })
})

// ── buildPortalFeed ────────────────────────────────────────────────────────

function row(over: Partial<PortalDocRow> & { documentType: PortalDocRow['documentType'] }): PortalDocRow {
  return {
    qaStatus: 'passed',
    deliveryStatus: 'pending',
    pageCount: 4,
    isRevised: false,
    fileUrl: null,
    downloadUrl: null,
    ...over,
  }
}

const generatingPack = {
  pack: {
    deliveryStatus: 'generating',
    jobStatus: 'running',
    jobStartedAt: new Date().toISOString(),
    docsReady: 0,
    docsFinal: 0,
    docsInRevision: 0,
    openInfoRequests: 0,
    released: false,
  },
  docRows: [] as PortalDocRow[],
  infoRequests: [],
  released: false,
  jobStatus: 'running',
}

describe('buildPortalFeed', () => {
  it('always returns all nine documents in canonical order', () => {
    const feed = buildPortalFeed(generatingPack)
    expect(feed.docs).toHaveLength(9)
    expect(feed.docs.map((d) => d.documentType)).toEqual(DOC_ORDER)
  })

  it('shows every card as drafting while generation runs and no rows exist', () => {
    const feed = buildPortalFeed(generatingPack)
    expect(feed.docs.every((d) => d.cardState === 'drafting')).toBe(true)
    expect(feed.docs.every((d) => d.deliveryStatus === 'absent')).toBe(true)
  })

  it('wakes only the documents whose rows exist, leaving the rest queued/drafting', () => {
    const feed = buildPortalFeed({
      ...generatingPack,
      docRows: [
        row({ documentType: 'ai_use_statement', qaStatus: 'pending' }),
        row({ documentType: 'privacy_notice_addendum', qaStatus: 'pending' }),
      ],
    })
    const byType = new Map(feed.docs.map((d) => [d.documentType, d.cardState]))
    expect(byType.get('ai_use_statement')).toBe('qa')
    expect(byType.get('privacy_notice_addendum')).toBe('qa')
    // A document with no row yet is still drafting (job running).
    expect(byType.get('ai_risk_register')).toBe('drafting')
  })

  it('flags the exact card carrying an open document-scoped info-request', () => {
    const feed = buildPortalFeed({
      pack: {
        deliveryStatus: 'escalated',
        jobStatus: 'completed',
        jobStartedAt: null,
        docsReady: 9,
        docsFinal: 0,
        docsInRevision: 0,
        openInfoRequests: 1,
        released: false,
      },
      docRows: DOC_ORDER.map((documentType) => row({ documentType, qaStatus: 'passed' })),
      infoRequests: [
        {
          id: 'req-1',
          documentType: 'dpia_lite',
          prompt: 'Confirm your retention period.',
          options: [],
          status: 'open',
        },
      ],
      released: false,
      jobStatus: 'completed',
    })
    const byType = new Map(feed.docs.map((d) => [d.documentType, d.cardState]))
    expect(byType.get('dpia_lite')).toBe('flagged')
    // Other passed-but-not-released docs are in QA, not flagged.
    expect(byType.get('ai_use_statement')).toBe('qa')
    // The tracker and the cards came from one build — phase reflects the action.
    expect(feed.phase.state).toBe('action')
  })

  it('passes the phase through from computePackState', () => {
    const feed = buildPortalFeed(generatingPack)
    expect(feed.phase.state).toBe('progress')
    expect(feed.phase.docsTotal).toBe(9)
  })

  it('does not mutate or drop a top-level (case-wide) info-request', () => {
    const feed = buildPortalFeed({
      ...generatingPack,
      infoRequests: [
        { id: 'top', documentType: null, prompt: 'About your business', options: [], status: 'open' },
      ],
    })
    expect(feed.infoRequests).toHaveLength(1)
    // A null-documentType request flags no specific card.
    expect(feed.docs.some((d) => d.cardState === 'flagged')).toBe(false)
  })
})
