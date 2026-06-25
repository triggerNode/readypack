// lib/documents/portal-feed.ts
//
// The single source of truth for the unified customer portal (design brief 14:
// prompts/claude-design/14-unified-portal-progress.md). One DB read produces ONE
// object — the phase tracker state AND every document card's lifecycle state AND
// the open info-requests — so the tracker and the cards can never tell two
// different stories. A revision flips the phase and the card together because
// they are derived from the same read.
//
// Pure and dependency-free (no Supabase, no signing) so it is unit-testable and
// reusable by both the SSR portal page and the polling API route. URL signing
// and DB access are the caller's job; this module only maps rows -> states.

import type { DocumentType, QaStatus, DocDeliveryStatus } from '@/types/database'
import { DOC_ORDER } from './doc-catalog'
import { computePackState, type PackStatus, type PackStatusInputs } from './pack-status'

// ── Card lifecycle states (design brief 14, section 4) ──────────────────────
// queued   — asleep placeholder; the document's row doesn't exist yet
// drafting — being written now (job running, row not yet created)
// qa       — drafted; passing through / awaiting quality assurance (pre-release)
// flagged  — has an open customer-facing question (info_request) on this card
// draft    — released to the customer; awaiting their review (watermarked)
// revision — customer requested changes; with our team
// final    — approved + un-watermarked; downloadable
// failed   — generation/QA failed outright; honest error rather than a frozen card
export type CardState =
  | 'queued'
  | 'drafting'
  | 'qa'
  | 'flagged'
  | 'draft'
  | 'revision'
  | 'final'
  | 'failed'

// The minimal per-document facts the state machine needs. `rowExists` is false
// before the document has been generated (no generated_documents row yet).
export interface CardStateInput {
  rowExists: boolean
  qaStatus: QaStatus | null
  deliveryStatus: DocDeliveryStatus | null
  isRevised: boolean
  /** An open (customer-facing) info_request is attached to THIS document. */
  hasOpenInfoRequest: boolean
  /** The pack has been released to the customer for review (a delivery email
   *  was sent). Before release a passed doc is still "with our team", not a
   *  customer-reviewable draft. */
  released: boolean
  /** Latest generation job status: 'queued' | 'running' | 'completed' | 'failed' | null. */
  jobStatus: string | null
  /** The tracker phase index (from computePackState) — disambiguates queued vs
   *  drafting for documents whose row does not exist yet. */
  phaseIndex: number
}

// Phase index at which drafting is visibly underway (PACK_PHASES: 2 = "Drafting
// your documents"). Below this we are still "Reviewing your answers".
const DRAFTING_PHASE = 2

// Map one document's real columns onto its card lifecycle state. Precedence
// mirrors computePackState: terminal/with-us states win, then released review,
// then the pre-generation queued/drafting reveal.
export function computeCardState(input: CardStateInput): CardState {
  const {
    rowExists,
    qaStatus,
    deliveryStatus,
    hasOpenInfoRequest,
    released,
    jobStatus,
    phaseIndex,
  } = input

  // 1. Hard failures — honest error state (brief 4.7).
  if (deliveryStatus === 'failed' || qaStatus === 'failed') return 'failed'

  // 2. Terminal: approved + un-watermarked.
  if (deliveryStatus === 'delivered') return 'final'

  // 3. With our team for the customer's requested changes.
  if (deliveryStatus === 'in_revision') return 'revision'

  // 4. The document hasn't been generated yet — asleep or actively drafting.
  if (!rowExists) {
    const drafting = jobStatus === 'running' || phaseIndex >= DRAFTING_PHASE
    return drafting ? 'drafting' : 'queued'
  }

  // 5. A row exists. An open customer-facing question takes the card to the
  //    actionable "flagged" state.
  if (hasOpenInfoRequest) return 'flagged'

  // 6. Released to the customer → reviewable draft.
  //    NOTE: we deliberately do NOT gate on qa_status. Validated against the
  //    real completed order (3c3f2277…): documents ship as 'delivered' with
  //    qa_status still 'flagged' or 'pending' — qa_status is an internal QA
  //    annotation that frequently never flips to 'passed'. Using it as a review
  //    gate would hide reviewable drafts from a customer after release. The
  //    authoritative "the customer may review this" signal is `released` (a
  //    delivery email was sent) plus the per-doc delivery_status handled above.
  if (released) return 'draft'

  // 7. Generated but not yet released to the customer — still with our team,
  //    moving through internal review / quality assurance.
  return 'qa'
}

// One document's slice of the feed. Display metadata (title/icon/reg/...) is NOT
// included — the client merges it from the static DOC_CATALOG by documentType so
// the payload stays lean on every poll. URLs are signed by the caller.
export interface PortalDocFeed {
  documentType: DocumentType
  cardState: CardState
  /** 'absent' when no generated_documents row exists yet. */
  deliveryStatus: DocDeliveryStatus | 'absent'
  qaStatus: QaStatus | null
  isRevised: boolean
  pageCount: number | null
  /** Signed inline-preview URL (null until final/available). */
  fileUrl: string | null
  /** Signed download-disposition URL. */
  downloadUrl: string | null
}

export interface PortalInfoRequestFeed {
  id: string
  documentType: DocumentType | null
  prompt: string
  options: string[]
  status: 'open' | 'submitted' | 'resolved' | 'cancelled'
}

// The whole-page payload: tracker phase + all nine cards + the info-requests.
export interface PortalFeed {
  phase: PackStatus
  docs: PortalDocFeed[]
  infoRequests: PortalInfoRequestFeed[]
}

// One row as the caller hands it in (already signed). file_url/downloadUrl are
// the signed values (or null); render_metadata carries the `revised` flag.
export interface PortalDocRow {
  documentType: DocumentType
  qaStatus: QaStatus | null
  deliveryStatus: DocDeliveryStatus | null
  pageCount: number | null
  isRevised: boolean
  fileUrl: string | null
  downloadUrl: string | null
}

export interface BuildPortalFeedInput {
  /** Inputs for the phase tracker (the existing computePackState contract). */
  pack: PackStatusInputs
  /** Generated-document rows that exist, keyed later by documentType. Docs with
   *  no row are rendered as queued/drafting placeholders. */
  docRows: PortalDocRow[]
  infoRequests: PortalInfoRequestFeed[]
  /** Whether the pack has been released to the customer (delivery email sent). */
  released: boolean
  /** Latest generation job status, for the queued/drafting reveal. */
  jobStatus: string | null
}

// Assemble the unified feed. Always returns all nine documents in canonical
// order (DOC_ORDER), so the cards exist from the very first paint — they simply
// start "queued" and wake up as their rows appear.
export function buildPortalFeed(input: BuildPortalFeedInput): PortalFeed {
  const phase = computePackState(input.pack)

  const rowByType = new Map<DocumentType, PortalDocRow>()
  for (const row of input.docRows) rowByType.set(row.documentType, row)

  // Open, document-scoped info-requests flag their card.
  const openFlaggedTypes = new Set<DocumentType>()
  for (const req of input.infoRequests) {
    if (req.status === 'open' && req.documentType) openFlaggedTypes.add(req.documentType)
  }

  const docs: PortalDocFeed[] = DOC_ORDER.map((documentType) => {
    const row = rowByType.get(documentType)
    const rowExists = row !== undefined
    const cardState = computeCardState({
      rowExists,
      qaStatus: row?.qaStatus ?? null,
      deliveryStatus: row?.deliveryStatus ?? null,
      isRevised: row?.isRevised ?? false,
      hasOpenInfoRequest: openFlaggedTypes.has(documentType),
      released: input.released,
      jobStatus: input.jobStatus,
      phaseIndex: phase.phaseIndex,
    })
    return {
      documentType,
      cardState,
      deliveryStatus: row?.deliveryStatus ?? 'absent',
      qaStatus: row?.qaStatus ?? null,
      isRevised: row?.isRevised ?? false,
      pageCount: row?.pageCount ?? null,
      fileUrl: row?.fileUrl ?? null,
      downloadUrl: row?.downloadUrl ?? null,
    }
  })

  return { phase, docs, infoRequests: input.infoRequests }
}
