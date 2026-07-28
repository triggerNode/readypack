import { describe, test, expect } from 'vitest'
import {
  WebhookStepError,
  isPermanentSqlstate,
  isUniqueViolation,
  permanentFailure,
  shouldRetry,
} from './retry-policy'

describe('shouldRetry — the default is to retry', () => {
  test('retries an unrecognised error, because a missed retry loses a paid order', () => {
    expect(shouldRetry(new Error('boom'))).toBe(true)
  })

  test('retries a thrown non-Error value', () => {
    expect(shouldRetry('something went wrong')).toBe(true)
  })

  test('retries a bare network failure with no code', () => {
    expect(shouldRetry(new TypeError('fetch failed'))).toBe(true)
  })
})

describe('shouldRetry — transient database conditions', () => {
  // These are exactly the outages the 200-on-error bug used to swallow.
  const transient: Array<[string, string]> = [
    ['08006', 'connection failure'],
    ['08003', 'connection does not exist'],
    ['40001', 'serialization failure'],
    ['40P01', 'deadlock detected'],
    ['53300', 'too many connections'],
    ['57P01', 'admin shutdown — what a paused Supabase looks like'],
    ['57P03', 'cannot connect now — restarting'],
  ]

  test.each(transient)('retries SQLSTATE %s (%s)', (code) => {
    expect(shouldRetry(new WebhookStepError('order insert', { message: 'x', code }))).toBe(true)
    expect(isPermanentSqlstate(code)).toBe(false)
  })
})

describe('shouldRetry — permanent data problems', () => {
  const permanent: Array<[string, string]> = [
    ['22001', 'value too long for column'],
    ['22P02', 'invalid text representation'],
    ['23502', 'not-null violation'],
    ['23503', 'foreign key violation'],
    ['23505', 'unique violation'],
    ['23514', 'check constraint violation'],
  ]

  test.each(permanent)('does not retry SQLSTATE %s (%s)', (code) => {
    expect(shouldRetry(new WebhookStepError('order insert', { message: 'x', code }))).toBe(false)
    expect(isPermanentSqlstate(code)).toBe(true)
  })

  test('does not retry an event we can never process', () => {
    expect(shouldRetry(permanentFailure('session missing customer email'))).toBe(false)
  })

  test('an explicit permanent flag overrides the code-based guess', () => {
    const err = new WebhookStepError('step', { message: 'x', code: '08006' }, { permanent: true })
    expect(shouldRetry(err)).toBe(false)
  })
})

describe('WebhookStepError', () => {
  test('prefixes the message with the step so logs name the failing stage', () => {
    const err = new WebhookStepError('order insert', { message: 'relation missing', code: '42P01' })
    expect(err.message).toBe('order insert: relation missing')
    expect(err.sqlstate).toBe('42P01')
  })

  test('survives a null cause without throwing', () => {
    const err = new WebhookStepError('order insert', null)
    expect(err.message).toBe('order insert: unknown error')
    expect(err.permanent).toBe(false)
  })
})

describe('isUniqueViolation', () => {
  test('detects the concurrent-delivery race on stripe_session_id', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key' })).toBe(true)
  })

  test('is false for any other integrity error', () => {
    expect(isUniqueViolation({ code: '23503', message: 'fk violation' })).toBe(false)
    expect(isUniqueViolation(new Error('nope'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

describe('isPermanentSqlstate', () => {
  test('treats a missing code as transient', () => {
    expect(isPermanentSqlstate(null)).toBe(false)
    expect(isPermanentSqlstate(undefined)).toBe(false)
    expect(isPermanentSqlstate('')).toBe(false)
  })
})
