import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit-test runner for pure logic modules (lib/**). Mirrors the tsconfig
// "@/*" -> "./*" path alias so test imports resolve the same way as app code.
// E2E (Playwright) lives under e2e/ and is excluded here.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
})
