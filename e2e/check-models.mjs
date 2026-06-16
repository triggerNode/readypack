// Verify which Claude model IDs actually work on this account.
// Sends a 1-token ping to each candidate. Near-zero cost. Read-only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i).trim()] = t.slice(i + 1).replace(/\s+#.*$/, '').trim()
}

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const candidates = [
  'claude-sonnet-4-20250514', // currently in the code (suspected dead)
  'claude-3-5-haiku-latest',  // currently in the code (suspected dead)
  'claude-sonnet-4-6',        // current Sonnet
  'claude-haiku-4-5-20251001',// current Haiku
  'claude-opus-4-8',          // current Opus
]

for (const model of candidates) {
  try {
    const r = await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    console.log(`OK    ${model}  (stop: ${r.stop_reason})`)
  } catch (e) {
    console.log(`FAIL  ${model}  -> ${e.status ?? ''} ${e.message?.split('\n')[0] ?? e}`)
  }
}
