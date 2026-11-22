import { expect, test, type Page } from '@playwright/test'

import { asInvitation, handleInvitationRoutes } from './invitationMocks'

const user = { id: 'marketing-user', email: 'fixture@example.invalid', full_name: 'Fixture Couple', created_at: '2026-01-01' }
async function api(page: Page, authenticated = false) {
  let signedIn = authenticated
  const wedding = asInvitation({ id: 'marketing-wedding', themeId: 'international', locale: 'en', status: 'draft' } as Record<string, unknown>)
  await page.addInitScript(() => localStorage.setItem('kuren.welcomeSeen.marketing-user', '1'))
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/login')) { signedIn = true; return route.fulfill({ json: user }) }
    if (path.endsWith('/users/me')) return route.fulfill(signedIn ? { json: user } : { status: 401, json: { error: { code: 'unauthorized', message: 'Sign in' } } })
    if (path.endsWith('/weddings/me')) return route.fulfill({ json: wedding })
    if (await handleInvitationRoutes(route, path, wedding)) return
    if (path.endsWith('/content')) return route.fulfill({ json: { schemaVersion: 1, locale: 'en', opening: {}, couple: { groom: {}, bride: {} }, story: { timeline: [] }, events: [], gallery: { images: [] }, rsvp: { enabled: true }, closing: {} } })
    return route.fulfill({ json: [] })
  })
}

for (const width of [320, 390, 768, 1440]) {
  test(`public marketing fits ${width}px and has named controls`, async ({ page }) => {
    await api(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const control of await page.locator('a, button, summary').all()) {
      expect((await control.getAttribute('aria-label')) || (await control.innerText()).trim()).toBeTruthy()
    }
    await page.screenshot({ path: `test-results/screens/marketing-${width}.png`, fullPage: true })
    await page.reload()
    await expect(page.getByRole('main')).toBeVisible()
  })
}

test('keyboard skip link reaches main and FAQ works without a mouse', async ({ page }) => {
  await api(page)
  await page.goto('/')
  // The route and session are loaded asynchronously before the first control exists.
  await expect(page.getByRole('main')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveAttribute('href', /#/) 
  await page.keyboard.press('Enter')
  const main = page.getByRole('main')
  await expect(main).toBeInViewport()
  const summary = page.locator('summary').first()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(summary.locator('..')).toHaveAttribute('open', '')
})

for (const destination of ['/dashboard', '/wedding/story?mode=edit#story', '/themes/traditional']) {
  test(`protected deep link ${destination} keeps safe return`, async ({ page }) => {
    await api(page)
    await page.goto(destination)
    await expect(page).toHaveURL(/\/login/)
    // /dashboard is now an alias of the invitation list.
    expect(new URL(page.url()).searchParams.get('redirect')).toBe(destination === '/dashboard' ? '/invitations' : destination)
    await expect(page.locator('input[type=email]')).toBeVisible()
  })
}

test('login restores a nested route; signed-in users can still view marketing', async ({ page }) => {
  await api(page)
  await page.goto('/login?redirect=%2Fwedding%2Fstory%3Fmode%3Dedit')
  await page.locator('input[type=email]').fill('fixture@example.invalid')
  await page.locator('input[type=password]').fill('fixture-password')
  await page.locator('button[type=submit]').click()
  // The legacy URL resolves to the invitation editor (query kept).
  await expect(page).toHaveURL(/\/invitations\/marketing-wedding\/edit\/story\?mode=edit$/)
  await page.reload()
  await expect(page).toHaveURL(/\/invitations\/marketing-wedding\/edit\/story\?mode=edit$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('a[href="/dashboard"], a[href="/invitations"]').first()).toBeVisible()
})

test('external login return cannot leave the application', async ({ page }) => {
  await api(page)
  await page.goto('/login?redirect=https%3A%2F%2Fevil.example')
  await page.locator('input[type=email]').fill('fixture@example.invalid')
  await page.locator('input[type=password]').fill('fixture-password')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/(dashboard|invitations)$/)
})
