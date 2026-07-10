// Builds the "What we noticed" read-me model from a pack's deterministic flags.
//
// Pure + total (types + the curated copy map only) so it is unit-testable and can
// never drift. One item per flag CODE that fired (deduplicated — e.g. several
// non-UK vendors collapse to one vendor_dpa item), rendered in a fixed order, with
// the accept/remediate cover chosen from the human sign-off. A pack that raised
// nothing still gets a reassuring lead. The interactive query still rides the
// portal (info-request) — the read-me only points at it.

import { DOCUMENT_TYPE_NUMBERS, DOCUMENT_TYPE_TITLES } from './content-schemas'
import { READ_ME_COPY, READ_ME_CODE_ORDER, type CoverCopy } from './readme-copy'
import type { RiskFlagCode } from '@/lib/risk/score'
import type { RiskFlagResolutionType } from '@/types/database'

export type ReadmeDocRef = { num: string; title: string }
export type ReadmeItem = { fact: string; cover: string; refs: ReadmeDocRef[] }
export type ReadmeModel = {
  companyName: string
  lead: string
  items: ReadmeItem[]
  /** Points the customer at the review portal — only when a query is genuinely open. */
  portalNote: string | null
  guardrail: string
}

export type ReadmeFlagInput = { code: RiskFlagCode | null; resolutionType: RiskFlagResolutionType | null }

const GUARDRAIL =
  'Every point above comes straight from your own answers and maps to a fixed section of this pack. We don’t invent findings. The same answers always produce the same pack, so you can rely on what it says.'

function leadFor(companyName: string, hasItems: boolean): string {
  if (!hasItems) {
    return `We built this pack around the answers you gave us. Nothing in your setup raised a specific flag, so your pack simply covers the standard AI and data-governance bases for a business like ${companyName}.`
  }
  return `We built this pack around the answers you gave us. Below is what stood out about how ${companyName} uses AI and data, and for each point the part of your pack that covers it. Nothing here needs anything from you unless we say so.`
}

const PORTAL_NOTE =
  'We also asked you to confirm one thing so we can finish that part of your pack. Please answer it in your review portal. It only takes a moment.'

// A held flag's cover has an accept/remediate variant; everything else is a plain
// string. Default to the accept wording unless the human explicitly remediated.
function resolveCover(cover: CoverCopy, resolutionType: RiskFlagResolutionType | null): string {
  if (typeof cover === 'string') return cover
  return resolutionType === 'remediate' ? cover.remediate : cover.accept
}

function docRef(dt: keyof typeof DOCUMENT_TYPE_NUMBERS): ReadmeDocRef {
  return { num: DOCUMENT_TYPE_NUMBERS[dt], title: DOCUMENT_TYPE_TITLES[dt] }
}

export function buildReadme(input: {
  companyName: string
  flags: ReadonlyArray<ReadmeFlagInput>
  hasOpenQuery: boolean
}): ReadmeModel {
  // Dedupe by code, keeping a resolution_type of accept/remediate if any flag of
  // that code carries one (so the held cover reflects the real decision).
  const resolutionByCode = new Map<RiskFlagCode, RiskFlagResolutionType | null>()
  for (const f of input.flags) {
    if (!f.code || !(f.code in READ_ME_COPY)) continue
    const existing = resolutionByCode.get(f.code)
    const prefer = f.resolutionType === 'accept' || f.resolutionType === 'remediate'
    if (!resolutionByCode.has(f.code) || (prefer && existing !== 'accept' && existing !== 'remediate')) {
      resolutionByCode.set(f.code, f.resolutionType)
    }
  }

  const items: ReadmeItem[] = []
  for (const code of READ_ME_CODE_ORDER) {
    if (!resolutionByCode.has(code)) continue
    const copy = READ_ME_COPY[code]
    items.push({
      fact: copy.fact,
      cover: resolveCover(copy.cover, resolutionByCode.get(code) ?? null),
      refs: copy.refs.map(docRef),
    })
  }

  return {
    companyName: input.companyName,
    lead: leadFor(input.companyName, items.length > 0),
    items,
    portalNote: input.hasOpenQuery ? PORTAL_NOTE : null,
    guardrail: GUARDRAIL,
  }
}
