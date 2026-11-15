import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e/isolated',
  outputDir: './test-results/isolated',
  fullyParallel: true,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174', reducedMotion: 'reduce', ...devices['Desktop Chrome'] },
})
