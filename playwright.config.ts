import { defineConfig, devices } from '@playwright/test'

// ReadyPack smoke-test configuration.
// The robot tester drives a real browser against the local dev server.
// It adds nothing to the app — it only watches and clicks.
//
// By default it will start `npm run dev` for you if the site isn't already
// running, and reuse an already-running server if you have one open.

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // Clear the email-capture file once before the run (see e2e/global-setup.ts).
  globalSetup: './e2e/global-setup.ts',
  // One worker: be gentle on the dev server and avoid tripping rate limits.
  workers: 1,
  fullyParallel: false,
  // Don't let a hung test wedge the whole run.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Mints the autonomous admin login state before the authed project runs.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Layers A + B + the portal/questionnaire UI sweep. All logged-out by
    // default; each spec that needs a customer mints its own magic-link session
    // (see e2e/lib/journey.ts customerContext), so no shared auth state is used.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(a-public-sweep|b-routing-gating|portal-ui|access-control|intake-journey)\.spec\.ts/,
    },
    // Admin-authed specs (reuse the saved admin session). Two members:
    //  • d-admin-actions — FREE checks of admin case-page controls (e.g. the
    //    "Generate Pack" button triggers generation). Uses the kill-switch, so it
    //    runs in normal free runs and skips itself when RUN_REAL_GENERATION=1.
    //  • c-generation-lifecycle — Layer C, the real generation lifecycle. GATED
    //    behind RUN_REAL_GENERATION=1 (the spec skips itself otherwise). Its
    //    admin-side steps reuse this session; customer steps mint their own.
    {
      name: 'authed',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
      testMatch: /(c-generation-lifecycle|d-admin-actions)\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    // Test-only generation kill-switch (see lib/documents/generation-queue.ts →
    // kickWorker). ON by default so the routing/gating layer (b-routing-gating)
    // proves generation is *triggered* without spending Claude credit or waiting
    // on flaky Storage uploads. Automatically OFF when RUN_REAL_GENERATION=1, so
    // the deliberate end-to-end layer (Layer C) generates real packs.
    // NOTE: only applies to a server Playwright STARTS. If you already have your
    // own `npm run dev` running, reuseExistingServer reuses it and this env won't
    // take effect — start Layer B against a clean managed server (or export the
    // flag in that dev shell).
    env: {
      ...process.env,
      E2E_SKIP_REAL_GENERATION: process.env.RUN_REAL_GENERATION === '1' ? '0' : '1',
      // Capture outbound email to a file instead of sending it (see lib/resend.ts).
      // ON for every managed test run so automated runs never touch the Resend
      // quota and can assert exactly what would have been sent. NOTE: like the
      // generation switch, this only takes effect on a server Playwright STARTS —
      // if you reuse your own running dev server, export E2E_CAPTURE_EMAIL=1 there.
      E2E_CAPTURE_EMAIL: '1',
    },
  },
})
