import { describe, it, expect } from 'vitest'
import { isBlockingFlag } from './gate'
import type { RiskFlagSeverity, RiskFlagStatus } from '@/types/database'

// The pure rule behind the delivery gate: a flag blocks the pack from reaching the
// customer only while it is still OPEN and high/critical severity (i.e. it needs a
// human sign-off). Handled/low/medium/closed flags never gate.
describe('isBlockingFlag — the delivery-gate rule', () => {
  const severities: RiskFlagSeverity[] = ['low', 'medium', 'high', 'critical']
  const closedStatuses: RiskFlagStatus[] = ['acknowledged', 'resolved', 'escalated']

  it('blocks an OPEN high or critical flag', () => {
    expect(isBlockingFlag({ severity: 'high', status: 'open' })).toBe(true)
    expect(isBlockingFlag({ severity: 'critical', status: 'open' })).toBe(true)
  })

  it('does NOT block an open low or medium flag', () => {
    expect(isBlockingFlag({ severity: 'low', status: 'open' })).toBe(false)
    expect(isBlockingFlag({ severity: 'medium', status: 'open' })).toBe(false)
  })

  it('does NOT block a high/critical flag once it is no longer open', () => {
    for (const status of closedStatuses) {
      expect(isBlockingFlag({ severity: 'high', status })).toBe(false)
      expect(isBlockingFlag({ severity: 'critical', status })).toBe(false)
    }
  })

  it('only ever blocks on the open+high/critical combination', () => {
    for (const severity of severities) {
      for (const status of ['open', ...closedStatuses] as RiskFlagStatus[]) {
        const blocked = isBlockingFlag({ severity, status })
        const expected = status === 'open' && (severity === 'high' || severity === 'critical')
        expect(blocked).toBe(expected)
      }
    }
  })
})
