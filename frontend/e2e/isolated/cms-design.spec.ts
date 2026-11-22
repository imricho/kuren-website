import { expect, test, type Page } from '@playwright/test'
import { normalizeDraft, type WeddingDraft } from '../../src/features/wedding/draft'
import { sampleWedding } from '../../src/features/wedding/sampleWedding'

const runtimeErrors = new WeakMap<Page, string[]>()
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? [], 'CMS must not produce runtime errors').toEqual([])
})

// Deterministic visual/editor checks. All API calls are intercepted; no accounts,
// public invitation records, messages, or payment transactions are created.
async function editorApi(page: Page, locale: 'en' | 'id' = 'en') {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', error => { errors.push(error.message); console.log('CMS PAGE ERROR:', error.message) })
  const content: WeddingDraft = normalizeDraft(structuredClone(sampleWedding))
  content.locale = locale
  content.opening.weddingDate = '2027-06-12'
  let revision = 1
  const wedding = {
    id: 'cms-design-wedding', themeId: 'royal-maroon-v2', locale,
    // Invitation engine v2.0 record fields (InvitationRead ⊇ WeddingRead).
    category: 'wedding', variant: 'wedding_ceremony', title: null as string | null, timezone: 'Asia/Jakarta',
    status: 'draft', revision, publishedAt: null as string | null, slug: null as string | null,
    publication: null as { publishedAt: string; revision: number; themeId: string } | null,
    hasUnpublishedChanges: false,
    createdAt: '2026-11-17T12:00:00Z', updatedAt: '2026-11-17T12:00:00Z',
  }
  const calls: { method: string; path: string; body: unknown }[] = []
  await page.addInitScript((language) => {
    localStorage.setItem('kuren.appLocale', language)
    localStorage.setItem('kuren.welcomeSeen.cms-design-user', '1')
  }, locale)
  // Source edits must not reload a test in the middle of autosave assertions.
  await page.routeWebSocket(url => url.pathname === '/' && url.searchParams.has('token'), () => {})
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const method = request.method()
    const body = ['GET', 'HEAD'].includes(method) ? undefined : request.postDataJSON()
    calls.push({ method, path, body })
    const respond = (json: unknown, status = 200) => route.fulfill({ status, json, headers: { ETag: `"${revision}"` } })
    if (path === '/users/me') return respond({ id: 'cms-design-user', email: 'fixture@example.invalid', full_name: 'Alex Wijaya', created_at: '2026-01-01' })
    if (path === '/weddings/me') return respond(wedding)
    if (path === '/invitation-types') return route.continue()
    if (path === '/invitations' && method === 'GET') {
      const { id, title, category, variant, themeId, status, slug, hasUnpublishedChanges, updatedAt, publishedAt } = wedding
      return respond({ items: [{ id, title, category, variant, themeId, status, slug, hasUnpublishedChanges, eventDate: content.opening.weddingDate, updatedAt, publishedAt }] })
    }
    if (path === '/invitations/cms-design-wedding' && method === 'GET') return respond(wedding)
    if (path.endsWith('/content')) return respond(content)
    if (/^\/(weddings|invitations)\/cms-design-wedding$/.test(path) && method === 'PATCH') {
      Object.assign(wedding, body)
      return respond(wedding)
    }
    const section = path.match(/\/sections\/([^/]+)$/)?.[1]
    if (section && method === 'PUT') {
      revision++
      wedding.revision = revision
      const target = content as unknown as Record<string, unknown>
      if (section === 'story') content.story = { ...body, timeline: content.story.timeline }
      else if (section === 'gallery') content.gallery = { ...body, images: content.gallery.images }
      else target[section] = body
      return respond(body)
    }
    if (section && method === 'GET') return respond((content as unknown as Record<string, unknown>)[section] ?? {})
    if (path.endsWith('/publish') && method === 'POST') {
      wedding.status = 'published'
      wedding.publishedAt = '2026-11-17T12:30:00Z'
      wedding.slug = 'cms-design-fixture'
      wedding.publication = { publishedAt: '2026-11-17T12:30:00Z', revision, themeId: wedding.themeId }
      return respond(wedding)
    }
    if (/\/(stories|events|gallery)$/.test(path)) {
      const name = path.split('/').at(-1)
      return respond(name === 'stories' ? content.story.timeline : name === 'gallery' ? content.gallery.images : content.events)
    }
    return respond({ error: { code: 'fixture_unknown', message: path } }, 404)
  })
  return { content, calls }
}

async function openEditor(page: Page) {
  await page.goto('/wedding/opening')
  await expect(page.getByTestId('editor-layout')).toBeVisible()
  await expect(page.getByTestId('opening-form')).toBeVisible()
}

for (const width of [1606, 1280, 768, 390, 320]) {
  test(`CMS reference layout fits ${width}px with labelled working controls`, async ({ page }) => {
    await editorApi(page, 'id')
    await page.setViewportSize({ width, height: width >= 1280 ? 979 : 900 })
    await openEditor(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByTestId('opening-form').getByLabel(/Nama mempelai pria|Nama Mempelai Pria/i)).toBeVisible()
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    // A real template still carries its own ornament, while the CMS chrome is plain.
    if (width >= 1440) {
      await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', 'royal-maroon-v2')
      await expect(page.getByTestId('preview-content').locator('.rm2-corner').first()).toBeAttached()
      const preview = await page.getByTestId('preview-panel').boundingBox()
      const form = await page.getByTestId('editor-panel').boundingBox()
      expect(preview!.x).toBeLessThan(form!.x)
    }
    for (const control of await page.locator('button:visible, a:visible, summary:visible').all()) {
      if (await control.evaluate(el => !!el.closest('[inert]'))) continue
      expect((await control.getAttribute('aria-label')) || (await control.getAttribute('title')) || (await control.innerText()).trim()).toBeTruthy()
    }
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${process.env.CMS_DESIGN_SCREENSHOTS ?? 'test-results/cms-design'}/cms-${width}.png`, fullPage: true })
  })
}

test('live text edits remain immediate and autosave through the new layout', async ({ page }) => {
  const api = await editorApi(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await openEditor(page)
  const site = page.getByTestId('preview-content').locator('.wedding-site')
  await page.getByTestId('opening-form').getByLabel('Bride’s name').fill('Kartika Sari')
  await expect(site).toContainText('Kartika Sari', { timeout: 800 })
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 })
  expect(api.calls.some(call => call.method === 'PUT' && call.path.endsWith('/sections/couple'))).toBe(true)
  expect(api.content.couple.bride.name).toBe('Kartika Sari')
})

test('section navigation is keyboard usable and preserves the selected route', async ({ page }) => {
  await editorApi(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await openEditor(page)
  const couple = page.getByTestId('section-nav').locator('a[data-section="couple"]')
  await couple.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/invitations\/cms-design-wedding\/edit\/couple$/)
  await expect(couple).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

test('mobile tabs support arrows and keep field edits mounted', async ({ page }) => {
  await editorApi(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await openEditor(page)
  const field = page.getByTestId('opening-form').getByLabel('Bride’s name')
  await field.fill('Kartika Mobile')
  const edit = page.locator('#editor-tab-edit')
  const preview = page.locator('#editor-tab-preview')
  await edit.focus()
  await page.keyboard.press('ArrowRight')
  await expect(preview).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('preview-panel')).toBeVisible()
  await expect(page.getByTestId('preview-content')).toContainText('Kartika Mobile')
  await page.keyboard.press('ArrowLeft')
  await expect(edit).toHaveAttribute('aria-selected', 'true')
  await expect(field).toHaveValue('Kartika Mobile')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('publish entry still reaches the real checklist and publishes only on request', async ({ page }) => {
  const api = await editorApi(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await openEditor(page)
  await page.locator('[data-action="open-publish"]:visible').first().click()
  await expect(page).toHaveURL(/\/invitations\/cms-design-wedding\/edit\/publish$/)
  await expect(page.getByTestId('publish-page')).toBeVisible()
  expect(api.calls.some(call => call.path.endsWith('/publish'))).toBe(false)
  await page.locator('[data-action="publish"]').click()
  await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published')
  expect(api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/publish'))).toHaveLength(1)
  await expect(page.getByTestId('public-url')).toHaveValue(/\/i\/cms-design-fixture$/)
})


test('wide preview controls and divider are keyboard usable without collapsing preview', async ({ page }) => {
  await editorApi(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await openEditor(page)
  const phone = page.getByTestId('preview-device').locator('input[data-value="phone"]')
  const desktop = page.getByTestId('preview-device').locator('input[data-value="desktop"]')
  await phone.focus()
  await page.keyboard.press('ArrowRight')
  await expect(desktop).toBeChecked()
  const divider = page.getByRole('separator', { name: 'Resize editor' })
  const before = (await divider.boundingBox())!.x
  await divider.focus()
  await page.keyboard.press('ArrowRight')
  expect((await divider.boundingBox())!.x).toBeGreaterThan(before)
  await page.keyboard.press('End')
  expect((await page.getByTestId('preview-panel').boundingBox())!.width).toBeGreaterThanOrEqual(419.5)
})


test('mobile skip navigation and account menu stay keyboard usable', async ({ page }) => {
  await editorApi(page)
  await page.setViewportSize({ width: 390, height: 900 })
  await openEditor(page)
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveAttribute('href', '#cms-main')
  await page.keyboard.press('Enter')
  await expect(page.locator('#cms-main')).toBeFocused()
  const account = page.getByTestId('account-menu-button')
  await account.focus()
  await page.keyboard.press('Enter')
  await expect(account).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(account).toHaveAttribute('aria-expanded', 'false')
  await expect(account).toBeFocused()
})

test('resizing across every editor layout keeps the same draft and preview mounted', async ({ page }) => {
  await editorApi(page)
  await page.setViewportSize({ width: 1606, height: 979 })
  await openEditor(page)
  const field = page.getByTestId('opening-form').getByLabel('Bride’s name')
  const site = page.getByTestId('preview-content').locator('.wedding-site')
  await field.fill('Kartika Responsive')
  await expect(site).toContainText('Kartika Responsive')
  await field.evaluate(el => el.setAttribute('data-qa-identity', 'original-field'))
  await site.evaluate(el => el.setAttribute('data-qa-identity', 'original-preview'))
  for (const width of [1280, 390, 1606]) {
    await page.setViewportSize({ width, height: 979 })
    await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', width >= 1024 ? 'split' : 'tabs')
    await expect(page.getByTestId('editor-outline')).toHaveCount(width >= 1440 ? 1 : 0)
    await expect(field).toHaveValue('Kartika Responsive')
    await expect(field).toHaveAttribute('data-qa-identity', 'original-field')
    await expect(site).toHaveAttribute('data-qa-identity', 'original-preview')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await expect(page.getByTestId('preview-device')).toBeVisible()
  await expect(site).toContainText('Kartika Responsive')
})
