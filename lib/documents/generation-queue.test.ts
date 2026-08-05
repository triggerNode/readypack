import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// supabaseAdmin builds a client at module load, so the module under test cannot
// be imported until these exist. They are never used — no request is made to
// Supabase in these tests.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-test-key'

type KickWorker = (orderId: string, origin?: string) => void
let kickWorker: KickWorker

beforeAll(async () => {
  ;({ kickWorker } = await import('./generation-queue'))
})

/** Let the fetch promise's .then/.catch handlers run. */
const flush = () => new Promise((r) => setTimeout(r, 0))

let errors: string[]

beforeEach(() => {
  errors = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('kickWorker — a kick that does not land must be loud', () => {
  // This is the regression that mattered: the catch used to be
  // `.catch(() => undefined)`, so a backstop that never started a single job
  // looked exactly like a healthy idle one, and a paid order could sit
  // ungenerated indefinitely with nothing to show for it.
  test('logs UNREACHABLE, with the order id, when the request never arrives', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    kickWorker('order-abc', 'http://127.0.0.1:9')
    await flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('UNREACHABLE')
    expect(errors[0]).toContain('order-abc')
    expect(errors[0]).toContain('ECONNREFUSED')
  })

  test('logs the status code when the worker refuses the kick', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    kickWorker('order-abc', 'https://readypack.co.uk')
    await flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('refused')
    expect(errors[0]).toContain('HTTP 401')
  })

  test('stays quiet when the worker accepts the kick', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    kickWorker('order-abc', 'https://readypack.co.uk')
    await flush()

    expect(errors).toEqual([])
  })

  // fetch throws SYNCHRONOUSLY on an unparseable URL, which is exactly the
  // misconfiguration this defends against. An escaping throw would abort the
  // caller — the cron loop would stop kicking every job after the bad one.
  test('never throws when fetch fails synchronously, and still says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      throw new TypeError('Failed to parse URL from readypack.co.uk/api/generate')
    }))

    expect(() => kickWorker('order-abc', 'readypack.co.uk')).not.toThrow()
    await flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('could not even dispatch')
    expect(errors[0]).toContain('order-abc')
  })
})

describe('kickWorker — where the kick is sent', () => {
  test('uses the explicit origin, so the cron cannot be pointed at localhost by a bad env var', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://wrong.example.com')

    kickWorker('order-abc', 'https://readypack.co.uk')
    await flush()

    expect(fetchMock.mock.calls[0][0]).toBe('https://readypack.co.uk/api/generate')
  })

  test('falls back to NEXT_PUBLIC_APP_URL when no origin is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://readypack.co.uk')

    kickWorker('order-abc')
    await flush()

    expect(fetchMock.mock.calls[0][0]).toBe('https://readypack.co.uk/api/generate')
  })

  test('posts the internal trigger payload for the right order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    kickWorker('order-xyz', 'https://readypack.co.uk')
    await flush()

    const init = fetchMock.mock.calls[0][1] as { method: string; body: string }
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ order_id: 'order-xyz', _internal: true })
  })
})
