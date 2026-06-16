import Anthropic from '@anthropic-ai/sdk'

if (process.env.ANTHROPIC_ZDR_VERIFIED !== 'true') {
  throw new Error(
    'Assertion Failure: Zero Data Retention (ZDR) configuration is not verified at the console/organization level. API execution aborted.',
  )
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
