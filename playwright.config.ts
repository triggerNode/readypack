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
    // Mints the autonomous admin login state before admin tests run.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // Public, logged-out sweep (broken links, page loads, admin lock-out).
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /admin-journey\.spec\.ts/, /scenarios\.spec\.ts/, /full-journey\.spec\.ts/, /portal\.spec\.ts/],
    },
    // Logged-in admin journeys, reusing the saved admin session.
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
      testMatch: /(admin-journey|scenarios|full-journey|portal)\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
