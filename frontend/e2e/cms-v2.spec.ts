/**
 * CMS Integration v2.0 end to end (docs/api/weddings.md "CMS v2.0 additions",
 * docs/universal-wedding-content-v1.1.md), against the real FastAPI + PostgreSQL stack.
 *
 * Every test owns a freshly registered account and wedding (fixtures.ts) and seeds
 * state through the API; the UI is only driven for the behaviour under test.
 * Waits are condition-based only: save-status / publish-status `data-state`,
 * expect.poll on the content API, and DOM state in the preview / public page.
 */
import { readFileSync } from 'node:fs'

import type { Browser, Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { qrisFile } from './fixtures/png'

const API = '/api/v1'
const THEME_IDS: string[] = JSON.parse(
  readFileSync(new URL('../src/features/themes/catalog/selectable-theme-ids.json', import.meta.url), 'utf8'),
)
const CANONICAL_ORDER = [
  'opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate', 'events', 'story',
  'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
]
/** Editor placeholders that must never reach guests (features/wedding/draft.ts, en + id). */
const PLACEHOLDERS = [
  'Groom’s name', 'Bride’s name', 'Your wedding title', 'Event details coming soon', 'Venue to be announced',
  'Address coming soon', 'Your closing message will appear here', 'Your names', 'Judul pernikahan Anda',
]

interface Wedding {
  id: string
  themeId: string | null
  revision: number
  status: string
  slug: string | null
  hasUnpublishedChanges: boolean
}
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// --- API seeding ------------------------------------------------------------------------

async function createWedding(page: Page, themeId: string | null = 'royal-maroon-v2'): Promise<Wedding> {
  const res = await page.request.post(`${API}/weddings`, { data: { themeId } })
  expect(res.status(), `POST /weddings → ${res.status()}`).toBe(201)
  return res.json()
}

async function getWedding(page: Page): Promise<Wedding> {
  const res = await page.request.get(`${API}/weddings/me`)
  expect(res.ok()).toBe(true)
  return res.json()
}

async function getContent(page: Page, id: string): Promise<Json> {
  const res = await page.request.get(`${API}/weddings/${id}/content`)
  expect(res.ok()).toBe(true)
  return res.json()
}

async function putContent(page: Page, id: string, data: Json) {
  const res = await page.request.put(`${API}/weddings/${id}/content`, { data })
  expect(res.ok(), `PUT /content → ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

async function putSection(page: Page, id: string, section: string, data: Json) {
  const res = await page.request.put(`${API}/weddings/${id}/sections/${section}`, { data })
  expect(res.ok(), `PUT /sections/${section} → ${res.status()} ${await res.text()}`).toBe(true)
}

async function publishApi(page: Page, id: string): Promise<Wedding> {
  const res = await page.request.post(`${API}/weddings/${id}/publish`)
  expect(res.status(), `publish → ${res.status()} ${await res.text()}`).toBe(200)
  return res.json()
}

async function publicJson(page: Page, slug: string) {
  return page.request.get(`${API}/public/weddings/${slug}`)
}

/** The minimum a wedding needs to be published (story and gallery switched off). */
function requiredDraft(): Json {
  return {
    opening: { weddingDate: '2027-09-04' },
    couple: { groom: { name: 'Dimas Pratama', nickname: 'Dimas' }, bride: { name: 'Ayu Lestari', nickname: 'Ayu' } },
    story: { enabled: false, timeline: [] },
    gallery: { enabled: false, images: [] },
    rsvp: { enabled: false },
    events: [
      { id: 'akad', type: 'akad', title: 'Akad Nikah', date: '2027-09-04', startTime: '08:00', endTime: '10:00', venueName: 'Masjid Agung', address: 'Jl. Kenanga No. 3, Yogyakarta' },
    ],
    closing: { message: 'Thank you for your prayers and blessings.' },
  }
}

/** Every section filled and shown. Neutral sample text only (no attributed scripture). */
function fullDraft(): Json {
  return {
    ...requiredDraft(),
    opening: { weddingTitle: 'The Wedding of Dimas & Ayu', weddingDate: '2027-09-04' },
    story: { enabled: true, timeline: [{ id: 's1', title: 'We met', date: 'March 2018', description: 'At a friend’s wedding in Bandung.' }] },
    gallery: { enabled: true, images: [{ id: 'g1', src: '/sample-wedding/gallery-1.svg', alt: 'Flowers' }] },
    rsvp: { enabled: true },
    holyRecite1: { enabled: true, originalScript: 'مرحبا بكم', translation: 'Welcome, everyone', translationLanguage: 'en' },
    greeting: { enabled: true, title: 'A warm welcome', message: 'We joyfully invite you to celebrate with us.' },
    wishes: { enabled: true, title: 'Wishes' },
    amplopDigital: {
      enabled: true,
      bankAccountsEnabled: true,
      bankAccounts: [{ id: 'b1', bankName: 'Bank Satu', accountHolder: 'Dimas Pratama', accountNumber: '0012 3456 7890' }],
      qrisEnabled: false,
    },
    holyRecite2: { enabled: true, passage: 'May your home be filled with peace.', reference: 'Sample blessing' },
  }
}

// --- Editor helpers ---------------------------------------------------------------------

const saveStatus = (page: Page) => page.getByTestId('save-status')
const site = (page: Page) => page.getByTestId('preview-content').locator('.wedding-site')
const inPreview = (page: Page, section: string) => site(page).locator(`[data-section="${section}"]`)
const toggle = (page: Page) => page.locator('#f-enabled')

async function openEditor(page: Page, route: string) {
  await page.goto(`/wedding/${route}`)
  await expect(page.getByTestId('editor-layout')).toBeVisible()
  await expect(site(page).locator('[data-section]').first()).toBeAttached({ timeout: 15_000 })
}

async function expectSaved(page: Page, timeout = 15_000) {
  await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved', { timeout })
}

async function goToSection(page: Page, group: string, section: string) {
  const nav = page.getByTestId('section-nav')
  await nav.locator(`[data-testid="section-nav-groups"] [role="tab"][data-group="${group}"]`).click()
  await nav.locator(`a[data-section="${section}"]`).click()
}

const sectionOrder = (scope: Locator) =>
  scope.locator('[data-section]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-section')))

/** A fresh guest browser (no cookies, no HTTP cache) on the public page. */
async function openGuest(browser: Browser, slug: string, query = '', viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport, reducedMotion: 'reduce' })
  const guest = await context.newPage()
  const errors: string[] = []
  guest.on('pageerror', (e) => errors.push(e.message))
  await guest.goto(`/i/${slug}${query}`)
  await expect(guest.getByTestId('public-invitation').or(guest.getByTestId('public-not-found'))).toBeVisible()
  // The theme component is loaded asynchronously: wait until it has rendered its sections
  // (the closing section is always present) before reading the DOM without auto-waiting.
  if (await guest.getByTestId('public-invitation').count()) {
    await expect(publicSite(guest).locator('[data-section="closing"]')).toBeAttached({ timeout: 15_000 })
  }
  return { guest, context, errors }
}

const publicSite = (guest: Page) => guest.getByTestId('public-invitation').locator('.wedding-site[data-render-mode="public"]')

async function expectNoPlaceholders(scope: Locator, label: string) {
  const text = await scope.innerText()
  for (const p of PLACEHOLDERS) expect(text, `${label}: placeholder “${p}”`).not.toContain(p)
  await expect(scope.locator('[data-editor-only]'), `${label}: editor-only notes`).toHaveCount(0)
}

async function addEvent(page: Page, title: string, start: string, end: string) {
  await page.getByRole('button', { name: 'Add an event' }).click()
  const editor = page.getByTestId('event-editor').last()
  await editor.getByLabel('Event name').fill(title)
  await editor.getByLabel('Date').fill('2027-09-04')
  await editor.getByLabel('Start time').fill(start)
  await editor.getByLabel('End time').fill(end)
  await editor.getByLabel('Venue name').fill(`${title} Hall`)
  await editor.getByLabel('Address').fill('Jl. Kenanga No. 3, Yogyakarta')
  await editor.locator('[data-action="save-item"]').click()
  await expect(page.getByTestId('toast-status')).toContainText(`“${title}” added`)
}

// ========================================================================================

test.describe('CMS v2.0', () => {
  // (1) — four batches so the 49 templates load in parallel workers.
  const BATCHES = 4
  for (let b = 0; b < BATCHES; b++) {
    const ids = THEME_IDS.filter((_, i) => i % BATCHES === b)
    test(`(1) every registered template loads in the CMS preview — batch ${b + 1}/${BATCHES}`, async ({ page, freshUser }) => {
      void freshUser
      test.setTimeout(240_000)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const w = await createWedding(page, null)
      await putContent(page, w.id, fullDraft())
      for (const id of ids) {
        const res = await page.request.patch(`${API}/weddings/${w.id}`, { data: { themeId: id } })
        expect(res.ok(), `PATCH themeId=${id} → ${res.status()}`).toBe(true)
        await page.goto('/wedding/opening')
        const theme = page.getByTestId('preview-frame').locator(`.wedding-site[data-theme="${id}"]`)
        // First load of a template compiles its chunk on the dev server: allow for that under load.
        await expect(theme, id).toBeAttached({ timeout: 20_000 })
        await expect(theme.locator('[data-section="opening"]'), id).toBeAttached()
        await expect(theme.locator('[data-section="closing"]'), id).toBeAttached()
        await expect(theme, id).toContainText('Dimas Pratama')
      }
      expect(errors).toEqual([])
    })
  }

  test('(2) mandatory sections have no visibility switch and their fields are editable', async ({ page, freshUser }) => {
    void freshUser
    test.setTimeout(60_000) // ten editor loads
    const w = await createWedding(page)
    for (const route of ['opening', 'couple', 'date', 'events', 'closing']) {
      await openEditor(page, route)
      await expect(page.getByTestId('always-shown'), route).toBeVisible()
      await expect(page.getByTestId('section-toggle'), route).toHaveCount(0)
      await expect(page.locator('#f-enabled'), route).toHaveCount(0)
    }
    await openEditor(page, 'opening')
    await page.locator('#f-couple-groom-name').fill('Dimas Pratama')
    await page.locator('#f-weddingTitle').fill('Our wedding')
    await expectSaved(page)
    await openEditor(page, 'couple')
    await page.getByTestId('couple-form').locator('#f-bride-name').fill('Ayu Lestari')
    await expectSaved(page)
    await openEditor(page, 'date')
    await page.getByTestId('weddingDate-form').locator('#f-weddingDate').fill('2027-10-10')
    await expectSaved(page)
    await openEditor(page, 'closing')
    await page.getByTestId('closing-form').locator('#f-message').fill('See you there.')
    await expectSaved(page)
    await openEditor(page, 'events')
    await expect(page.getByRole('button', { name: 'Add an event' })).toBeEnabled()

    const c = await getContent(page, w.id)
    expect(c.couple.groom.name).toBe('Dimas Pratama')
    expect(c.couple.bride.name).toBe('Ayu Lestari')
    expect(c.opening).toMatchObject({ weddingTitle: 'Our wedding', weddingDate: '2027-10-10' })
    expect(c.closing.message).toBe('See you there.')
  })

  test('(3) optional section switches reveal and hide their fields', async ({ page, freshUser }) => {
    void freshUser
    await createWedding(page)
    for (const route of ['holy-recite-1', 'greeting', 'wishes', 'gifts', 'holy-recite-2']) {
      await openEditor(page, route)
      await expect(page.getByTestId('section-toggle'), route).toBeVisible()
      await expect(page.getByTestId('always-shown'), route).toHaveCount(0)
      const fields = page.getByTestId('section-fields')
      // New weddings: universal sections start switched off, fields hidden.
      await expect(toggle(page), route).not.toBeChecked()
      await expect(fields, route).toBeHidden()
      await expect(page.getByTestId('section-hidden-note'), route).toBeVisible()
      await toggle(page).click()
      await expect(toggle(page), route).toBeChecked()
      await expect(fields, route).toBeVisible()
      await expect(page.getByTestId('section-hidden-note'), route).toHaveCount(0)
      await expect(page.getByTestId('section-toggle-status'), route).not.toHaveText('')
      await toggle(page).click()
      await expect(fields, route).toBeHidden()
      await expectSaved(page)
    }
  })

  test('(4) the preview updates immediately, before any save request', async ({ page, freshUser }) => {
    void freshUser
    await createWedding(page)
    await openEditor(page, 'greeting')
    const writes: string[] = []
    page.on('request', (r) => {
      if (['PUT', 'POST'].includes(r.method()) && r.url().includes('/weddings/')) writes.push(r.url())
    })
    await expect(inPreview(page, 'greeting')).toHaveCount(0)
    await toggle(page).click()
    await page.locator('#f-title').fill('Selamat datang')
    await expect(inPreview(page, 'greeting')).toContainText('Selamat datang', { timeout: 500 })
    await page.locator('#f-message').pressSequentially('Hadir', { delay: 20 })
    await expect(inPreview(page, 'greeting')).toContainText('Hadir', { timeout: 500 })
    expect(writes, 'the preview must not wait for a save').toHaveLength(0)
    await expectSaved(page)
  })

  test('(5) hidden sections leave no gaps in the preview', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    const draft = fullDraft()
    draft.greeting.enabled = false
    draft.story.enabled = false
    draft.wishes.enabled = false
    await putContent(page, w.id, draft)
    await openEditor(page, 'holy-recite-2')
    const hidden = ['greeting', 'story', 'wishes']
    const expected = CANONICAL_ORDER.filter((s) => !hidden.includes(s))
    await expect.poll(() => sectionOrder(site(page))).toEqual(expected)
    for (const s of hidden) await expect(inPreview(page, s), s).toHaveCount(0)
    // Hide one more live: it disappears and the neighbours become adjacent siblings.
    await toggle(page).click()
    await expect(inPreview(page, 'holyRecite2')).toHaveCount(0)
    await expect.poll(() => sectionOrder(site(page))).toEqual(expected.filter((s) => s !== 'holyRecite2'))
    const heights = await site(page).locator('[data-section]').evaluateAll((nodes) =>
      nodes.map((n) => [n.getAttribute('data-section'), n.getBoundingClientRect().height] as const),
    )
    for (const [s, h] of heights) expect(h, `${s} has no empty wrapper`).toBeGreaterThan(0)
    // amplopDigital is now directly followed by closing in the DOM (no empty wrapper in between).
    const adjacent = await inPreview(page, 'amplopDigital').evaluate((el) => {
      const all = [...document.querySelectorAll('[data-testid="preview-content"] .wedding-site [data-section]')]
      return all[all.indexOf(el) + 1]?.getAttribute('data-section')
    })
    expect(adjacent).toBe('closing')
    await expectSaved(page)
  })

  test('(6) data of a disabled section is preserved', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await openEditor(page, 'greeting')
    await toggle(page).click()
    await page.locator('#f-title').fill('Kept title')
    await page.locator('#f-message').fill('Kept message')
    await expectSaved(page)
    await toggle(page).click()
    await expect(inPreview(page, 'greeting')).toHaveCount(0)
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, w.id)).greeting).toMatchObject({ enabled: false, title: 'Kept title', message: 'Kept message' })

    await page.reload()
    await expect(toggle(page)).not.toBeChecked()
    await toggle(page).click()
    await expect(page.locator('#f-title')).toHaveValue('Kept title')
    await expect(page.locator('#f-message')).toHaveValue('Kept message')
    await expect(inPreview(page, 'greeting')).toContainText('Kept message')
    await expectSaved(page)
    expect((await getContent(page, w.id)).greeting.enabled).toBe(true)
  })

  test('(7) autosave persists content and visibility', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await openEditor(page, 'wishes')
    await expect(page.getByTestId('wishes-coming-soon')).toBeVisible()
    await toggle(page).click()
    await page.locator('#f-title').fill('Doa & Ucapan')
    await page.locator('#f-introduction').fill('Kirimkan doa terbaik Anda')
    await expect(saveStatus(page)).toHaveAttribute('data-state', /unsaved|saving/)
    await expectSaved(page)
    expect((await getContent(page, w.id)).wishes).toMatchObject({ enabled: true, title: 'Doa & Ucapan', introduction: 'Kirimkan doa terbaik Anda' })

    // A mandatory section with its own options: countdown + Add to Calendar.
    await openEditor(page, 'date')
    await page.locator('#f-weddingDate').fill('2027-09-04')
    await page.locator('#cd-addToCalendar').click()
    await expectSaved(page)
    const c = await getContent(page, w.id)
    expect(c.opening.weddingDate).toBe('2027-09-04')
    expect(c.countdown.addToCalendar).toBe(false)
  })

  test('(8) a failed save keeps local edits', async ({ page, freshUser }) => {
    void freshUser
    test.setTimeout(60_000) // first attempt + three automatic retries before "Couldn't save"
    const w = await createWedding(page)
    await putSection(page, w.id, 'greeting', { enabled: true, title: 'Saved title' })
    await openEditor(page, 'greeting')
    let failures = 0
    await page.route('**/api/v1/weddings/*/sections/greeting', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      failures++
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
    })
    await page.locator('#f-message').fill('Typed while offline-ish')
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'failed', { timeout: 30_000 })
    expect(failures).toBeGreaterThanOrEqual(1)
    await expect(page.locator('#f-message')).toHaveValue('Typed while offline-ish')
    await expect(inPreview(page, 'greeting')).toContainText('Typed while offline-ish')
    expect((await getContent(page, w.id)).greeting.message).toBeUndefined()

    await page.unroute('**/api/v1/weddings/*/sections/greeting')
    await page.locator('[data-action="retry-save"]').click()
    await expectSaved(page)
    expect((await getContent(page, w.id)).greeting.message).toBe('Typed while offline-ish')
  })

  test('(9) reload restores drafts', async ({ page, freshUser }) => {
    void freshUser
    await createWedding(page)
    await openEditor(page, 'holy-recite-1')
    await toggle(page).click()
    await page.getByTestId('original-script').fill('مرحبا بكم')
    await page.locator('#f-translation').fill('Welcome, everyone')
    await expectSaved(page)
    await page.reload()
    await expect(toggle(page)).toBeChecked()
    await expect(page.getByTestId('original-script')).toHaveValue('مرحبا بكم')
    await expect(page.locator('#f-translation')).toHaveValue('Welcome, everyone')
    await expect(inPreview(page, 'holyRecite1')).toContainText('Welcome, everyone')
    await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved')
  })

  test.describe('phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

    test('(10) mobile Edit/Preview tabs keep state', async ({ page, freshUser }) => {
      void freshUser
      const w = await createWedding(page)
      await page.goto('/wedding/greeting')
      await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', 'tabs')
      const tabs = page.getByRole('tablist', { name: 'Editor view' })
      await toggle(page).click()
      await page.locator('#f-message').fill('Hello from the phone')
      await tabs.getByRole('tab', { name: 'Preview' }).click()
      await expect(page.getByTestId('editor-panel')).toBeHidden()
      await expect(inPreview(page, 'greeting')).toContainText('Hello from the phone')
      await tabs.getByRole('tab', { name: 'Edit' }).click()
      await expect(toggle(page)).toBeChecked()
      await expect(page.locator('#f-message')).toHaveValue('Hello from the phone')
      await expectSaved(page)
      expect((await getContent(page, w.id)).greeting).toMatchObject({ enabled: true, message: 'Hello from the phone' })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  })

  test('(11) Holy Recite 1 sits immediately after Opening and (12) Holy Recite 2 immediately before Closing', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, fullDraft())
    for (const theme of ['royal-maroon-v2', 'international', 'conventional']) {
      await page.request.patch(`${API}/weddings/${w.id}`, { data: { themeId: theme } })
      await openEditor(page, 'opening')
      await expect(site(page)).toHaveAttribute('data-theme', theme)
      const order = await sectionOrder(site(page))
      expect(order, theme).toEqual(CANONICAL_ORDER)
      expect(order.indexOf('holyRecite1'), `${theme} (11)`).toBe(order.indexOf('opening') + 1)
      expect(order.indexOf('holyRecite2'), `${theme} (12)`).toBe(order.indexOf('closing') - 1)
    }
  })

  test('(12) Holy Recite 2 is immediately before Closing on the public page too', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, fullDraft())
    const { slug } = await publishApi(page, w.id)
    const { guest, context } = await openGuest(browser, slug!)
    const order = await sectionOrder(publicSite(guest))
    expect(order.indexOf('holyRecite1')).toBe(order.indexOf('opening') + 1)
    expect(order.indexOf('holyRecite2')).toBe(order.indexOf('closing') - 1)
    await context.close()
  })

  test('(13) the two Holy Recite sections are independent', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, fullDraft())
    const before = (await getContent(page, w.id)).holyRecite2
    await openEditor(page, 'holy-recite-1')
    await page.locator('#f-translation').fill('Edited first recital')
    await expect(inPreview(page, 'holyRecite1')).toContainText('Edited first recital')
    await expect(inPreview(page, 'holyRecite2')).not.toContainText('Edited first recital')
    await expectSaved(page)
    let c = await getContent(page, w.id)
    expect(c.holyRecite1.translation).toBe('Edited first recital')
    expect(c.holyRecite2).toEqual(before)

    await goToSection(page, 'finishing', 'holyRecite2')
    await expect(page).toHaveURL(/\/wedding\/holy-recite-2$/)
    await expect(page.locator('#f-passage')).toHaveValue('May your home be filled with peace.')
    await toggle(page).click()
    await expect(inPreview(page, 'holyRecite2')).toHaveCount(0)
    await expect(inPreview(page, 'holyRecite1')).toContainText('Edited first recital')
    await expectSaved(page)
    c = await getContent(page, w.id)
    expect(c.holyRecite2.enabled).toBe(false)
    expect(c.holyRecite1.enabled).toBe(true)
    await expect(page.getByTestId('section-nav').locator('a[data-section="holyRecite2"] [data-status="hidden"]')).toHaveCount(1)
    await expect(page.getByTestId('section-nav').locator('a[data-section="holyRecite1"] [data-status="hidden"]')).toHaveCount(0)
  })

  test('(14) Arabic is right-to-left with line breaks kept, mixed with Latin text, no overflow at 375px', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, { ...fullDraft(), holyRecite1: { enabled: false } })
    await openEditor(page, 'holy-recite-1')
    await toggle(page).click()
    const original = 'مرحبا بكم\nأهلا وسهلا'
    await page.getByTestId('original-script').fill(original)
    await page.locator('#f-translation').fill('Welcome (مرحبا) to everyone')
    const script = inPreview(page, 'holyRecite1').locator('[data-role="original-script"]')
    await expect(script).toBeAttached()
    expect(await script.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
    expect((await script.innerText()).split('\n').filter(Boolean)).toEqual(['مرحبا بكم', 'أهلا وسهلا'])
    const translation = inPreview(page, 'holyRecite1').locator('[data-role="translation"]')
    expect(await translation.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr')
    await expectSaved(page)
    expect((await getContent(page, w.id)).holyRecite1.originalScript).toBe(original)

    const { slug } = await publishApi(page, w.id)
    const { guest, context } = await openGuest(browser, slug!, '', { width: 375, height: 812 })
    const pubScript = publicSite(guest).locator('[data-section="holyRecite1"] [data-role="original-script"]')
    await pubScript.scrollIntoViewIfNeeded()
    expect(await pubScript.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
    expect((await pubScript.innerText()).split('\n').filter(Boolean)).toHaveLength(2)
    expect(await guest.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    await context.close()
  })

  test('(15) multiple events show in the preview in order', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await openEditor(page, 'events')
    await addEvent(page, 'Akad Nikah', '08:00', '10:00')
    await addEvent(page, 'Resepsi', '18:30', '21:00')
    await addEvent(page, 'Ngunduh Mantu', '12:00', '14:00')
    await expect.poll(async () => (await getContent(page, w.id)).events.map((e: Json) => e.title)).toEqual(['Akad Nikah', 'Resepsi', 'Ngunduh Mantu'])
    const text = await inPreview(page, 'events').innerText()
    const at = ['Akad Nikah', 'Resepsi', 'Ngunduh Mantu'].map((t) => text.indexOf(t))
    expect(at.every((i) => i >= 0), text).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  test('(16) multiple bank accounts keep their order in the save and the preview', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await openEditor(page, 'gifts')
    await toggle(page).click()
    // First time on: bank transfer starts switched on (universalForms.amplopForm).
    await expect(page.locator('#f-bankAccountsEnabled')).toBeChecked()
    await expect(page.getByTestId('amplop-privacy')).toBeVisible()
    await expect(page.getByTestId('amplop-privacy')).toHaveAttribute('role', 'note')
    const accounts = [
      ['Bank Satu', 'Dimas Pratama', '1111 2222'],
      ['Bank Dua', 'Ayu Lestari', '3333 4444'],
      ['Bank Tiga', 'Keluarga Pratama', '5555-6666'],
    ]
    const panel = page.getByTestId('bank-panel')
    for (let i = 0; i < accounts.length; i++) {
      if ((await panel.getByTestId('bank-row').count()) <= i) await panel.locator('[data-action="add-bank-account"]').click()
      await expect(panel.getByTestId('bank-row')).toHaveCount(i + 1)
      const [bank, holder, number] = accounts[i]!
      await page.locator(`#f-bankAccounts-${i}-bankName`).fill(bank!)
      await page.locator(`#f-bankAccounts-${i}-accountHolder`).fill(holder!)
      await page.locator(`#f-bankAccounts-${i}-accountNumber`).fill(number!)
    }
    await expectSaved(page)
    const saved = (await getContent(page, w.id)).amplopDigital
    expect(saved.bankAccounts.map((a: Json) => [a.bankName, a.accountHolder, a.accountNumber])).toEqual(accounts)
    expect(new Set(saved.bankAccounts.map((a: Json) => a.id)).size).toBe(3)
    const banks = await inPreview(page, 'amplopDigital').locator('.universal-accounts dt').allInnerTexts()
    expect(banks.map((b) => b.trim())).toEqual(['Bank Satu', 'Bank Dua', 'Bank Tiga'])
  })

  test('(17) leading zeros in account numbers are kept end to end', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, requiredDraft())
    await openEditor(page, 'gifts')
    await toggle(page).click()
    await expect(page.locator('#f-bankAccountsEnabled')).toBeChecked()
    if ((await page.getByTestId('bank-row').count()) === 0) await page.locator('[data-action="add-bank-account"]').click()
    await page.locator('#f-bankAccounts-0-bankName').fill('Bank Satu')
    await page.locator('#f-bankAccounts-0-accountHolder').fill('Dimas Pratama')
    await page.locator('#f-bankAccounts-0-accountNumber').fill('0012 3456 7890')
    await expectSaved(page)
    expect((await getContent(page, w.id)).amplopDigital.bankAccounts[0].accountNumber).toBe('0012 3456 7890')
    await expect(inPreview(page, 'amplopDigital')).toContainText('0012 3456 7890')

    const { slug } = await publishApi(page, w.id)
    const pub = await (await publicJson(page, slug!)).json()
    expect(pub.content.amplopDigital.bankAccounts[0].accountNumber).toBe('0012 3456 7890')
    const { guest, context } = await openGuest(browser, slug!)
    await expect(publicSite(guest).locator('[data-section="amplopDigital"]')).toContainText('0012 3456 7890')
    await context.close()
  })

  test('(18) a QRIS image uploaded in the editor is saved and shown in the preview', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await openEditor(page, 'gifts')
    await toggle(page).click()
    await page.locator('#f-qrisEnabled').click()
    const qris = page.getByTestId('qris-panel')
    await page.locator('#f-qrisName').fill('Dimas & Ayu')
    await qris.getByTestId('image-file-input').setInputFiles(qrisFile())
    await expect(qris.getByTestId('upload-error')).toHaveCount(0)
    await expect(qris.getByTestId('image-thumb-img')).toHaveAttribute('src', /^\/media\/[0-9a-f-]{36}\.png$/, { timeout: 15_000 })
    await expectSaved(page)
    const saved = (await getContent(page, w.id)).amplopDigital
    expect(saved.qrisEnabled).toBe(true)
    expect(saved.qrisImage.src).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/)
    const img = inPreview(page, 'amplopDigital').locator('.universal-qris img')
    await expect(img).toHaveAttribute('src', saved.qrisImage.src)
    await img.scrollIntoViewIfNeeded()
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    const media = await page.request.get(saved.qrisImage.src)
    expect(media.headers()['content-type']).toBe('image/png')
  })

  test('(19) gift details that are switched off are not published', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, {
      ...requiredDraft(),
      amplopDigital: {
        enabled: true,
        bankAccountsEnabled: true,
        bankAccounts: [{ id: 'b1', bankName: 'Bank Rahasia', accountHolder: 'Dimas Pratama', accountNumber: '0099 8877 6655' }],
        qrisEnabled: false,
        physicalGifts: { enabled: true, recipient: 'Ayu Lestari', address: 'Jl. Melati No. 9, Bandung' },
      },
    })
    await openEditor(page, 'gifts')
    await page.locator('#f-bankAccountsEnabled').click()
    await expect(page.locator('#f-bankAccounts-0-accountNumber')).toHaveValue('0099 8877 6655') // kept, just off
    await expect(inPreview(page, 'amplopDigital')).not.toContainText('0099 8877 6655')
    await expectSaved(page)
    expect((await getContent(page, w.id)).amplopDigital).toMatchObject({ bankAccountsEnabled: false, bankAccounts: [{ accountNumber: '0099 8877 6655' }] })

    await goToSection(page, 'finishing', 'publish')
    await expect(page.getByTestId('publish-page')).toBeVisible()
    const privacy = page.getByTestId('publish-privacy')
    await expect(privacy.locator('[data-privacy="bank"]')).toHaveCount(0)
    await expect(privacy.locator('[data-privacy="physical"]')).toBeVisible()
    await page.locator('[data-action="publish"]').click()
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published', { timeout: 15_000 })

    const { slug } = await getWedding(page)
    const raw = await (await publicJson(page, slug!)).text()
    expect(raw).not.toContain('0099')
    expect(raw).not.toContain('Bank Rahasia')
    expect(JSON.parse(raw).content.amplopDigital).toMatchObject({ bankAccountsEnabled: false, bankAccounts: [] })
    const { guest, context } = await openGuest(browser, slug!)
    const text = await publicSite(guest).innerText()
    expect(text).not.toContain('0099 8877 6655')
    expect(text).not.toContain('Bank Rahasia')
    expect(text).toContain('Jl. Melati No. 9, Bandung')
    await context.close()
  })

  test('(20) switching the theme keeps the content', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, fullDraft())
    const before = await getContent(page, w.id)
    await openEditor(page, 'opening')
    await expect(site(page)).toHaveAttribute('data-theme', 'royal-maroon-v2')
    const res = await page.request.patch(`${API}/weddings/${w.id}`, { data: { themeId: 'international' } })
    expect(res.ok()).toBe(true)
    expect(await getContent(page, w.id)).toEqual(before)
    await page.reload()
    await expect(site(page)).toHaveAttribute('data-theme', 'international')
    await expect(site(page)).toContainText('Dimas Pratama')
    await expect(inPreview(page, 'amplopDigital')).toContainText('0012 3456 7890')
    expect(await getContent(page, w.id)).toEqual(before) // opening the editor writes nothing
  })

  test('(21) legacy invitations without v1.1 content still edit, preview and publish', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    const legacy = requiredDraft()
    legacy.opening = { ...legacy.opening, headline: 'Together with our families', introduction: 'We invite you to share our joy.' }
    await putContent(page, w.id, legacy)
    const stored = await getContent(page, w.id)
    expect(stored.greeting).toBeUndefined()
    await openEditor(page, 'opening')
    // Legacy fallback: no greeting section stored → opening headline/introduction render as the greeting.
    await expect(inPreview(page, 'greeting')).toContainText('Together with our families')
    await expect(inPreview(page, 'greeting')).toContainText('We invite you to share our joy.')
    await goToSection(page, 'finishing', 'publish')
    await expect(page.getByTestId('publish-errors')).toHaveCount(0)
    await page.locator('[data-action="publish"]').click()
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published', { timeout: 15_000 })
    const { slug } = await getWedding(page)
    const { guest, context } = await openGuest(browser, slug!)
    const greeting = publicSite(guest).locator('[data-section="greeting"]')
    await expect(greeting).toContainText('Together with our families')
    await expect(greeting).toContainText('We invite you to share our joy.')
    await context.close()
  })

  test('(22) publishing validates mandatory information (UI and API)', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page, null)
    const res = await page.request.post(`${API}/weddings/${w.id}/publish`)
    expect(res.status()).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('publish_blocked')
    const fields = body.error.details.map((d: Json) => d.field)
    for (const f of ['themeId', 'opening.weddingDate', 'couple.groom.name', 'couple.bride.name', 'events', 'closing.message']) expect(fields).toContain(f)

    await openEditor(page, 'publish')
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'draft')
    const errors = page.getByTestId('publish-errors')
    await expect(errors).toBeVisible()
    for (const issue of ['opening.weddingDate', 'couple.groom.name', 'couple.bride.name', 'events.events', 'closing.closing.message']) {
      await expect(errors.locator(`[data-issue^="${issue.split('.')[0]}"]`).first(), issue).toBeVisible()
    }
    await expect(page.getByTestId('publish-all-clear')).toHaveCount(0)
    const publish = page.locator('[data-action="publish"]')
    await expect(publish).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('publish-disabled-reason')).toBeVisible()
    await publish.click({ force: true })
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'draft')
    expect((await getWedding(page)).status).toBe('draft')
    // Fix links go to the section.
    await errors.locator('[data-issue^="closing"] a[data-action="fix-issue"]').first().click()
    await expect(page).toHaveURL(/\/wedding\/closing/)
  })

  test('(23) disabled optional sections do not block publication', async ({ page, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, {
      ...requiredDraft(),
      story: { enabled: false, timeline: [] },
      gallery: { enabled: false, images: [] },
      holyRecite1: { enabled: false },
      holyRecite2: { enabled: false },
      greeting: { enabled: false },
      wishes: { enabled: false },
      amplopDigital: { enabled: false, bankAccountsEnabled: false, bankAccounts: [], qrisEnabled: false },
    })
    await openEditor(page, 'publish')
    await expect(page.getByTestId('publish-all-clear')).toBeVisible()
    await expect(page.getByTestId('publish-errors')).toHaveCount(0)
    await page.locator('[data-action="publish"]').click()
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published', { timeout: 15_000 })

    // The same sections switched ON but empty do block (control).
    await putSection(page, w.id, 'holyRecite1', { enabled: true })
    const res = await page.request.post(`${API}/weddings/${w.id}/publish`)
    expect(res.status()).toBe(422)
    expect((await res.json()).error.details.map((d: Json) => d.section)).toEqual(['holyRecite1'])
  })

  test('(24) public pages never show editor placeholders', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, { ...requiredDraft(), rsvp: { enabled: true }, wishes: { enabled: true } })
    // Sanity: the editor preview of the same draft does show placeholders/editor notes.
    await openEditor(page, 'opening')
    await expect(site(page).locator('[data-editor-only]').first()).toBeAttached()
    const { slug } = await publishApi(page, w.id)
    for (const theme of ['royal-maroon-v2', 'international', 'conventional']) {
      await page.request.patch(`${API}/weddings/${w.id}`, { data: { themeId: theme } })
      await publishApi(page, w.id)
      const { guest, context, errors } = await openGuest(browser, slug!)
      await expect(publicSite(guest)).toHaveAttribute('data-theme', theme)
      await expectNoPlaceholders(publicSite(guest), theme)
      await expect(guest.getByTestId('editor-layout')).toHaveCount(0)
      expect(errors, theme).toEqual([])
      await context.close()
    }
  })

  test('(25) another account cannot edit, publish, unpublish or upload to a wedding', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, requiredDraft())
    const upload = await page.request.post(`${API}/weddings/${w.id}/assets`, { multipart: { file: qrisFile(), kind: 'qris' } })
    expect(upload.status()).toBe(201)
    const asset = await upload.json()
    const { slug } = await publishApi(page, w.id)

    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const intruder = await other.newPage()
    const reg = await intruder.request.post(`${API}/auth/register`, {
      data: { email: `intruder-v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, password: 'intruder-pass-1', full_name: 'Intruder' },
    })
    expect(reg.ok()).toBe(true)
    const r = intruder.request
    for (const section of ['holyRecite1', 'greeting', 'amplopDigital', 'opening']) {
      expect((await r.put(`${API}/weddings/${w.id}/sections/${section}`, { data: { enabled: true } })).status(), section).toBe(404)
    }
    expect((await r.post(`${API}/weddings/${w.id}/publish`)).status()).toBe(404)
    expect((await r.post(`${API}/weddings/${w.id}/unpublish`)).status()).toBe(404)
    expect((await r.post(`${API}/weddings/${w.id}/assets`, { multipart: { file: qrisFile(), kind: 'image' } })).status()).toBe(404)
    expect((await r.delete(`${API}/weddings/${w.id}/assets/${asset.id}`)).status()).toBe(404)
    await other.close()

    // Still published and intact.
    expect((await publicJson(page, slug!)).status()).toBe(200)
    expect((await page.request.get(asset.src)).status()).toBe(200)
    // Unpublished and unknown slugs: same 404.
    expect((await page.request.post(`${API}/weddings/${w.id}/unpublish`)).status()).toBe(200)
    const gone = await publicJson(page, slug!)
    expect(gone.status()).toBe(404)
    expect(await gone.json()).toEqual({ error: { code: 'not_found', message: 'Not found.' } })
    expect((await publicJson(page, 'no-such-slug-000000')).status()).toBe(404)
  })

  test('(26) template artwork stays intact in the preview and on the public page', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page, 'royal-maroon-v2')
    await putContent(page, w.id, fullDraft())
    await openEditor(page, 'opening')
    const root = site(page).locator('article.rm2[data-variant="royal-maroon-v2"]')
    await expect(root).toBeAttached()
    expect(await root.locator('.rm2-corner').count()).toBeGreaterThan(0)
    const box = await root.locator('.rm2-corner').first().boundingBox()
    expect(box && box.width > 0 && box.height > 0).toBe(true)
    await expect(root.locator('.rm2-monogram').first()).toBeAttached()

    const { slug } = await publishApi(page, w.id)
    const { guest, context } = await openGuest(browser, slug!)
    const pub = publicSite(guest).locator('article.rm2[data-variant="royal-maroon-v2"]')
    await expect(pub).toBeVisible()
    expect(await pub.locator('.rm2-corner').count()).toBeGreaterThan(0)
    const pbox = await pub.locator('.rm2-corner').first().boundingBox()
    expect(pbox && pbox.width > 0 && pbox.height > 0).toBe(true)
    await expect(pub.locator('.rm2-monogram').first()).toBeAttached()
    const decoration = pub.locator('.universal-section__decoration svg').first()
    await expect(decoration).toBeAttached()
    expect(await decoration.evaluate((n) => n.getBoundingClientRect().width)).toBeGreaterThan(0)
    expect(await pub.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Garamond|Cinzel/)
    await context.close()
  })

  test('publish flow: publish, edit, republish and unpublish', async ({ page, browser, freshUser }) => {
    void freshUser
    test.setTimeout(60_000)
    const w = await createWedding(page)
    await putContent(page, w.id, fullDraft())
    await openEditor(page, 'publish')
    const status = page.getByTestId('publish-status')
    await expect(status).toHaveAttribute('data-state', 'draft')
    await expect(page.getByTestId('publish-privacy').locator('[data-privacy="bank"]')).toBeVisible()
    await page.locator('[data-action="publish"]').click()
    await expect(status).toHaveAttribute('data-state', 'published', { timeout: 15_000 })
    await expect(page.getByTestId('publish-chip')).toHaveAttribute('data-state', 'published')
    const url = await page.getByTestId('public-url').inputValue()
    expect(url).toMatch(/\/i\/dimas-ayu-[a-z0-9]{6}$/)
    await expect(page.locator('[data-action="view-published"]')).toHaveAttribute('href', url)
    const slug = url.split('/i/')[1]!

    let guest = await openGuest(browser, slug)
    await expect(publicSite(guest.guest)).toContainText('Dimas Pratama')
    await expect(publicSite(guest.guest)).toContainText('Thank you for your prayers and blessings.')
    await guest.context.close()

    // Edit → unpublished changes.
    await goToSection(page, 'finishing', 'closing')
    await page.getByTestId('closing-form').locator('#f-message').fill('Updated closing words.')
    await expectSaved(page)
    await expect(page.getByTestId('publish-chip')).toHaveAttribute('data-state', 'unpublished_changes')
    await page.getByTestId('section-nav').locator('a[data-section="publish"]').click()
    await expect(status).toHaveAttribute('data-state', 'unpublished_changes')
    guest = await openGuest(browser, slug)
    await expect(publicSite(guest.guest)).not.toContainText('Updated closing words.') // live version unchanged
    await guest.context.close()

    // Republish → live updated, same slug.
    await page.locator('[data-action="publish"]').click()
    await expect(status).toHaveAttribute('data-state', 'published', { timeout: 15_000 })
    expect(await page.getByTestId('public-url').inputValue()).toBe(url)
    guest = await openGuest(browser, slug)
    await expect(publicSite(guest.guest)).toContainText('Updated closing words.')
    await guest.context.close()

    // Unpublish (confirmed) → public 404.
    await page.locator('[data-action="unpublish"]').click()
    const dialog = page.getByTestId('confirm-dialog').filter({ visible: true })
    await dialog.locator('[data-action="confirm"]').click()
    await expect(status).toHaveAttribute('data-state', 'draft', { timeout: 15_000 })
    guest = await openGuest(browser, slug)
    await expect(guest.guest.getByTestId('public-not-found')).toBeVisible()
    await guest.context.close()
    expect((await getWedding(page)).slug).toBe(slug) // slug kept
  })

  // BUG (QA report "public page cached for 60 s"): GET /public/weddings/{slug} sends
  // `Cache-Control: public, max-age=60` and the page fetches it with the default cache mode,
  // so a guest who already opened the link keeps seeing the OLD publication (including gift
  // details that were removed) for up to a minute after republish/unpublish. Fresh browsers
  // are fine (see the publish-flow test). Re-enable once the response is revalidated.
  test('a guest who already opened the link sees unpublish on reload', async ({ page, browser, freshUser }) => {
    void freshUser
    const w = await createWedding(page)
    await putContent(page, w.id, requiredDraft())
    const { slug } = await publishApi(page, w.id)
    const { guest, context } = await openGuest(browser, slug!)
    await expect(guest.getByTestId('public-invitation')).toBeVisible()
    expect((await page.request.post(`${API}/weddings/${w.id}/unpublish`)).status()).toBe(200)
    await guest.reload()
    await expect(guest.getByTestId('public-not-found')).toBeVisible()
    await context.close()
  })

  test('guest greeting (?to=) renders on the public page only when enabled', async ({ page, browser, freshUser }) => {
    void freshUser
    test.setTimeout(60_000) // three guest browsers
    const w = await createWedding(page)
    await putContent(page, w.id, requiredDraft())
    await openEditor(page, 'opening')
    await page.locator('#f-guestGreeting-enabled').click()
    await page.locator('#f-guestGreeting-label').fill('Kepada Yth.')
    await expectSaved(page)
    // The editor shows a marked sample name, never a real guest.
    await expect(site(page).getByTestId('guest-greeting')).toContainText('Kepada Yth.')
    await expect(site(page).getByTestId('guest-greeting').locator('[data-sample="true"]')).toHaveText(/Guest Name|Nama Tamu/)
    const { slug } = await publishApi(page, w.id)

    let g = await openGuest(browser, slug!, '?to=Budi%20Santoso')
    await expect(g.guest.getByTestId('guest-greeting')).toContainText('Kepada Yth.')
    await expect(g.guest.getByTestId('guest-greeting')).toContainText('Budi Santoso')
    await g.context.close()
    g = await openGuest(browser, slug!)
    await expect(g.guest.getByTestId('guest-greeting')).toHaveCount(0) // no name, no greeting line
    await g.context.close()

    await page.locator('#f-guestGreeting-enabled').click()
    await expectSaved(page)
    await publishApi(page, w.id)
    g = await openGuest(browser, slug!, '?to=Budi%20Santoso')
    await expect(publicSite(g.guest)).toContainText('Dimas Pratama')
    await expect(g.guest.getByTestId('guest-greeting')).toHaveCount(0)
    expect(await publicSite(g.guest).innerText()).not.toContain('Budi Santoso')
    await g.context.close()
  })
})
