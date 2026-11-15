import { test as base, type APIRequestContext, type Page } from '@playwright/test'

/**
 * Per-test accounts for tests that change data (the CMS). The shared account from
 * global-setup is fine for read-only theme tests, but tests that create and edit a
 * wedding need their own user so parallel workers never interfere.
 */
export interface FreshUser {
  email: string
  password: string
  /** Log this user into another page/context (e.g. a second browser). */
  loginInto: (page: Page) => Promise<void>
}

async function register(api: APIRequestContext, tag: string) {
  const email = `cms-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const password = `cms-${Math.random().toString(36).slice(2)}-pass`
  const res = await api.post('/api/v1/auth/register', { data: { email, password, full_name: 'Dewi Lestari' } })
  if (!res.ok()) throw new Error(`register failed: ${res.status()}`)
  const { id } = (await res.json()) as { id: string }
  return { id, email, password }
}

/** Mark the first-run welcome flow as seen so /dashboard doesn't redirect to /welcome. */
async function skipWelcome(page: Page, userId: string) {
  await page.addInitScript((key) => localStorage.setItem(key, '1'), `kuren.welcomeSeen.${userId}`)
}

export const test = base.extend<{ freshUser: FreshUser; welcomeSeen: boolean }>({
  // Tests of the first-run flow opt out with test.use({ welcomeSeen: false }).
  welcomeSeen: [true, { option: true }],
  // A brand-new, logged-in user for this test only (cookies are set on `page`).
  storageState: async ({}, use) => use({ cookies: [], origins: [] }),
  freshUser: async ({ page, welcomeSeen }, use, testInfo) => {
    const { id, email, password } = await register(page.request, `w${testInfo.workerIndex}`)
    if (welcomeSeen) await skipWelcome(page, id)
    const loginInto = async (target: Page) => {
      const res = await target.request.post('/api/v1/auth/login', { data: { email, password } })
      if (!res.ok()) throw new Error(`login failed: ${res.status()}`)
      if (welcomeSeen) await skipWelcome(target, id)
    }
    await use({ email, password, loginInto })
  },
})

export { expect } from '@playwright/test'
