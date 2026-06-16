// Logo wiring for Smoke Test 2.
//
// The harness seeds orders via the dev tool and writes raw_answers directly (it
// is not authenticated as the customer), so it cannot drive the real
// POST /api/intake/upload-logo route (which needs the customer's session). To
// still get the persona's logo onto the rendered PDF, we upload the PNG fixture
// to the public readypack-logos bucket via the service-role client and return
// the public URL — the same URL shape the upload route returns. The caller sets
// it as raw_answers['1'].logo_url so /api/intake/submit copies it into
// normalised_answers.logo_url, which /api/generate now reads (logo fallback).

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Persona } from './personas'

const BUCKET = 'readypack-logos'

/** Upload a persona's PNG fixture and return its public URL (or undefined if missing). */
export async function uploadPersonaLogo(
  sb: SupabaseClient,
  persona: Persona,
  submissionId: string,
): Promise<string | undefined> {
  const file = resolve(process.cwd(), 'e2e', 'fixtures', 'logos', `${persona.logoKey}.png`)
  if (!existsSync(file)) {
    console.warn(`[logo] fixture missing for ${persona.company}: ${file}`)
    return undefined
  }
  const bytes = readFileSync(file)
  const path = `${submissionId}/logo-${Date.now()}.png`
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) {
    console.warn(`[logo] upload failed for ${persona.company}: ${error.message}`)
    return undefined
  }
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Return persona.answers with the uploaded logo URL injected into section 1. */
export function withLogo(
  answers: Persona['answers'],
  logoUrl: string | undefined,
): Persona['answers'] {
  if (!logoUrl) return answers
  return { ...answers, '1': { ...answers['1'], logo_url: logoUrl } }
}
