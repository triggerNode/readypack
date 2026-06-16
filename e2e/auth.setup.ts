import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadTestEnv, requireEnv, ADMIN_EMAIL } from './lib/test-env'

// ──────────────────────────────────────────────────────────────────────────
// Autonomous admin login.
//
// The admin area only allows ONE email (the founder's) and only logs in via a
// magic link. Rather than wait on an inbox, we use the project's service key
// (already in .env.local, used by the app itself) to mint a one-time login
// token and exchange it for a real session — entirely headless.
//
// This does NOT change the founder's password and changes nothing in the app.
// It produces a saved "logged-in state" file the admin tests reuse.
// ──────────────────────────────────────────────────────────────────────────

const AUTH_FILE = resolve(process.cwd(), 'e2e/.auth/admin.json')

setup('authenticate as admin', async () => {
  loadTestEnv()
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // 1. Service key mints a one-time magic-link token for the admin email.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADMIN_EMAIL,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Could not mint admin login token: ${linkErr?.message ?? 'no token returned'}`)
  }

  // 2. Exchange that one-time token for a real session (access + refresh token).
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })
  const session = verifyData?.session
  if (verifyErr || !session) {
    throw new Error(`Could not exchange login token for a session: ${verifyErr?.message ?? 'no session'}`)
  }

  // 3. Let @supabase/ssr encode the session into the exact cookies the app
  //    expects (correct name + chunking), by capturing what setSession writes.
  const captured: { name: string; value: string; options: Record<string, unknown> }[] = []
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (list) => {
        for (const c of list) captured.push(c as (typeof captured)[number])
      },
    },
  })
  await ssr.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  // 4. Save as a Playwright "storage state" the admin tests load.
  const farFuture = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const cookies = captured.map((c) => ({
    name: c.name,
    value: c.value,
    domain: 'localhost',
    path: (c.options?.path as string) ?? '/',
    expires: farFuture,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  }))

  mkdirSync(resolve(process.cwd(), 'e2e/.auth'), { recursive: true })
  writeFileSync(AUTH_FILE, JSON.stringify({ cookies, origins: [] }, null, 2))

  if (cookies.length === 0) {
    throw new Error('No auth cookies were produced — login state would be empty.')
  }
})
