import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { THEME_COOKIE } from '../components/theme/theme'
import { customerContext } from './lib/journey'

// ──────────────────────────────────────────────────────────────────────────
// Product screenshots.
//
// The site has samples of the DOCUMENTS and no picture anywhere of the
// software that produces them, so a buyer is trusting a description. This spec
// drives the real portal and the real questionnaire against real delivered data
// and saves images we can use.
//
// It is also the verification step for the portal light theme. The June light
// theme shipped a bug where floating and sticky surfaces used a TRANSLUCENT
// background and let the content behind bleed through. So every shot is taken
// in BOTH themes and compared by eye, and the sticky nav and fixed action bar
// are captured deliberately rather than incidentally.
//
// Run: npx playwright test e2e/shots.spec.ts --project=authed
// ──────────────────────────────────────────────────────────────────────────

const ORDER = 'a5f1d440-d8cb-4a95-960c-44b4dccb45dc' // RP-4OAPSHLA, delivered, 9 docs
const INTAKE_CUSTOMER = 'olutags+rp2906@gmail.com'   // RP-FCQ0ZFPM, still in progress
const OUT = resolve(process.cwd(), '../design/product-shots')

const THEMES = ['dark', 'light'] as const

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true })
})

for (const theme of THEMES) {
  test(`portal - ${theme}`, async ({ page, context }) => {
    await context.addCookies([{
      name: THEME_COOKIE, value: theme,
      domain: 'localhost', path: '/',
    }])

    await page.goto(`/portal/${ORDER}`)
    await page.waitForLoadState('networkidle')

    // Prove we are actually on the portal and not bounced to /resume.
    await expect(page).toHaveURL(new RegExp(`/portal/${ORDER}`))

    // Let the entry animations settle so nothing is caught mid-fade.
    await page.waitForTimeout(2500)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: `${OUT}/portal-${theme}-top.png` })

    // Scrolled, which is where a sticky nav would show bleed-through if the
    // background is translucent. This is the shot that catches the June bug.
    await page.mouse.wheel(0, 700)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/portal-${theme}-scrolled.png` })

    await page.screenshot({ path: `${OUT}/portal-${theme}-full.png`, fullPage: true })
  })

  // The questionnaire needs a customer who has NOT submitted yet, otherwise
  // /start correctly shows the "already submitted" confirmation. The admin
  // account's newest order is delivered, so mint the alias account that still
  // has an in-progress submission (RP-FCQ0ZFPM).
  test(`questionnaire - ${theme}`, async ({ browser }) => {
    const context = await customerContext(browser, INTAKE_CUSTOMER)
    await context.addCookies([{
      name: THEME_COOKIE, value: theme,
      domain: 'localhost', path: '/',
    }])
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/start')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)

    // A returning customer lands on a "Welcome back" resume card, not the form.
    // Click through so the shot shows actual questions, which is the whole point.
    const resume = page.getByRole('button', { name: /continue questionnaire/i })
      .or(page.getByRole('link', { name: /continue questionnaire/i }))
    if (await resume.count() > 0) {
      await resume.first().click()
      await page.waitForTimeout(2500)
    }

    // Prove we reached the form: a real question must be on screen.
    await expect(page.locator('input, textarea, [role="radio"], [role="checkbox"]').first())
      .toBeVisible({ timeout: 15_000 })

    await page.screenshot({ path: `${OUT}/intake-${theme}-top.png` })
    await page.screenshot({ path: `${OUT}/intake-${theme}-full.png`, fullPage: true })
    await context.close()
  })
}

// ──────────────────────────────────────────────────────────────────────────
// Cropped product shots: the "corner of real software" Olu described, rather
// than a whole page. Light theme only, because that is what most people relate
// to, and these are for a blog or a site section.
// ──────────────────────────────────────────────────────────────────────────

test('crops - portal pieces', async ({ page, context }) => {
  await context.addCookies([{
    name: THEME_COOKIE, value: 'light', domain: 'localhost', path: '/',
  }])
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`/portal/${ORDER}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2500)

  // Each crop is an ELEMENT screenshot, so it is tight to the component with no
  // hand-measured pixel boxes that would drift the moment the layout changes.
  const crops: Array<[string, string]> = [
    ['tracker', 'div[class*="stepperCard"]'],
    ['docgrid', 'div[class*="docGrid"]'],
    ['doccard', 'div[class*="docCard"]'],
    ['complete', 'div[class*="allsetInner"]'],
  ]

  for (const [name, selector] of crops) {
    const el = page.locator(selector).first()
    if (await el.count() === 0) {
      console.log(`  crop "${name}": no element matched ${selector}, skipped`)
      continue
    }
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await el.screenshot({ path: `${OUT}/crop-${name}.png` })
    console.log(`  crop "${name}": saved`)
  }
})
