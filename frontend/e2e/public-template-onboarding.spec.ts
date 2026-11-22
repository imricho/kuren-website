import { expect, test } from './fixtures'

const template = 'royal-maroon-v2'
const preview = '/themes/traditional/ceremonial-classic/royal-maroon-v2/preview?from=landing'
// Since the invitation engine, "Use template" starts the creation wizard with the template preselected.
const wizardPath = `/invitations/new?template=${template}`

async function finishWizard(page: import('@playwright/test').Page) {
  await page.locator('input[data-category="wedding"]').check()
  await page.locator('[data-action="next"]').click()
  await page.locator('input[data-variant="wedding_ceremony"]').check()
  await page.locator('[data-action="next"]').click()
  await expect(page.locator(`input[data-template="${template}"]`)).toBeChecked()
  await page.locator('[data-action="next"]').click()
  await page.locator('[data-action="create"]').click()
  await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/, { timeout: 15_000 })
  await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', template)
}

test('a guest can preview, log in, and create an invitation with the chosen theme without touching existing content', async ({ page, freshUser }) => {
  const created = await page.request.post('/api/v1/weddings', { data: { themeId: 'international', locale: 'id' } })
  expect(created.status()).toBe(201)
  const wedding = await created.json()
  const seeded = await page.request.put(`/api/v1/weddings/${wedding.id}/sections/couple`, { data: { groom: { name: 'Preserved Groom' }, bride: { name: 'Preserved Bride' } } })
  expect(seeded.ok()).toBe(true)
  const before = await (await page.request.get(`/api/v1/weddings/${wedding.id}/content`)).json()
  await page.context().clearCookies()
  await page.goto(preview)
  await expect(page.locator('.wedding-site')).toBeVisible()
  await expect(page).toHaveURL(/\/preview\?from=landing$/)
  await page.getByRole('link', { name: /Gunakan Template|Use Template/i }).click()
  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(wizardPath)
  await page.locator('input[type=email]').fill(freshUser.email)
  await page.locator('input[type=password]').fill(freshUser.password)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(new RegExp(`/invitations/new\\?template=${template}`), { timeout: 15_000 })
  await finishWizard(page)
  // The existing wedding keeps its content and theme.
  const after = await (await page.request.get(`/api/v1/weddings/${wedding.id}/content`)).json()
  expect(after).toEqual(before)
  expect((await (await page.request.get(`/api/v1/invitations/${wedding.id}`)).json()).themeId).toBe('international')
  expect((await (await page.request.get('/api/v1/invitations')).json()).items).toHaveLength(2)
  await page.reload()
  await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', template)
})

test('a new guest can switch to registration and reach the chosen template in the wizard', async ({ page }) => {
  await page.context().clearCookies()
  await page.goto(preview)
  await page.getByRole('link', { name: /Gunakan Template|Use Template/i }).click()
  await expect(page).toHaveURL(/\/login\?/)
  await page.locator('a[href*="/register"]').click()
  await expect(page).toHaveURL(/\/register\?/)
  await page.reload()
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(wizardPath)
  await page.locator('input[autocomplete=name]').fill('Public Preview Test')
  await page.locator('input[type=email]').fill(`public-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`)
  await page.locator('input[type=password]').fill(`preview-${Math.random().toString(36).slice(2)}-test`)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(new RegExp(`/invitations/new\\?template=${template}`), { timeout: 15_000 })
  await finishWizard(page)
  expect((await (await page.request.get('/api/v1/weddings/me')).json()).themeId).toBe(template)
})
