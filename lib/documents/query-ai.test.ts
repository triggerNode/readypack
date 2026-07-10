import { describe, it, expect } from 'vitest'
import { sanitiseDraftedQuestion, parseDocCheck } from './query-ai'

const FALLBACK = 'Please confirm one detail in your review portal.'

describe('sanitiseDraftedQuestion', () => {
  it('accepts a clean, well-formed question', () => {
    const q = 'Do you have a signed DPA with this vendor, or can you confirm the plan you are on?'
    expect(sanitiseDraftedQuestion(q, FALLBACK)).toBe(q)
  })
  it('collapses whitespace', () => {
    expect(sanitiseDraftedQuestion('  Do you   have\na DPA?  ', FALLBACK)).toBe('Do you have a DPA?')
  })
  it('falls back when the question leaks internal wording', () => {
    expect(sanitiseDraftedQuestion('We raised a flag on your risk score, please confirm the DPA.', FALLBACK)).toBe(
      FALLBACK,
    )
    expect(sanitiseDraftedQuestion('This needs escalation — do you have a DPA?', FALLBACK)).toBe(FALLBACK)
  })
  it('falls back when empty or absurdly long', () => {
    expect(sanitiseDraftedQuestion('   ', FALLBACK)).toBe(FALLBACK)
    expect(sanitiseDraftedQuestion('x'.repeat(600), FALLBACK)).toBe(FALLBACK)
  })
})

describe('parseDocCheck', () => {
  it('reads a pass verdict', () => {
    expect(parseDocCheck('{"verdict":"pass","reason":"consistent"}')).toEqual({
      status: 'passed',
      note: 'consistent',
    })
  })
  it('reads a flag verdict', () => {
    expect(parseDocCheck('{"verdict":"flag","reason":"placeholder left in"}').status).toBe('flagged')
  })
  it('treats an unknown verdict as flagged (fail safe)', () => {
    expect(parseDocCheck('{"verdict":"maybe"}').status).toBe('flagged')
  })
  it('tolerates code fences / prose around the JSON', () => {
    expect(parseDocCheck('```json\n{"verdict":"pass","reason":"ok"}\n```').status).toBe('passed')
  })
})
