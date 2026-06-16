import { test, expect } from '@playwright/test'
import { PERSONAS } from './lib/personas'
import { scoreRisk } from '../lib/risk/score'

// ──────────────────────────────────────────────────────────────────────────
// FREE, FAST, no AI spend, no server interaction: run every persona's answers
// through the real scoreRisk source of truth and assert each lands on its
// target risk level. This is how Smoke Test 2 verifies risk routing for the
// low/medium personas without triggering paid auto-generation (submitting them
// through the live pipeline would fire /api/generate).
// ──────────────────────────────────────────────────────────────────────────

test.describe('Risk routing — all 10 personas land on target (scoreRisk unit)', () => {
  for (const p of PERSONAS) {
    test(`${p.company} → ${p.expectedRisk}`, async () => {
      const { riskLevel } = scoreRisk(p.answers)
      expect(riskLevel, `${p.company} risk level`).toBe(p.expectedRisk)

      // Gating contract: only low/medium auto-generate.
      const autoGen = riskLevel === 'low' || riskLevel === 'medium'
      expect(autoGen, `${p.company} auto-gen gating`).toBe(p.expectAutoGen)
    })
  }
})
