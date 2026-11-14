import { mkdirSync } from 'node:fs'

import { request, type FullConfig } from '@playwright/test'

/** Registers a throwaway test account and saves its session for all tests. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  const ctx = await request.newContext({ baseURL })
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const response = await ctx.post('/api/v1/auth/register', {
    data: { email, password: `e2e-${Math.random().toString(36).slice(2)}-pass`, full_name: 'E2E Tester' },
  })
  if (!response.ok()) {
    throw new Error(`Could not register test user (${response.status()}). Is \`docker compose up\` running?`)
  }
  mkdirSync('./e2e/.auth', { recursive: true })
  await ctx.storageState({ path: './e2e/.auth/state.json' })
  await ctx.dispose()
}
