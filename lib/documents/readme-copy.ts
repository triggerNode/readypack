// Curated, customer-facing copy for the standalone "What we noticed" read-me.
//
// One friendly entry per deterministic flag rule (lib/risk/score.ts RiskFlagCode).
// This is a CURATED template, not AI generation — the same answers always produce
// the same read-me, which is the promise the guardrails footer makes. Buyer-facing
// and legally-toned: eyeball the wording before shipping.
//
//   fact  — plain English "here's what we spotted about you"
//   cover — what the pack does about it (+ which documents). For a HELD flag that a
//           human signed off, the cover has an accept vs remediate variant so the
//           read-me reflects the actual decision.
//   refs  — the pack documents that address it (rendered as numbered chips).

import type { DocumentType } from '@/types/database'
import type { RiskFlagCode } from '@/lib/risk/score'

/** A single cover line, or an accept/remediate pair for a signed-off held flag. */
export type CoverCopy = string | { accept: string; remediate: string }

export type ReadmeItemCopy = {
  fact: string
  cover: CoverCopy
  refs: DocumentType[]
}

export const READ_ME_COPY: Record<RiskFlagCode, ReadmeItemCopy> = {
  annex_iii_category: {
    fact: 'You use AI in a decision that affects people directly, such as screening or ranking applicants.',
    cover: {
      accept:
        'Under the EU AI Act this is a higher-risk use, so it needs care. Your pack records the lawful basis for it, keeps a person in every decision, and documents the assessment in a short, proportionate DPIA.',
      remediate:
        'Under the EU AI Act this is a higher-risk use. Following our review, your pack documents the change we agreed, keeps a person in every decision, and records the assessment in a short, proportionate DPIA.',
    },
    refs: ['dpia_lite', 'ai_risk_register', 'ai_use_statement'],
  },
  ai_decision_making: {
    fact: 'You use AI to help make decisions about individual people.',
    cover: {
      accept:
        'People have the right not to be subject to a purely automated decision. Your pack records that a person stays in the loop, sets out your lawful basis, and adds the Article 22 wording to your AI Use Statement.',
      remediate:
        'People have the right not to be subject to a purely automated decision. Following our review, your pack records the adjustment made so a person stays in the loop, and adds the Article 22 wording to your AI Use Statement.',
    },
    refs: ['ai_use_statement', 'dpia_lite', 'ai_risk_register'],
  },
  special_category: {
    fact: 'You handle sensitive personal information, such as health, biometric or children’s data.',
    cover: {
      accept:
        'Sensitive data carries stricter duties under UK GDPR Article 9. Your pack sets out the specific lawful basis for it and the safeguards you have in place, in your Privacy Notice Addendum and a short DPIA.',
      remediate:
        'Sensitive data carries stricter duties under UK GDPR Article 9. Following our review, your pack documents the safeguards now in place and the lawful basis, in your Privacy Notice Addendum and a short DPIA.',
    },
    refs: ['privacy_notice_addendum', 'dpia_lite'],
  },
  customer_facing_no_disclosure: {
    fact: 'You use AI in ways your customers can see, but don’t yet tell them about it.',
    cover:
      'AI-assisted interactions have to be disclosed. Your pack gives you an AI Use Statement that sets out your position, plus ready-to-paste disclosure lines for your website, emails and proposals.',
    refs: ['ai_use_statement', 'customer_disclosure_snippets'],
  },
  eu_ai_act_applicability: {
    fact: 'A good share of your customers are in the EU, and you use customer-facing AI.',
    cover:
      'That brings the EU AI Act’s transparency rules into play. Your pack covers the disclosure this requires in your AI Use Statement and the ready-to-use Customer Disclosure Snippets.',
    refs: ['ai_use_statement', 'customer_disclosure_snippets'],
  },
  vendor_dpa: {
    fact: 'Some of the AI tools you use are based outside the UK.',
    cover:
      'Sending data abroad carries stricter duties. Your Vendor AI Register and Privacy Notice Addendum record the transfer safeguards (the IDTA / UK Addendum) for each vendor.',
    refs: ['vendor_ai_register', 'privacy_notice_addendum'],
  },
  no_governance_owner: {
    fact: 'No single person is formally responsible for AI and data governance yet.',
    cover:
      'A named owner keeps this on track. Your Internal AI Use Policy recommends who should hold it and what the role involves. A small step that makes the rest stick.',
    refs: ['internal_ai_use_policy'],
  },
}

// Fixed display order — the most material governance points first, housekeeping last.
export const READ_ME_CODE_ORDER: readonly RiskFlagCode[] = [
  'annex_iii_category',
  'ai_decision_making',
  'special_category',
  'customer_facing_no_disclosure',
  'eu_ai_act_applicability',
  'vendor_dpa',
  'no_governance_owner',
]
