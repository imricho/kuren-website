import { defineConfig, devices } from '@playwright/test'

/**
 * Browser smoke tests for real layout behaviour (jsdom can't measure layout).
 * Expects the dev stack to be running: `docker compose up` (from repo root).
 *   npx playwright install chromium   # once
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    storageState: './e2e/.auth/state.json',
    // Disables the scroll-reveal animation so every section is visible at once.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
