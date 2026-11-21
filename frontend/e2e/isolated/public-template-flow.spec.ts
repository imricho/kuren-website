import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const id = 'royal-maroon-v2'
const preview = '/themes/traditional/ceremonial-classic/royal-maroon-v2/preview'
const destination = `/use-template/${id}`
const output = '/Users/richomahardika/.codex/.chatgpt-projects/g-p-68c01365944881918988ba7780965894/output/kuren-public-preview'
const user = { id: 'public-flow-user', email: 'couple@example.invalid', full_name: 'Saved Couple', created_at: '2026-01-01' }
type Call = { method: string; path: string; body: unknown }

async function mockApi(page: Page, options: { authenticated?: boolean; newWedding?: boolean; patchFailures?: number; loadFailures?: number } = {}) {
  let signedIn = options.authenticated ?? false
  let exists = !options.newWedding
  let patchFailures = options.patchFailures ?? 0
  let loadFailures = options.loadFailures ?? 0
  const calls: Call[] = []
  const record = { id: 'public-flow-wedding', themeId: 'international' as string | null, locale: 'id', revision: 7, status: 'draft', publishedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
  const content = { schemaVersion: 1, locale: 'id', opening: { headline: 'Our retained wedding headline', coupleNames: 'Retained Alex & Retained Sarah', introduction: 'Our private saved introduction' }, couple: { groom: { name: 'Retained Alex' }, bride: { name: 'Retained Sarah' } }, story: { timeline: [] }, events: [], gallery: { images: [] }, rsvp: { enabled: false }, closing: { message: 'Our retained closing' } }
  await page.addInitScript(() => {
    localStorage.setItem('kuren.appLocale', 'id')
    localStorage.setItem('kuren.welcomeSeen.public-flow-user', '1')
    localStorage.removeItem('kuren.selectedThemeId')
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : null
    calls.push({ method, path, body })
    const error = (status: number, code: string) => route.fulfill({ status, json: { error: { code, message: 'Fixture failure, please retry.' } } })
    if (path === '/users/me') return signedIn ? route.fulfill({ json: user }) : error(401, 'unauthorized')
    if (path === '/auth/login' || path === '/auth/register') { signedIn = true; return route.fulfill({ json: user }) }
    if (!signedIn) return error(401, 'unauthorized')
    if (path === '/weddings/me') {
      if (loadFailures-- > 0) return error(503, 'unavailable')
      return exists ? route.fulfill({ json: record }) : error(404, 'not_found')
    }
    if (path === '/weddings' && method === 'POST') { exists = true; record.themeId = null; return route.fulfill({ status: 201, json: record }) }
    if (path === `/weddings/${record.id}` && method === 'PATCH') {
      if (patchFailures-- > 0) return error(503, 'unavailable')
      Object.assign(record, body)
      return route.fulfill({ json: record })
    }
    if (path === `/weddings/${record.id}/content` && method === 'GET') return route.fulfill({ headers: { ETag: '"7"' }, json: content })
    if (path === `/weddings/${record.id}/preview` && method === 'GET') return route.fulfill({ json: { themeId: record.themeId, content } })
    return error(404, 'fixture_unknown')
  })
  return { calls, record, content, mutations: () => calls.filter(call => !['GET', 'HEAD', 'OPTIONS'].includes(call.method)) }
}

const toolbar = (page: Page) => page.getByTestId('public-preview-toolbar')
const useTemplate = (page: Page) => toolbar(page).getByRole('link', { name: /Gunakan Template/i })

async function openPreview(page: Page) {
  await page.goto(preview)
  await expect(toolbar(page)).toBeVisible()
  await expect(page.locator(`.wedding-site[data-theme="${id}"] [data-section]`)).toHaveCount(13)
}

async function submitAuth(page: Page, register = false) {
  if (register) await page.locator('input[autocomplete="name"]').fill('New Couple')
  await page.locator('input[type="email"]').fill('couple@example.invalid')
  await page.locator('input[type="password"]').fill('Fixture-password-2026')
  await page.locator('button[type="submit"]').click()
}

async function expectEditor(page: Page, api: Awaited<ReturnType<typeof mockApi>>) {
  await expect(page).toHaveURL(/\/wedding\/opening$/)
  await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', id)
  await expect(page.getByTestId('preview-frame')).toHaveAttribute('data-device', 'desktop')
  await expect(page.getByTestId('preview-content')).toContainText('Retained Alex')
  await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible()
  expect(api.record.themeId).toBe(id)
  expect(api.mutations().filter(call => call.method === 'PATCH')).toEqual([{ method: 'PATCH', path: '/weddings/public-flow-wedding', body: { themeId: id } }])
  expect(api.mutations().filter(call => call.path.includes('/content') || call.path.includes('/sections/'))).toEqual([])
  expect(api.content.opening.introduction).toBe('Our private saved introduction')
}

test('landing opens the actual public full invitation without wedding reads or writes', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/')
  const card = page.locator('.template-card').first()
  await expect(card).toHaveAttribute('href', `${preview}?from=landing`)
  await card.click()
  await expect(page).toHaveURL(url => url.pathname === preview)
  await expect(toolbar(page)).toContainText('Royal Maroon v2')
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
  expect(api.calls.filter(call => call.path.startsWith('/weddings'))).toEqual([])
  expect(api.mutations()).toEqual([])
})

test('direct and refreshed anonymous previews never probe the session or wedding', async ({ page }) => {
  const api = await mockApi(page)
  await openPreview(page)
  await page.reload()
  await expect(toolbar(page)).toBeVisible()
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
  expect(api.calls).toEqual([])
})

test('login/register switches and refresh retain template choice, then login saves only its real id', async ({ page }) => {
  const api = await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openPreview(page)
  await useTemplate(page).click()
  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(destination)
  await page.locator('a[href^="/register"]').click()
  await expect(page).toHaveURL(/\/register\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(destination)
  await page.reload()
  await expect(page.locator('input[autocomplete="name"]')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(destination)
  await page.locator('a[href^="/login"]').click()
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(destination)
  await submitAuth(page)
  await expectEditor(page, api)
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: `${output}/selected-template-cms-desktop.png` })
})

test('new account creates one wedding and selects the requested real template without copying demo content', async ({ page }) => {
  const api = await mockApi(page, { newWedding: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openPreview(page)
  await useTemplate(page).click()
  await page.locator('a[href^="/register"]').click()
  await submitAuth(page, true)
  await expectEditor(page, api)
  expect(api.calls.filter(call => call.path === '/auth/register')).toHaveLength(1)
  expect(api.calls.filter(call => call.path === '/weddings' && call.method === 'POST')).toHaveLength(1)
  await page.reload()
  await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', id)
  await expect(page.getByTestId('preview-content')).toContainText('Retained Alex')
})

test('signed-in public preview is read-only until use-template selection', async ({ page }) => {
  const api = await mockApi(page, { authenticated: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openPreview(page)
  expect(api.calls).toEqual([])
  await useTemplate(page).click()
  await expectEditor(page, api)
  await page.goto(destination)
  await expectEditor(page, api)
  expect(api.calls.filter(call => call.path === '/auth/login')).toEqual([])
})

test('failed selection stays retriable and does not replace the saved theme before success', async ({ page }) => {
  const api = await mockApi(page, { authenticated: true, patchFailures: 1 })
  await page.goto(destination)
  const alert = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Coba lagi' }) })
  await expect(alert).toBeVisible()
  expect(api.record.themeId).toBe('international')
  await alert.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page).toHaveURL(/\/wedding\/opening$/)
  expect(api.record.themeId).toBe(id)
  expect(api.calls.filter(call => call.method === 'PATCH')).toHaveLength(2)
  expect(api.mutations().filter(call => call.path.includes('/content'))).toEqual([])
})

test('failed wedding load retries without duplicate creation', async ({ page }) => {
  const api = await mockApi(page, { authenticated: true, loadFailures: 1 })
  await page.goto(destination)
  await page.getByRole('button', { name: 'Coba lagi' }).click()
  await expect(page).toHaveURL(/\/wedding\/opening$/)
  expect(api.calls.filter(call => call.path === '/weddings' && call.method === 'POST')).toEqual([])
  expect(api.calls.filter(call => call.method === 'PATCH')).toHaveLength(1)
})

test('invalid selection id never reads or modifies a wedding', async ({ page }) => {
  const api = await mockApi(page, { authenticated: true })
  await page.goto('/use-template/not-a-real-template')
  await expect(page.getByRole('heading', { name: 'Template tidak tersedia' })).toBeVisible()
  expect(api.calls.filter(call => call.path.startsWith('/weddings'))).toEqual([])
  expect(api.mutations()).toEqual([])
})

for (const width of [320, 390]) {
  test(`public floating controls fit ${width}px and keyboard back returns to public gallery`, async ({ page }) => {
    const api = await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    await openPreview(page)
    const bar = toolbar(page)
    await expect(bar).toContainText('Royal Maroon v2')
    await expect(useTemplate(page)).toBeVisible()
    for (const control of await bar.getByRole('link').all()) {
      const box = await control.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.height).toBeGreaterThanOrEqual(24)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await mkdir(output, { recursive: true })
    await page.screenshot({ path: `${output}/public-preview-${width}.png` })
    const back = bar.getByRole('link').filter({ hasText: /Kembali/ })
    await back.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/(?:\/#template|\/templates)$/)
    expect(api.mutations()).toEqual([])
  })
}

test('browser back from authentication returns to read-only public preview and saved-wedding preview stays protected', async ({ page }) => {
  const api = await mockApi(page)
  await openPreview(page)
  await useTemplate(page).click()
  await expect(page).toHaveURL(/\/login\?/)
  await page.goBack()
  await expect(page).toHaveURL(url => url.pathname === preview)
  await expect(toolbar(page)).toBeVisible()
  expect(api.mutations()).toEqual([])
  await page.goto('/wedding/preview')
  await expect(page).toHaveURL(/\/login\?/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/wedding/preview')
  expect(api.calls.filter(call => call.path.startsWith('/weddings'))).toEqual([])
})

test('public gallery search, pagination and preview back preserve anonymous browsing', async ({ page }) => {
  const api = await mockApi(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/templates')
  const cards = page.locator('.public-template')
  await expect(cards).toHaveCount(12)
  await page.getByRole('button', { name: 'Tampilkan lebih banyak' }).click()
  await expect(cards).toHaveCount(24)
  await page.getByRole('searchbox', { name: 'Cari template' }).fill('Royal Maroon v2')
  await expect(cards).toHaveCount(1)
  await cards.first().click()
  await expect(page).toHaveURL(url => url.pathname === preview && url.searchParams.get('from') === 'gallery')
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: `${output}/public-preview-desktop.png` })
  await toolbar(page).getByRole('link', { name: 'Kembali', exact: true }).click()
  await expect(page).toHaveURL(/\/templates$/)
  expect(api.calls).toEqual([])
})

test('legacy aliases and missing-template fallback stay public and never select a theme', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/themes/conventional/preview')
  await expect(toolbar(page)).toBeVisible()
  await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral\/blush-garden\/preview$/)
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
  await page.goto('/themes/this-template-is-missing/preview')
  await expect(page.getByTestId('preview-not-found')).toContainText('this-template-is-missing')
  await expect(page.locator('.wedding-site [data-section]')).toHaveCount(13)
  expect(api.calls).toEqual([])
})
