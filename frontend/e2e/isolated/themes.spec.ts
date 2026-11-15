import { expect, test } from '@playwright/test'

// Every API request is intercepted. This suite creates no backend accounts or records.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('PAGE ERROR', error.message))
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE', message.text()) })
  const wedding = { id: 'isolated-wedding', themeId: 'international', locale: 'en', status: 'draft', publishedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/users/me')) return route.fulfill({ json: { id: 'isolated-user', email: 'fixture@example.invalid', full_name: 'Fixture Couple', created_at: '2026-01-01' } })
    if (path.endsWith('/weddings/me')) return route.fulfill({ json: wedding })
    if (path.endsWith('/content')) return route.fulfill({ json: { schemaVersion: 1, locale: 'en', opening: { headline: 'Keep our saved draft' }, couple: { groom: {}, bride: {} }, story: { timeline: [] }, events: [], gallery: { images: [] }, rsvp: { enabled: true }, closing: {} } })
    if (path.endsWith('/isolated-wedding') && route.request().method() === 'PATCH') {
      Object.assign(wedding, route.request().postDataJSON())
      return route.fulfill({ json: wedding })
    }
    return route.fulfill({ status: 404, json: { error: { code: 'fixture_unknown', message: path } } })
  })
})

for (const id of ['traditional', 'conventional', 'still-form']) {
  for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
    test(`${id} fits ${viewport.width}px with accessible decoration`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(`/themes/${id}/preview`)
      const article = page.locator('.wedding-site > article')
      await expect(article).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const ornaments = page.locator('.wedding-site svg')
      for (const svg of await ornaments.all()) expect(await svg.evaluate(el => Boolean(el.closest('[aria-hidden="true"]')))).toBe(true)
      await page.screenshot({ path: `test-results/screens/${id}-${viewport.width}.png` })
    })
  }
}

test('sidebar only previews; explicit selection persists then opens Edit', async ({ page }) => {
  const patches: string[] = []
  page.on('request', request => { if (request.method() === 'PATCH') patches.push(request.url()) })
  await page.goto('/themes')
  await page.locator('[data-family-card="traditional"] a').click()
  await expect(page).toHaveURL(/\/themes\/traditional$/)
  await page.locator('[data-collection-card="ceremonial-classic"] a').click()
  await expect(page).toHaveURL(/\/themes\/traditional\/ceremonial-classic$/)
  await page.locator('[data-theme-card="ivory-processional"] h4 a').click()
  await expect(page).toHaveURL(/\/ceremonial-classic\/ivory-processional$/)
  await expect(page.getByTestId('preview-pane').getByRole('heading', { name: 'Ivory Processional' })).toBeVisible()
  expect(patches).toEqual([])
  const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/isolated-wedding'))
  await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
  expect((await saved).request().postDataJSON()).toEqual({ themeId: 'ivory-processional' })
  await expect(page).toHaveURL(/\/wedding\//)
  await page.goBack()
  await expect(page).toHaveURL(/\/ceremonial-classic\/ivory-processional$/)
  expect(patches).toHaveLength(1)
})
