// lib/documents/portal-view.test.ts
//
// Tests the unified portal's "one source of truth" rule (design brief 14): the
// tracker and the cards must never tell two different stories. The acceptance
// test the brief calls out — "submit a revision → within one poll cycle the
// tracker animates back to the working phase AND the card flips to 'in
// revision,' together" — is proven here at the data layer: ONE buildPortalFeed
// read produces BOTH the in-revision card state AND the 'revising' overall
// state (which PackTracker renders as the rail animating back to "Drafting").

import { describe, it, expect } from 'vitest'
import { buildPortalFeed, type PortalDocRow } from './portal-feed'
import { DOC_ORDER } from './doc-catalog'
import { deriveOverall, type PortalCounts } from './portal-view'
import type { PackStatusInputs } from './pack-status'

// Build a PortalDocRow for a given document with a given delivery status.
function row(index: number, deliveryStatus: PortalDocRow['deliveryStatus']): PortalDocRow {
  return {
    documentType: DOC_ORDER[index],
    qaStatus: 'flagged', // real shipped docs keep qa_status 'flagged' — must be ignored
    deliveryStatus,
    pageCount: 4,
    isRevised: false,
    fileUrl: deliveryStatus === 'delivered' ? 'signed-url' : null,
    downloadUrl: deliveryStatus === 'delivered' ? 'signed-url?download=x' : null,
  }
}

// Tally the counts the client feeds deriveOverall, straight off the feed's card
// states — the same path the live client uses, so the test mirrors reality.
function countsFromFeed(docs: ReturnType<typeof buildPortalFeed>['docs']): PortalCounts {
  return {
    total: docs.length,
    finalCount: docs.filter((d) => d.cardState === 'final').length,
    revisionCount: docs.filter((d) => d.cardState === 'revision').length,
    awaitingCount: docs.filter((d) => d.cardState === 'draft').length,
  }
}

describe('deriveOverall — overall state machine', () => {
  const zero: PortalCounts = { total: 9, finalCount: 0, revisionCount: 0, awaitingCount: 9 }

  it('open info-requests win → action (even mid-generation)', () => {
    expect(deriveOverall('progress', zero, true)).toBe('action')
    expect(deriveOverall('action', zero, false)).toBe('action')
  })

  it('all documents final → complete', () => {
    expect(
      deriveOverall('partial', { total: 9, finalCount: 9, revisionCount: 0, awaitingCount: 0 }, false),
    ).toBe('complete')
  })

  it('specialist pre-release review → escalated', () => {
    expect(deriveOverall('review', zero, false)).toBe('escalated')
  })

  it('released with drafts still awaiting → ready', () => {
    expect(
      deriveOverall('released', { total: 9, finalCount: 0, revisionCount: 0, awaitingCount: 9 }, false),
    ).toBe('ready')
    // Mixed: some in revision but drafts still awaiting → still "ready" (there is
    // something to review), never hides the review CTA.
    expect(
      deriveOverall('partial', { total: 9, finalCount: 2, revisionCount: 1, awaitingCount: 6 }, false),
    ).toBe('ready')
  })

  it('released, nothing awaiting, something in revision → revising', () => {
    expect(
      deriveOverall('partial', { total: 9, finalCount: 8, revisionCount: 1, awaitingCount: 0 }, false),
    ).toBe('revising')
  })

  it('still generating, nothing actionable → preparing', () => {
    expect(deriveOverall('progress', zero, false)).toBe('preparing')
    expect(deriveOverall('delayed', zero, false)).toBe('preparing')
  })
})

describe('revision-sync acceptance: one read flips the card AND the tracker together', () => {
  it('a released pack with one doc in revision yields card=revision AND overall=revising', () => {
    // The customer approved 8 documents, then requested a change on the 9th.
    const docRows: PortalDocRow[] = DOC_ORDER.map((_, i) =>
      row(i, i === 2 ? 'in_revision' : 'delivered'),
    )
    const pack: PackStatusInputs = {
      deliveryStatus: 'qa_review',
      jobStatus: 'completed',
      jobStartedAt: null,
      docsReady: 9,
      docsFinal: 8,
      docsInRevision: 1,
      openInfoRequests: 0,
      released: true,
    }

    // ONE read.
    const feed = buildPortalFeed({ pack, docRows, infoRequests: [], released: true, jobStatus: 'completed' })

    // (a) the card flipped to "in revision"…
    const revisedCard = feed.docs.find((d) => d.documentType === DOC_ORDER[2])
    expect(revisedCard?.cardState).toBe('revision')
    expect(feed.docs.filter((d) => d.cardState === 'final')).toHaveLength(8)

    // …(b) and from the SAME read the overall state is "revising", which
    // PackTracker renders as the rail animating back to the working "Drafting"
    // node. Both come from this single buildPortalFeed call → never two stories.
    const overall = deriveOverall(feed.phase.state, countsFromFeed(feed.docs), false)
    expect(overall).toBe('revising')
  })

  it('the very first requested change (8 still in draft) keeps the review CTA up', () => {
    // Customer requests a change on doc #1 before approving anything else: the
    // tracker stays "ready" because there are still drafts to review — the card
    // for doc #1 still flips to revision in the same read.
    const docRows: PortalDocRow[] = DOC_ORDER.map((_, i) =>
      row(i, i === 0 ? 'in_revision' : 'pending'),
    )
    const pack: PackStatusInputs = {
      deliveryStatus: 'qa_review',
      jobStatus: 'completed',
      jobStartedAt: null,
      docsReady: 9,
      docsFinal: 0,
      docsInRevision: 1,
      openInfoRequests: 0,
      released: true,
    }
    const feed = buildPortalFeed({ pack, docRows, infoRequests: [], released: true, jobStatus: 'completed' })

    expect(feed.docs.find((d) => d.documentType === DOC_ORDER[0])?.cardState).toBe('revision')
    expect(feed.docs.filter((d) => d.cardState === 'draft')).toHaveLength(8)
    const overall = deriveOverall(feed.phase.state, countsFromFeed(feed.docs), false)
    expect(overall).toBe('ready')
  })
})
