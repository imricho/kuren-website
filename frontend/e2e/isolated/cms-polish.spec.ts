import { expect, test, type Page } from '@playwright/test'
import { normalizeDraft } from '../../src/features/wedding/draft'
import { sampleWedding } from '../../src/features/wedding/sampleWedding'
import { asInvitation, handleInvitationRoutes } from './invitationMocks'

const screenshots = process.env.POLISH_SCREENSHOTS ?? 'test-results/cms-polish'
async function api(page: Page, authenticated = true) {
  const content = normalizeDraft(structuredClone(sampleWedding))
  content.opening.weddingDate = '2099-06-12'
  content.countdown = { enabled: true, addToCalendar: true }
  const wedding = asInvitation({ id: 'polish-fixture', themeId: 'royal-maroon-v2', locale: 'en', status: 'draft', revision: 1, publishedAt: null })
  await page.addInitScript(() => localStorage.setItem('kuren.appLocale', 'en'))
  await page.routeWebSocket(url => url.pathname === '/' && url.searchParams.has('token'), () => {})
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/users/me')) return route.fulfill(authenticated
      ? { json: { id: 'polish-user', email: 'fixture@example.invalid', full_name: 'Fixture Couple', created_at: '2026-01-01' } }
      : { status: 401, json: { error: { code: 'unauthorized', message: 'Sign in' } } })
    if (path.endsWith('/weddings/me')) return route.fulfill({ json: wedding })
    if (authenticated && await handleInvitationRoutes(route, path, wedding)) return
    if (path.endsWith('/polish-fixture') && route.request().method() === 'PATCH') {
      Object.assign(wedding, route.request().postDataJSON())
      return route.fulfill({ json: wedding })
    }
    if (path.endsWith('/content')) return route.fulfill({ json: content, headers: { ETag: '"1"' } })
    return route.fulfill({ json: [] })
  })
}

for (const width of [1440, 390]) {
  test(`login uses purple design language at ${width}px`, async ({ page }) => {
    await api(page, false)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login?redirect=%2Fwedding%2Fdate')
    await expect(page.locator('input[type=email]')).toBeVisible()
    await expect(page.locator('button[type=submit]')).toHaveCSS('background-color', 'rgb(219, 185, 145)')
    await expect(page.locator('.kuren-auth')).toHaveCSS('background-color', 'rgb(243, 236, 247)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const register = await page.locator('a[href*="/register"]').getAttribute('href')
    expect(new URL(register!, page.url()).searchParams.get('redirect')).toBe('/wedding/date')
    await page.screenshot({ path: `${screenshots}/login-${width}.png`, fullPage: true })
  })
}

test('picking a different template resets desktop mode and the CMS opens in desktop mode', async ({ page }) => {
  await api(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await page.goto('/themes/traditional/ceremonial-classic/royal-maroon-v2')
  const pane = page.getByTestId('preview-pane')
  await expect(pane.locator('.device-frame')).toHaveAttribute('data-device', 'desktop')
  await pane.locator('input[value="phone"]').check({ force: true })
  await expect(pane.locator('.device-frame')).toHaveAttribute('data-device', 'phone')
  await page.locator('[data-theme-card="ivory-processional"] h4 a').click()
  await expect(pane.locator('.device-frame')).toHaveAttribute('data-device', 'desktop')
  // Opened from a fresh page load no invitation is open: selecting starts the wizard (preselected).
  await pane.locator('[data-action="select"]').click()
  await expect(page).toHaveURL(/\/invitations\/new\?template=ivory-processional$/)
  // The CMS itself opens in desktop mode.
  await page.goto('/wedding/opening')
  await expect(page.getByTestId('preview-frame')).toHaveAttribute('data-device', 'desktop')
})

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`wedding date countdown is centered with ${reducedMotion} motion`, async ({ page }) => {
    await api(page)
    await page.emulateMedia({ reducedMotion })
    await page.setViewportSize({ width: 1606, height: 979 })
    await page.goto('/wedding/date')
    const date = page.getByTestId('preview-content').locator('[data-section="weddingDate"]')
    const row = date.locator('.countdown')
    await expect(row).toBeAttached()
    await expect(row.locator('.countdown__unit')).toHaveCount(reducedMotion === 'reduce' ? 3 : 4)
    const offset = await row.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const parent = el.closest('.universal-section__content')!.getBoundingClientRect()
      const units = Array.from(el.children).map(child => child.getBoundingClientRect())
      return { row: Math.abs((rect.left + rect.right) / 2 - (parent.left + parent.right) / 2), units: Math.abs((units[0]!.left + units.at(-1)!.right) / 2 - (parent.left + parent.right) / 2) }
    })
    expect(offset.row).toBeLessThan(2)
    expect(offset.units).toBeLessThan(2)
    await page.screenshot({ path: `${screenshots}/countdown-${reducedMotion}.png` })
  })
}
