import { expect, test } from '@playwright/test'

// These public-page checks use no backend accounts or payment services.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/users/me', route => route.fulfill({
    status: 401, json: { error: { code: 'unauthorized', message: 'Sign in' } },
  }))
})

test('mobile navigation is keyboard operable and closes after selecting a section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const toggle = page.locator('button[aria-controls="landing-navigation"]')
  const navigation = page.locator('#landing-navigation')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(navigation).toBeVisible()
  const template = navigation.getByRole('link', { name: 'Template', exact: true })
  await template.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#template$/)
  await expect(navigation).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#template')).toBeInViewport()
})

test('real template preview is public at its canonical destination', async ({ page }) => {
  await page.goto('/')
  const template = page.locator('.template-card').first()
  const destination = await template.getAttribute('href')
  expect(destination).toMatch(/^\/themes\/[^/]+\/[^/]+\/[^/]+\/preview(?:\?.*)?$/)
  await template.click()
  await expect(page).toHaveURL(url => url.pathname + url.search === destination)
  await expect(page.getByTestId('public-preview-toolbar')).toBeVisible()
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
})

test('provisional pricing sends visitors to registration without payment requests', async ({ page }) => {
  const mutations: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url())
  })
  await page.goto('/')
  await expect(page.locator('#harga')).toContainText('pembayaran belum tersedia')
  await expect(page.locator('.plan-price')).toHaveText(['Rp0', 'Rp99.000', 'Rp199.000'])
  const premium = page.locator('.price-card--premium').getByRole('link')
  await expect(premium).toHaveAttribute('href', /^\/register(?:\?|$)/)
  await premium.click()
  await expect(page).toHaveURL(/\/register(?:\?.*)?$/)
  expect(mutations).toEqual([])
})

test('320px reflow retains readable controls and decorative alternatives', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.kuren-landing')).toHaveAttribute('lang', 'id')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const image of await page.locator('.kuren-landing img').all()) {
    expect(await image.getAttribute('alt')).not.toBeNull()
  }
  for (const control of await page.locator('.kuren-landing button:not([inert] *), .kuren-landing summary:not([inert] *), .landing-button:not([inert] *)').all()) {
    if (!(await control.isVisible())) continue
    const box = await control.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(24)
    expect(box?.width).toBeGreaterThanOrEqual(24)
  }
})
