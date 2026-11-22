/**
 * Live split-screen editor (docs/ux/live-editor.md) end to end, against the real
 * FastAPI + PostgreSQL stack. Every test owns a freshly registered account and
 * wedding (fixtures.ts) and seeds what it needs through the API.
 *
 * Waits are on conditions only: the save status `data-state`, network requests,
 * DB values via the content API (expect.poll), and DOM state in the preview.
 */
import type { Page, Request, Route } from '@playwright/test'

import { expect, test } from './fixtures'

const API = '/api/v1'
const SECTIONS = ['opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing'] as const

interface Wedding {
  id: string
  themeId: string | null
  revision: number
}

async function myWedding(page: Page): Promise<Wedding> {
  const res = await page.request.get(`${API}/weddings/me`)
  expect(res.ok(), `GET /weddings/me → ${res.status()}`).toBe(true)
  return res.json()
}

async function savedContent(page: Page) {
  const w = await myWedding(page)
  const res = await page.request.get(`${API}/weddings/${w.id}/content`)
  expect(res.ok()).toBe(true)
  return res.json()
}

/**
 * Create the wedding through the legacy API (since the invitation engine nothing is
 * auto-created on first visit; `POST /weddings` keeps the pre-2.0 defaults: no seeded
 * sessions) and optionally pick a theme.
 */
async function seedWedding(page: Page, themeId: string | null = 'conventional'): Promise<Wedding> {
  const res = await page.request.post(`${API}/weddings`, { data: themeId ? { themeId } : {} })
  expect(res.status(), `POST /weddings → ${res.status()}`).toBe(201)
  return myWedding(page)
}

/** `/wedding/<slug>` now redirects to the invitation editor route. */
const editorUrl = (slug: string) => new RegExp(`/invitations/[0-9a-f-]{36}/edit/${slug}$`)
const OPENING_WRITES = /\/api\/v1\/(weddings|invitations)\/[^/]+\/sections\/opening$/

const saveStatus = (page: Page) => page.getByTestId('save-status')
const previewContent = (page: Page) => page.getByTestId('preview-content')
const site = (page: Page) => previewContent(page).locator('.wedding-site')

/** Open an editor section and wait until the live preview has rendered the theme. */
async function openEditor(page: Page, section: (typeof SECTIONS)[number] = 'opening') {
  await page.goto(`/wedding/${section}`)
  await expect(page.getByTestId('editor-layout')).toBeVisible()
  await expect(site(page).locator('[data-section]').first()).toBeAttached()
}

async function expectSaved(page: Page, timeout = 15_000) {
  await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved', { timeout })
  await expect(page.getByTestId('save-status-text')).toHaveText('All changes saved')
}

const isContentWrite = (r: Request) => (r.url().includes(`${API}/weddings/`) || r.url().includes(`${API}/invitations/`)) && ['PUT', 'POST', 'DELETE'].includes(r.method())

/** Records every content write the page sends. */
function watchWrites(page: Page) {
  const writes: { method: string; url: string; at: number }[] = []
  page.on('request', (r) => {
    if (isContentWrite(r)) writes.push({ method: r.method(), url: r.url(), at: Date.now() })
  })
  return writes
}

const openingForm = (page: Page) => page.getByTestId('opening-form')

/** Sections are grouped: pick the group tab first, then the section chip. */
async function goToSection(page: Page, group: string, section: string) {
  const nav = page.getByTestId('section-nav')
  await nav.locator(`[data-testid="section-nav-groups"] [role="tab"][data-group="${group}"]`).click()
  await nav.locator(`a[data-section="${section}"]`).click()
}

/**
 * Royal Maroon v2 shows the website title in its Greeting section (since CMS v2.0
 * the greeting is its own optional section): switch it on so the title renders.
 */
async function showGreeting(page: Page, weddingId: string) {
  const res = await page.request.put(`${API}/weddings/${weddingId}/sections/greeting`, { data: { enabled: true, message: 'Welcome to our wedding' } })
  expect(res.ok(), `PUT greeting → ${res.status()}`).toBe(true)
}

test.describe('Live editor', () => {
  test('(1) text edits update the preview immediately, before any save request', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', 'split')
    const writes = watchWrites(page)

    const started = Date.now()
    await openingForm(page).getByLabel('Bride’s name').fill('Kartika Sari')
    // Well within the 1 s autosave debounce.
    await expect(site(page)).toContainText('Kartika Sari', { timeout: 300 })
    const shownAfter = Date.now() - started
    expect(writes, 'the preview must not wait for a save').toHaveLength(0)
    expect(shownAfter).toBeLessThan(1000)

    // Every keystroke is reflected (not only `fill`).
    await openingForm(page).getByLabel('Groom’s name').pressSequentially('Bayu', { delay: 20 })
    await expect(site(page)).toContainText('Bayu', { timeout: 300 })
    expect(writes).toHaveLength(0)

    // ...and then autosaved.
    await expectSaved(page)
    expect(writes.length).toBeGreaterThan(0)
    expect((await savedContent(page)).couple.bride.name).toBe('Kartika Sari')
  })

  test('(2) date and event changes update the preview', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)

    const date = openingForm(page).getByLabel('Wedding date')
    await date.fill('2027-09-04')
    await expect(site(page).locator('[data-section="opening"]')).toContainText(/September[^]*2027/, { timeout: 500 })
    await date.fill('2028-03-12')
    await expect(site(page).locator('[data-section="opening"]')).toContainText(/(March|Maret)[^]*2028/, { timeout: 500 }) // en or id site language
    await expect(site(page).locator('[data-section="opening"]')).not.toContainText('2027')

    // Events: the new-item form previews live, Add persists it ("“X” added" toast kept).
    await goToSection(page, 'events', 'events')
    await expect(page).toHaveURL(editorUrl('events'))
    const events = site(page).locator('[data-section="events"]')
    await page.getByRole('button', { name: 'Add an event' }).click()
    const editor = page.getByTestId('event-editor').last()
    await editor.getByLabel('Event name').fill('Akad Nikah Pagi')
    await expect(events).toContainText('Akad Nikah Pagi', { timeout: 500 })
    await editor.getByLabel('Date').fill('2028-03-12')
    await editor.getByLabel('Start time').fill('08:00')
    await editor.getByLabel('Venue name').fill('Masjid Agung')
    await editor.getByLabel('Address').fill('Jl. Kenanga No. 3, Yogyakarta')
    await expect(events).toContainText('Masjid Agung', { timeout: 500 })
    await editor.locator('[data-action="save-item"]').click()
    await expect(page.getByTestId('toast-status')).toContainText('“Akad Nikah Pagi” added')

    // Existing items autosave; edits show in the preview straight away.
    await page.getByRole('button', { name: /Edit: Akad Nikah Pagi/ }).click()
    const existing = page.locator('[data-item-editor]').getByTestId('event-editor')
    await existing.getByLabel('Venue name').fill('Pendopo Ageng')
    await expect(events).toContainText('Pendopo Ageng', { timeout: 500 })
    await expect(events).not.toContainText('Masjid Agung')
    await existing.locator('[data-action="done-item"]').click()
    await expect.poll(async () => (await savedContent(page)).events[0]?.venueName, { timeout: 15_000 }).toBe('Pendopo Ageng')
    await expectSaved(page)
  })

  test('(3) an image change shows in the preview', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    const field = openingForm(page).getByTestId('image-field')
    await field.getByLabel('Image address').fill('/sample-wedding/cover-photo.jpg')
    // The editor's own thumbnail shows the image straight away.
    await expect(field.getByTestId('image-thumb').locator('img')).toHaveAttribute('src', '/sample-wedding/cover-photo.jpg')
    // The preview only renders an image once it has its (required) description —
    // see the report: the theme's safeImage() drops images without alt text.
    await field.getByLabel('Image description').fill('Dimas and Ayu at the beach')
    const img = site(page).locator('[data-section="opening"] img[src$="/sample-wedding/cover-photo.jpg"]')
    await expect(img).toBeAttached({ timeout: 500 })
    await expect(img).toHaveAttribute('alt', 'Dimas and Ayu at the beach')
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)

    // Then it autosaves.
    await expect
      .poll(async () => (await savedContent(page)).opening.coverImage, { timeout: 15_000 })
      .toMatchObject({ src: '/sample-wedding/cover-photo.jpg', alt: 'Dimas and Ayu at the beach' })
    await expectSaved(page)
  })

  test('(4) Story and Gallery can be hidden from and shown on the website', async ({ page, freshUser }) => {
    void freshUser
    const w = await seedWedding(page)
    // New weddings start with Story and Gallery switched off: show them first.
    for (const section of ['story', 'gallery']) {
      expect((await page.request.put(`${API}/weddings/${w.id}/sections/${section}`, { data: { enabled: true } })).ok()).toBe(true)
    }
    // Optional sections only render with content: seed one entry each through the API.
    expect((await page.request.post(`${API}/weddings/${w.id}/stories`, { data: { title: 'We met', date: 'March 2018', description: 'At a friend’s wedding in Bandung.' } })).status()).toBe(201)
    expect(
      (await page.request.post(`${API}/weddings/${w.id}/gallery`, { data: { src: '/sample-wedding/gallery-1.svg', alt: 'Flowers' } })).status(),
    ).toBe(201)

    for (const [section, key] of [
      ['story', 'story'],
      ['gallery', 'gallery'],
    ] as const) {
      await openEditor(page, section)
      const inPreview = site(page).locator(`[data-section="${section}"]`)
      const toggle = page.locator('#f-enabled')
      await expect(inPreview).toHaveCount(1)
      await expect(toggle).toBeChecked()

      await toggle.click()
      await expect(page.getByTestId('section-hidden-note')).toBeVisible()
      await expect(inPreview).toHaveCount(0, { timeout: 500 })
      await expect.poll(async () => (await savedContent(page))[key].enabled, { timeout: 15_000 }).toBe(false)
      await expectSaved(page)

      await toggle.click()
      await expect(page.getByTestId('section-hidden-note')).toHaveCount(0)
      await expect(inPreview).toHaveCount(1, { timeout: 500 })
      await expect.poll(async () => (await savedContent(page))[key].enabled, { timeout: 15_000 }).toBe(true)
      await expectSaved(page)
    }
  })

  test('(5) a non-default template keeps its own visual components in the live preview', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page, 'royal-maroon-v2')
    await openEditor(page)

    await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', 'royal-maroon-v2')
    await expect(page.getByTestId('preview-theme-name')).toHaveText('Royal Maroon v2')
    await expect(page.getByTestId('preview-no-theme')).toHaveCount(0)
    const root = previewContent(page).locator('.wedding-site[data-theme="royal-maroon-v2"] > article.rm2[data-variant="royal-maroon-v2"]')
    await expect(root).toBeAttached()

    const ornamentsBefore = await root.locator('.rm2-corner').count()
    expect(ornamentsBefore).toBeGreaterThan(0)
    await expect(root.locator('.rm2-monogram').first()).toBeAttached()

    await openingForm(page).getByLabel('Groom’s name').fill('Raden Wijaya')
    await openingForm(page).getByLabel('Bride’s name').fill('Sekar Ayu')
    await expect(root.locator('.rm2-hero__names')).toContainText('Raden Wijaya', { timeout: 500 })
    // The live patch updates text only: ornaments, monogram and the theme's styles stay.
    await expect(root.locator('.rm2-corner')).toHaveCount(ornamentsBefore)
    await expect(root.locator('.rm2-monogram').first()).toContainText(/R/)
    const corner = root.locator('.rm2-corner').first()
    const box = await corner.boundingBox()
    expect(box && box.width > 0 && box.height > 0, 'ornament is rendered with a size').toBe(true)
    const font = await root.evaluate((el) => getComputedStyle(el).fontFamily)
    expect(font).toMatch(/Garamond|Cinzel/)
    await expectSaved(page)
  })

  test('(6) autosave persists edits to the database', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    const writes = watchWrites(page)

    await openingForm(page).getByLabel('Website title').pressSequentially('Dimas & Ayu', { delay: 30 })
    await expect(saveStatus(page)).toHaveAttribute('data-state', /unsaved|saving/)
    await expect(page.locator('[data-action="save-now"]')).toBeVisible()
    await expectSaved(page)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Dimas & Ayu')
    // Debounced: one write for the whole burst of keystrokes, and no "saved" toast.
    expect(writes.filter((w) => w.url.endsWith('/sections/opening'))).toHaveLength(1)
    await expect(page.getByTestId('toast-status')).not.toContainText(/saved/i)

    // "Save now" saves at once.
    await openingForm(page).getByLabel('Website title').fill('Dimas & Ayu 2027')
    await page.locator('[data-action="save-now"]').click()
    await expectSaved(page, 3_000)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Dimas & Ayu 2027')
  })

  test('(7) a failed save keeps the local changes and Retry saves them', async ({ page, freshUser }) => {
    void freshUser
    test.setTimeout(60_000) // three automatic retries (2 s, 5 s, 10 s) before "Couldn't save"
    await showGreeting(page, (await seedWedding(page, 'royal-maroon-v2')).id) // renders the website title in the preview
    await openEditor(page)

    let failures = 0
    const fail = async (route: Route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      failures++
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
    }
    await page.route(OPENING_WRITES, fail)

    const title = openingForm(page).getByLabel('Website title')
    await title.fill('Kept locally')
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'failed', { timeout: 30_000 })
    await expect(page.getByTestId('save-status-text')).toHaveText('Couldn’t save')
    await expect(page.getByTestId('save-status-live')).toHaveText(/Couldn.t save/)
    expect(failures).toBe(4) // first attempt + 3 automatic retries
    await expect(title).toHaveValue('Kept locally')
    await expect(site(page)).toContainText('Kept locally')
    expect((await savedContent(page)).opening.weddingTitle).toBeUndefined()

    await page.unroute(OPENING_WRITES, fail)
    await page.locator('[data-action="retry-save"]').click()
    await expectSaved(page)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Kept locally')
    await expect(page.getByTestId('save-status-live')).toHaveText('All changes saved')
  })

  test('(8) a slow earlier save never overwrites a newer edit', async ({ page, freshUser }) => {
    void freshUser
    await showGreeting(page, (await seedWedding(page, 'royal-maroon-v2')).id) // renders the website title in the preview
    await openEditor(page)

    let release!: () => void
    const released = new Promise<void>((r) => (release = r))
    let firstSeen!: () => void
    const firstArrived = new Promise<void>((r) => (firstSeen = r))
    const bodies: string[] = []
    await page.route(OPENING_WRITES, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      bodies.push(route.request().postData() ?? '')
      if (bodies.length === 1) {
        // The server applies the first write, but its response arrives late.
        const response = await route.fetch()
        firstSeen()
        await released
        return route.fulfill({ response })
      }
      return route.continue()
    })

    const title = openingForm(page).getByLabel('Website title')
    await title.fill('First edit')
    await firstArrived
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'saving')
    await title.fill('Second edit')
    await expect(site(page)).toContainText('Second edit')
    release()

    await expectSaved(page)
    expect(bodies).toHaveLength(2)
    expect(JSON.parse(bodies[0]!).weddingTitle).toBe('First edit')
    expect(JSON.parse(bodies[1]!).weddingTitle).toBe('Second edit')
    expect((await savedContent(page)).opening.weddingTitle).toBe('Second edit')
    await expect(title).toHaveValue('Second edit')
    await expect(site(page)).toContainText('Second edit')
    await expect(site(page)).not.toContainText('First edit')
  })

  test('(9) reload restores the persisted content', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    await openingForm(page).getByLabel('Groom’s name').fill('Dimas Pratama')
    await openingForm(page).getByLabel('Website title').fill('After reload')
    await expectSaved(page)

    await page.reload()
    await expect(page.getByTestId('editor-layout')).toBeVisible()
    await expect(openingForm(page).getByLabel('Groom’s name')).toHaveValue('Dimas Pratama')
    await expect(openingForm(page).getByLabel('Website title')).toHaveValue('After reload')
    await expect(site(page)).toContainText('Dimas Pratama')
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved')
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

    test('(10) switching Edit and Preview keeps the typed value and the preview shows it', async ({ page, freshUser }) => {
      void freshUser
      await seedWedding(page)
      await page.goto('/wedding/opening')
      const layout = page.getByTestId('editor-layout')
      await expect(layout).toHaveAttribute('data-mode', 'tabs')
      const tabs = page.getByRole('tablist', { name: 'Editor view' })
      const editTab = tabs.getByRole('tab', { name: 'Edit' })
      const previewTab = tabs.getByRole('tab', { name: 'Preview' })
      await expect(editTab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByTestId('preview-panel')).toBeHidden()

      const bride = openingForm(page).getByLabel('Bride’s name')
      await bride.fill('Ayu Lestari')
      // Switch before the autosave fires: the preview shows the live working copy.
      await previewTab.click()
      await expect(previewTab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByTestId('editor-panel')).toBeHidden()
      await expect(page.getByTestId('preview-panel')).toBeVisible()
      await expect(page.getByTestId('preview-frame')).toHaveAttribute('data-device', 'phone')
      await expect(site(page)).toContainText('Ayu Lestari')
      await expect(saveStatus(page)).toBeVisible() // save status sits in the tab bar on both tabs

      await editTab.click()
      await expect(bride).toBeVisible()
      await expect(bride).toHaveValue('Ayu Lestari')
      await expectSaved(page)
      expect((await savedContent(page)).couple.bride.name).toBe('Ayu Lestari')
    })
  })

  test.describe('narrow phone', () => {
    test.use({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true })

    test('(11) no horizontal page overflow at 320px on every /wedding page, in both tabs', async ({ page, freshUser }) => {
      void freshUser
      await seedWedding(page)
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      for (const section of SECTIONS) {
        await page.goto(`/wedding/${section}`)
        await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', 'tabs')
        await expect(page.getByTestId(/.*-form|list-editor|section-toggle/).filter({ visible: true }).first()).toBeVisible()
        expect(await overflow(), `/wedding/${section} (Edit) must not scroll horizontally`).toBeLessThanOrEqual(0)

        await page.getByRole('tab', { name: 'Preview' }).click()
        await expect(site(page).locator('[data-section]').first()).toBeVisible()
        const scale = Number(await page.getByTestId('preview-stage').getAttribute('data-scale'))
        expect(scale, 'phone frame is scaled to fit').toBeLessThan(1)
        expect(await overflow(), `/wedding/${section} (Preview) must not scroll horizontally`).toBeLessThanOrEqual(0)
        await page.screenshot({ path: `test-results/screens/live-${section}-320-preview.png` })
      }
      await page.goto('/wedding/preview')
      await expect(page.locator('.wedding-site').first()).toBeVisible()
      expect(await overflow(), '/wedding/preview must not scroll horizontally').toBeLessThanOrEqual(0)
    })
  })

  test('(12) choosing a section scrolls the preview to it without moving focus into it', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    const frame = page.getByTestId('preview-frame')
    // The editor preview now opens at desktop size (see isolated/cms-polish.spec.ts); this test
    // measures scrolling in the phone frame, so switch to it first.
    await expect(frame).toHaveAccessibleName('Live preview, desktop size — scrollable')
    await page.getByTestId('preview-device').first().locator('input[data-value="phone"]').check({ force: true })
    await expect(frame).toHaveAccessibleName('Live preview, phone size — scrollable')

    const offsetOf = async (key: string) => {
      const [f, s] = await Promise.all([frame.boundingBox(), site(page).locator(`[data-section="${key}"]`).boundingBox()])
      return s!.y - f!.y
    }
    expect(await offsetOf('events')).toBeGreaterThan(100) // well below the fold at first

    await goToSection(page, 'events', 'events')
    await expect(page).toHaveURL(editorUrl('events'))
    await expect.poll(() => offsetOf('events')).toBeGreaterThanOrEqual(-2)
    await expect.poll(() => offsetOf('events')).toBeLessThanOrEqual(24)
    expect(await frame.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)

    const focus = await page.evaluate(() => {
      const el = document.activeElement
      return {
        inPreview: !!el?.closest('[data-testid="preview-panel"]'),
        tag: el?.tagName,
      }
    })
    expect(focus.inPreview, 'focus must not move into the preview').toBe(false)
    expect(focus.tag).toBe('H1')

    // Back to an earlier section scrolls up again.
    await goToSection(page, 'wedding', 'couple')
    await expect.poll(() => offsetOf('couple')).toBeGreaterThanOrEqual(-2)
    await expect.poll(() => offsetOf('couple')).toBeLessThanOrEqual(24)
  })

  test('(14) leaving with a value that cannot be saved asks for confirmation', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await openEditor(page)
    await openingForm(page).getByLabel('Website title').fill('y'.repeat(121))
    // After the autosave pause the status says the field needs attention, and it is announced once.
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'invalid')
    await expect(page.getByTestId('save-status-live')).toContainText('check the highlighted fields')
    await goToSection(page, 'events', 'events')
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(editorUrl('opening'))
    await expect(saveStatus(page)).not.toHaveAttribute('data-state', 'saved')
    expect((await savedContent(page)).opening.weddingTitle).toBeUndefined()
  })

  test('(15) theme selection and the full-screen preview work from the editor', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page, null)
    await openEditor(page)
    // No theme yet: the default theme renders with a note.
    await expect(page.getByTestId('preview-no-theme')).toBeVisible()

    await page.getByTestId('preview-theme-change').click()
    await expect(page).toHaveURL(/\/themes$/)
    // Stay in the app: selection saves to the invitation that is open (a fresh page load has
    // none open and would start the creation wizard instead).
    await page.locator('[data-family-card="classic"] a').click()
    await page.locator('[data-collection-card="romantic-floral"] a').click()
    await expect(page).toHaveURL(/\/themes\/classic\/romantic-floral$/)
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect(page).toHaveURL(editorUrl('(opening|couple|story|events|gallery|rsvp|closing)'))
    await expect.poll(async () => (await myWedding(page)).themeId).toBe('conventional')
    await page.goto('/wedding/opening')
    await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', 'conventional')
    await expect(page.getByTestId('preview-no-theme')).toHaveCount(0)
    await expect(page.getByTestId('preview-theme-name')).not.toHaveText('')

    // An edit made just before opening full screen is shown there (the leave guard flushes it).
    await openingForm(page).getByLabel('Groom’s name').fill('Full Screen Groom')
    const fullscreen = page.getByTestId('preview-fullscreen')
    await expect(fullscreen).toHaveAccessibleName(/Full screen/)
    await fullscreen.click()
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/preview\?from=.*opening$/)
    const full = page.locator('.wedding-site[data-theme="conventional"]')
    await expect(full.getByText('Full Screen Groom').first()).toBeVisible()
    expect((await savedContent(page)).couple.groom.name).toBe('Full Screen Groom')

    await page.getByTestId('back-to-editing').click()
    await expect(page).toHaveURL(editorUrl('opening'))
  })

  test('(16a) conflict: another device saved first; "Keep mine" saves the local edit', async ({ page, freshUser }) => {
    void freshUser
    const w = await seedWedding(page)
    await openEditor(page)

    // Another device writes (no If-Match = unconditional) → the editor's revision is now stale.
    const other = await page.request.put(`${API}/weddings/${w.id}/sections/opening`, { data: { weddingTitle: 'From another device' } })
    expect(other.ok()).toBe(true)

    await openingForm(page).getByLabel('Website title').fill('Mine')
    const banner = page.getByTestId('conflict-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner).toHaveAttribute('role', 'alert')
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'conflict')
    expect((await savedContent(page)).opening.weddingTitle).toBe('From another device')

    await banner.locator('[data-action="keep-mine"]').click()
    // Overwriting the other device's version is confirmed first (WCAG 3.3.4).
    const keepDialog = page.getByTestId('confirm-dialog').filter({ visible: true })
    await expect(keepDialog).toContainText('Replace the other version?')
    await keepDialog.locator('[data-action="confirm"]').click()
    // The banner is gone; focus lands on the save status, not <body>.
    await expect(page.locator('[data-save-status-anchor]:focus')).toHaveCount(1)
    await expectSaved(page)
    await expect(banner).toHaveCount(0)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Mine')
  })

  test('(16b) conflict: "Reload latest" asks first, then shows the other device’s version', async ({ page, freshUser }) => {
    void freshUser
    const w = await seedWedding(page)
    await openEditor(page)
    expect(
      (await page.request.put(`${API}/weddings/${w.id}/sections/opening`, { data: { weddingTitle: 'From another device' } })).ok(),
    ).toBe(true)

    const title = openingForm(page).getByLabel('Website title')
    await title.fill('Mine')
    const banner = page.getByTestId('conflict-banner')
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.locator('[data-action="reload-latest"]').click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toContainText('Reload the latest version?')
    await dialog.getByRole('button', { name: 'Reload latest' }).click()

    await expect(title).toHaveValue('From another device')
    await expect(banner).toHaveCount(0)
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved')
    expect((await savedContent(page)).opening.weddingTitle).toBe('From another device')

    // Autosave works again afterwards with the new revision.
    await title.fill('After reload')
    await expectSaved(page)
    expect((await savedContent(page)).opening.weddingTitle).toBe('After reload')
  })

  test('divider resizes the editor by keyboard and the width persists', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await page.addInitScript(() => {
      // Only clear on the very first load of this test, so the reload below keeps the saved width.
      if (!sessionStorage.getItem('divider-test')) {
        sessionStorage.setItem('divider-test', '1')
        localStorage.removeItem('kuren.editor.width')
      }
    })
    await openEditor(page)
    const divider = page.getByRole('separator', { name: 'Resize editor' })
    await expect(divider).toHaveAttribute('data-testid', 'editor-divider')
    await expect(divider).toHaveAttribute('aria-valuenow', '40')
    const min = Number(await divider.getAttribute('aria-valuemin'))
    const max = Number(await divider.getAttribute('aria-valuemax'))
    expect(min).toBeGreaterThanOrEqual(30)
    expect(max).toBeLessThanOrEqual(55)

    await divider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', '42')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', String(Math.min(52, max)))
    await page.keyboard.press('ArrowLeft')
    await expect(divider).toHaveAttribute('aria-valuenow', String(Math.min(52, max) - 2))
    await page.keyboard.press('Home')
    await expect(divider).toHaveAttribute('aria-valuenow', String(min))
    await page.keyboard.press('End')
    await expect(divider).toHaveAttribute('aria-valuenow', String(max))
    await page.keyboard.press('Enter')
    await expect(divider).toHaveAttribute('aria-valuenow', '40')

    await page.keyboard.press('Shift+ArrowRight')
    await expect(divider).toHaveAttribute('aria-valuenow', '50')
    expect(await page.evaluate(() => localStorage.getItem('kuren.editor.width'))).toBe('50')
    const ratio = async () => {
      const [e, g] = await Promise.all([page.getByTestId('editor-panel').boundingBox(), page.getByTestId('editor-layout').boundingBox()])
      return e!.width / g!.width
    }
    expect(await ratio()).toBeCloseTo(0.5, 1)

    await page.reload()
    await expect(page.getByRole('separator', { name: 'Resize editor' })).toHaveAttribute('aria-valuenow', '50')
    expect(await ratio()).toBeCloseTo(0.5, 1)
  })
})

