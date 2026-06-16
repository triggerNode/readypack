// Generates PNG test logos for the smoke-test personas.
// react-pdf's <Image> renders PNG/JPEG only (not SVG), so logos must be raster
// to actually appear on the generated documents. We render a simple coloured
// "pill" wordmark (white text on the brand colour — visible on both the dark
// cover and the light document pages) and screenshot it with a transparent
// background via the already-installed Playwright chromium.
//
// Run:  node e2e/fixtures/make-logos.mjs
// Output: e2e/fixtures/logos/<key>.png
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, 'logos')
mkdirSync(outDir, { recursive: true })

// key, wordmark text, brand colour
const LOGOS = [
  ['lumen', 'LUMEN STUDIO', '#4f46e5'],
  ['cobalt', 'COBALT LABS', '#2563eb'],
  ['harborview', 'HARBORVIEW', '#0d9488'],
  ['northwind', 'NORTHWIND', '#475569'],
  ['medimind', 'MEDIMIND', '#e11d48'],
  ['brightpath', 'BRIGHTPATH', '#d97706'],
  ['ledgerly', 'LEDGERLY', '#16a34a'],
  ['atlas', 'ATLAS FREIGHT', '#ea580c'],
  ['verde', 'VERDE', '#059669'],
  ['pixelpulse', 'PIXEL & PULSE', '#c026d3'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2 })

for (const [key, text, colour] of LOGOS) {
  await page.setContent(`
    <html><body style="margin:0;background:transparent;">
      <div id="logo" style="
        display:inline-flex;align-items:center;gap:10px;
        background:${colour};color:#ffffff;
        font-family:Arial,Helvetica,sans-serif;font-weight:800;
        font-size:30px;letter-spacing:0.04em;
        padding:18px 28px;border-radius:14px;">
        <span style="
          display:inline-flex;align-items:center;justify-content:center;
          width:34px;height:34px;border-radius:8px;
          background:rgba(255,255,255,0.22);font-size:20px;">${text[0]}</span>
        ${text}
      </div>
    </body></html>`)
  const el = page.locator('#logo')
  await el.screenshot({ path: resolve(outDir, `${key}.png`), omitBackground: true })
  console.log('wrote', `${key}.png`)
}

await browser.close()
console.log('Done — 10 logos in', outDir)
