import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
const templateIds: string[] = JSON.parse(readFileSync(new URL('../../src/features/themes/catalog/selectable-theme-ids.json', import.meta.url), 'utf8'))

// Mount real Vite modules directly, without backend writes or test-only app routes.
for (const width of [375, 1280]) {
  test(`all templates: order, QRIS and optional visibility at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000)
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/api/v1/**', route => route.fulfill({ status: 401, json: {} }))
    await page.route('**/sample-wedding/qris-test.png', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400"><rect width="320" height="400" fill="white"/><path d="M20 20h80v80H20zM220 20h80v80h-80zM20 300h80v80H20z" fill="black"/><text x="110" y="200">QRIS fixture</text></svg>' }))
    await page.goto('/login')
    await page.evaluate(async () => {
      const load = (path: string) => import(/* @vite-ignore */ path)
      const vue = await load('/node_modules/.vite/deps/vue.js')
      const { default: Renderer } = await load('/src/features/themes/core/ThemeRenderer.vue')
      const fixture = await load('/src/features/themes/universalContent.fixture.ts')
      const state = vue.reactive({ themeId: 'international', content: fixture.universalFixture() })
      document.body.innerHTML = '<div id="universal-test-root"></div>'
      vue.createApp({ render: () => vue.h(Renderer, state) }).mount('#universal-test-root')
      ;(window as any).__universal = { state, fixture }
    })
    for (const id of templateIds) {
      await page.evaluate(id => { const t = (window as any).__universal; t.state.content = t.fixture.universalFixture(); t.state.themeId = id }, id)
      await expect(page.locator(`.wedding-site[data-theme="${id}"] > article`), id).toBeVisible()
      await expect(page.locator('[data-section="closing"]'), id).toBeAttached()
      expect(await page.locator('[data-section]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-section'))), id).toEqual(['opening','holyRecite1','greeting','couple','weddingDate','events','story','gallery','rsvp','wishes','amplopDigital','holyRecite2','closing'])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id} overflow`).toBe(true)
      const qris = page.locator('.universal-qris img')
      await qris.scrollIntoViewIfNeeded()
      await expect(qris).toBeVisible()
      const geometry = await qris.evaluate((image: HTMLImageElement) => {
        const b = image.getBoundingClientRect()
        return { fit: getComputedStyle(image).objectFit, loaded: image.complete && image.naturalWidth > 0, ratio: b.width / b.height, natural: image.naturalWidth / image.naturalHeight, unobstructed: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === image, withinViewport: b.left >= 0 && b.right <= innerWidth }
      })
      expect(geometry, id).toMatchObject({ fit: 'contain', loaded: true, unobstructed: true, withinViewport: true })
      expect(geometry.ratio, id).toBeCloseTo(geometry.natural, 2)
      if (['international','royal-maroon-v2','artistic','wildwood-gathering'].includes(id)) {
        for (const section of ['amplopDigital', 'holyRecite1']) await page.locator(`[data-section="${section}"]`).screenshot({ path: `test-results/universal/${id}-${width}-${section}.png` })
      }
      await page.locator('.wedding-site img').evaluateAll(async nodes => {
        await Promise.all(nodes.map(async node => { const image = node as HTMLImageElement; image.loading = 'eager'; await image.decode().catch(() => {}) }))
      })
      if (id === 'royal-maroon-v2') expect(await page.locator('.universal-section__decoration svg').first().evaluate(node => node.getBoundingClientRect().width)).toBe(52)
      if (width === 375 && ['international','traditional','royal-maroon-v2','ethnic','conventional','artistic','still-form','wildwood-gathering'].includes(id)) await page.screenshot({ path: `test-results/universal/${id}-375-full.png`, fullPage: true })
      await page.evaluate(() => {
        const { state } = (window as any).__universal
        state.content.amplopDigital.title = 'LongGiftTitle'.repeat(10)
        state.content.amplopDigital.bankAccounts[0].bankName = 'LongBankName'.repeat(10)
        state.content.amplopDigital.physicalGifts.recipient = 'Recipient'.repeat(12)
      })
      const giftBounds = await page.locator('[data-section="amplopDigital"] .universal-section__content').evaluate(node => ({ width: node.clientWidth, content: node.scrollWidth }))
      expect(giftBounds.content, `${id} long gift text`).toBeLessThanOrEqual(giftBounds.width + 1)
      await page.evaluate(() => {
        const { state, fixture } = (window as any).__universal
        for (const key of fixture.OPTIONAL_SECTIONS) state.content[key].enabled = false
        state.content.countdown.enabled = false
      })
      await expect(page.locator('[data-section]')).toHaveCount(5)
      expect(await page.locator('[data-section]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-section'))), id).toEqual(['opening','couple','weddingDate','events','closing'])
    }
    expect(pageErrors).toEqual([])
  })
}


test('every normal template preview and picker shows all thirteen sections without saving sample data', async ({ page }) => {
  test.setTimeout(120_000)
  const writes: string[] = []
  page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()) })
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/users/me')) return route.fulfill({ json: { id: 'demo-user', email: 'demo@example.invalid', full_name: 'Demo Couple', created_at: '2026-01-01' } })
    if (path.endsWith('/weddings/me')) return route.fulfill({ json: { id: 'demo-wedding', themeId: 'royal-maroon-v2', locale: 'en', revision: 0, status: 'draft', publishedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' } })
    if (path.endsWith('/content')) return route.fulfill({ json: { schemaVersion: 1, locale: 'en', opening: {}, couple: { groom: {}, bride: {} }, story: { timeline: [] }, events: [], gallery: { images: [] }, rsvp: { enabled: false }, closing: {} } })
    return route.fulfill({ status: 404, json: {} })
  })
  for (const id of templateIds) {
    await page.goto(`/themes/${id}/preview`)
    await expect(page.locator(`.wedding-site[data-theme="${id}"] [data-section]`), id).toHaveCount(13)
    await expect(page.locator('.universal-qris img')).toBeAttached()
    expect(new URL(page.url()).search).toBe('')
  }
  await page.goto('/themes/traditional/ceremonial-classic/royal-maroon-v2/preview')
  await expect(page.locator('[data-section]')).toHaveCount(13)
  await expect(page.locator('[data-section="holyRecite1"]')).toContainText('sample content')
  await expect(page.locator('[data-section="amplopDigital"]')).toContainText('Do not transfer funds')
  await expect(page.locator('[data-section="wishes"]')).toContainText('not available yet')
  expect(writes).toEqual([])
  await page.locator('.wedding-site img').evaluateAll(async nodes => {
    await Promise.all(nodes.map(async node => { const image = node as HTMLImageElement; image.loading = 'eager'; await image.decode().catch(() => {}) }))
  })
  await page.screenshot({ path: 'test-results/universal/default-template-preview.png', fullPage: true })
  await page.goto('/themes/traditional/ceremonial-classic/royal-maroon-v2')
  await expect(page.getByTestId('preview-pane').locator('[data-section]')).toHaveCount(13)
  const thumbnail = page.locator('.template-thumbnail .wedding-site').first()
  await expect(thumbnail.locator('[data-section]')).toHaveCount(13)
  expect(writes).toEqual([])
})
