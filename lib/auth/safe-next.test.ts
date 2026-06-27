import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safe-next'

describe('safeNextPath', () => {
  it('passes through a same-origin absolute path', () => {
    expect(safeNextPath('/start')).toBe('/start')
    expect(safeNextPath('/portal/abc-123')).toBe('/portal/abc-123')
    expect(safeNextPath('/start?x=1')).toBe('/start?x=1')
  })

  it('falls back when next is missing', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })

  it('uses the provided fallback', () => {
    expect(safeNextPath(null, '/start')).toBe('/start')
    expect(safeNextPath('https://evil.com', '/start')).toBe('/start')
  })

  it('rejects absolute URLs (open redirect)', () => {
    expect(safeNextPath('https://evil.com')).toBe('/')
    expect(safeNextPath('http://evil.com/path')).toBe('/')
  })

  it('rejects protocol-relative and backslash hosts', () => {
    expect(safeNextPath('//evil.com')).toBe('/')
    expect(safeNextPath('/\\evil.com')).toBe('/')
  })

  it('rejects non-path values', () => {
    expect(safeNextPath('start')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })
})
