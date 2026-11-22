/**
 * Workstream 3 — Wedding CMS, end to end against the real FastAPI + PostgreSQL stack.
 * Every test uses its own freshly registered account (see fixtures.ts).
 */
import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const API = '/api/v1'

async function myWedding(page: Page) {
  const res = await page.request.get(`${API}/weddings/me`)
  expect(res.ok()).toBe(true)
  return (await res.json()) as { id: string; themeId: string | null; status: string; revision: number }
}

/**
 * Since the invitation engine nothing is auto-created on first visit: create the wedding through
 * the legacy API (`POST /weddings` → a `wedding_ceremony` with the pre-2.0 defaults).
 */
async function seedWedding(page: Page, themeId?: string) {
  const res = await page.request.post(`${API}/weddings`, { data: themeId ? { themeId } : {} })
  expect(res.status(), `POST /weddings → ${res.status()}`).toBe(201)
  return res.json() as Promise<{ id: string }>
}

/** `/wedding/<slug>` redirects to the invitation editor. */
const editorUrl = (slug: string) => new RegExp(`/invitations/[0-9a-f-]{36}/edit/${slug}$`)

/** Theme selection saves to the invitation that is OPEN in the app; reach the studio in-app. */
async function openThemesInApp(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Themes' }).click()
  await expect(page).toHaveURL(/\/themes$/)
}

async function savedContent(page: Page) {
  const w = await myWedding(page)
  const res = await page.request.get(`${API}/weddings/${w.id}/content`)
  expect(res.ok()).toBe(true)
  return res.json()
}

/** The live editor autosaves (no Save button): wait until the save status settles on Saved. */
async function expectAllSaved(page: Page) {
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved', { timeout: 15_000 })
  await expect(page.getByTestId('save-status-text')).toHaveText('All changes saved')
}

/** Sections are grouped: pick the group tab first, then the section chip (docs/ux/live-editor.md). */
async function goToSection(page: Page, group: string, section: string) {
  const nav = page.getByTestId('section-nav')
  await nav.locator(`[data-testid="section-nav-groups"] [role="tab"][data-group="${group}"]`).click()
  await nav.locator(`a[data-section="${section}"]`).click()
}

async function fillOpening(page: Page) {
  await page.goto('/wedding/opening')
  await expect(page).toHaveURL(editorUrl('opening'))
  const form = page.getByTestId('opening-form')
  await form.getByLabel('Groom’s name').fill('Dimas Pratama')
  await form.getByLabel('Bride’s name').fill('Ayu Lestari')
  await form.getByLabel('Website title').fill('The Wedding of Dimas & Ayu')
  await form.getByLabel('Wedding date').fill('2027-09-04')
  // Autosave (1 s after the last change) writes everything; no "saved" toast any more.
  await expect
    .poll(async () => (await savedContent(page)).opening.weddingTitle, { timeout: 15_000 })
    .toBe('The Wedding of Dimas & Ayu')
  await expectAllSaved(page)
}

test.describe('Wedding CMS', () => {
  test('a new customer starts with an empty draft that is not published', async ({ page, freshUser }) => {
    void freshUser
    // No more auto-created wedding: the list is empty until one is created.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/invitations$/)
    await expect(page.getByTestId('invitations-empty')).toBeVisible()
    expect((await page.request.get(`${API}/weddings/me`)).status()).toBe(404)
    await seedWedding(page)
    await page.goto('/invitations')
    await expect(page.getByTestId('card-status')).toHaveAttribute('data-state', 'draft')
    await expect(page.getByTestId('card-url')).toHaveCount(0)
    const w = await myWedding(page)
    expect(w.status).toBe('draft')
    const content = await savedContent(page)
    expect(content.events).toEqual([])
    expect(content.opening).toEqual({})
  })

  test('opening content is saved to PostgreSQL, survives reload and can be edited', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await fillOpening(page)

    // Persisted server-side (same data the Couple page edits — not duplicated).
    const content = await savedContent(page)
    expect(content.opening).toMatchObject({ weddingTitle: 'The Wedding of Dimas & Ayu', weddingDate: '2027-09-04' })
    expect(content.couple.groom.name).toBe('Dimas Pratama')
    expect(content.couple.bride.name).toBe('Ayu Lestari')

    await page.reload()
    await expect(page.getByTestId('opening-form').getByLabel('Website title')).toHaveValue('The Wedding of Dimas & Ayu')

    // Edit again: autosaved, no button.
    await page.getByTestId('opening-form').getByLabel('Website title').fill('Dimas & Ayu')
    await expect(page.getByTestId('save-status')).not.toHaveAttribute('data-state', 'saved')
    await expectAllSaved(page)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Dimas & Ayu')

    await page.goto('/wedding/couple')
    await expect(page.getByTestId('couple-form').getByLabel(/full name/i).first()).toHaveValue('Dimas Pratama')
  })

  test('leaving saves pending edits first and only asks when something cannot be saved', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await page.goto('/wedding/opening')
    const title = page.getByTestId('opening-form').getByLabel('Website title')
    const nav = page.getByTestId('section-nav')

    // A quick edit followed straight away by a section change is flushed, not questioned.
    await title.fill('Draft title')
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'unsaved')
    await expect(nav.locator('a[data-section="opening"] [data-testid="unsaved-badge"]')).toHaveCount(1)
    await goToSection(page, 'events', 'events')
    await expect(page).toHaveURL(editorUrl('events'))
    await expect(page.getByTestId('confirm-dialog').filter({ visible: true })).toHaveCount(0)
    expect((await savedContent(page)).opening.weddingTitle).toBe('Draft title')

    // An invalid value (title > 120 characters) can't be saved, so leaving asks.
    await goToSection(page, 'wedding', 'opening')
    await expect(title).toHaveValue('Draft title')
    const tooLong = 'x'.repeat(121)
    await title.fill(tooLong)
    await goToSection(page, 'events', 'events')
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(editorUrl('opening'))
    await expect(title).toHaveValue(tooLong)

    await nav.locator('a[data-section="events"]').click() // the Events group is still selected
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Discard changes' }).click()
    await expect(page).toHaveURL(editorUrl('events'))
    expect((await savedContent(page)).opening.weddingTitle).toBe('Draft title')
  })

  test('events: add, validate, reorder by keyboard and delete with confirmation', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await page.goto('/wedding/events')

    const addEvent = async (title: string, start: string, end?: string) => {
      await page.getByRole('button', { name: 'Add an event' }).click()
      const editor = page.getByTestId('event-editor').last()
      await editor.getByLabel('Event name').fill(title)
      await editor.getByLabel('Date').fill('2027-09-04')
      await editor.getByLabel('Start time').fill(start)
      if (end) await editor.getByLabel('End time').fill(end)
      await editor.getByLabel('Venue name').fill(`${title} Hall`)
      await editor.getByLabel('Address').fill('Jl. Kenanga No. 3, Yogyakarta')
      return editor
    }

    // Format errors block saving; the message is shown on the field.
    const bad = await addEvent('Akad Nikah', '10:00', '09:00')
    await bad.getByRole('button', { name: 'Add' }).click()
    await expect(bad.getByText(/later than|after/i).first()).toBeVisible()
    await bad.getByLabel('End time').fill('11:00')
    await bad.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByTestId('toast-status')).toContainText('“Akad Nikah” added')

    const second = await addEvent('Reception', '18:30', '21:00')
    await second.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByTestId('toast-status')).toContainText('“Reception” added')

    let events = (await savedContent(page)).events
    expect(events.map((e: { title: string }) => e.title)).toEqual(['Akad Nikah', 'Reception'])

    // Reorder with the keyboard only.
    const down = page.getByRole('button', { name: 'Move Akad Nikah down' })
    await down.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('list-live')).toContainText(/position 2 of 2/)
    await expect.poll(async () => (await savedContent(page)).events.map((e: { title: string }) => e.title)).toEqual([
      'Reception',
      'Akad Nikah',
    ])

    // Delete asks for confirmation.
    await page.getByRole('button', { name: /Delete.*Reception|Delete/ }).first().click()
    const dialog = page.getByTestId('confirm-dialog').filter({ hasText: 'Reception' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect.poll(async () => (await savedContent(page)).events.length).toBe(1)
    events = (await savedContent(page)).events
    expect(events[0].title).toBe('Akad Nikah')
  })

  test('the selected theme is stored on the wedding, not just in the browser', async ({ page, browser, freshUser }) => {
    await seedWedding(page)
    await page.goto('/wedding/opening')
    await expect(page.getByTestId('opening-form')).toBeVisible()
    await openThemesInApp(page)
    await page.locator('[data-family-card="classic"] a').click()
    await page.locator('[data-collection-card="romantic-floral"] a').click()
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect(page).toHaveURL(editorUrl('(opening|couple|story|events|gallery|rsvp|closing)'))
    await expect.poll(async () => (await myWedding(page)).themeId).toBe('conventional')

    // A completely separate browser (no localStorage) sees the same selection.
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const otherPage = await other.newPage()
    await freshUser.loginInto(otherPage)
    await otherPage.goto('/dashboard')
    await expect(otherPage.getByTestId('card-template')).toHaveText(/Conventional|Classic|Blush Garden/)
    await other.close()
  })

  test('category and collection browse preserve the draft; sidebar previews and explicit selection saves before Edit and Back does not repeat it', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await fillOpening(page)
    const before = await savedContent(page)
    await openThemesInApp(page)
    await page.locator('[data-family-card="traditional"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional$/)
    await page.locator('[data-collection-card="artisan-pattern"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern$/)
    expect((await myWedding(page)).themeId).toBeNull()
    await page.locator('[data-theme-card="ethnic"] h4 a').click()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern\/woven-indigo$/)
    await expect(page.getByTestId('preview-pane').getByRole('heading', { name: 'Woven Indigo' })).toBeVisible()
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect(page).toHaveURL(editorUrl('(opening|couple|story|events|gallery|rsvp|closing)'))
    expect((await myWedding(page)).themeId).toBe('ethnic')
    expect(await savedContent(page)).toEqual(before)
    await page.goBack()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern\/woven-indigo$/)
    await expect(page.getByTestId('selection-summary')).toContainText('Heritage')
  })

  test('preview renders the saved content with the selected theme', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await fillOpening(page)
    await openThemesInApp(page)
    await page.locator('[data-family-card="classic"] a').click()
    await page.locator('[data-collection-card="romantic-floral"] a').click()
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect.poll(async () => (await myWedding(page)).themeId).toBe('conventional')

    await page.goto('/wedding/preview')
    const site = page.locator('.wedding-site[data-theme="conventional"]')
    await expect(site.locator('> article')).toBeVisible()
    await expect(site.getByText('Dimas Pratama').first()).toBeVisible()
    await expect(site.getByText('Ayu Lestari').first()).toBeVisible()
    await expect(page.getByTestId('notice-saved')).toBeVisible()
    await expect(page.getByTestId('notice-placeholders')).toBeVisible() // events etc. not filled yet

    await page.getByTestId('back-to-editing').click()
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/)
  })

  test('one customer cannot read or change another customer’s wedding', async ({ page, browser, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await fillOpening(page)
    const mine = await myWedding(page)

    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const intruder = await other.newPage()
    await intruder.goto('/login')
    const reg = await intruder.request.post(`${API}/auth/register`, {
      data: { email: `intruder-${Date.now()}@example.com`, password: 'intruder-pass-1', full_name: 'Intruder' },
    })
    expect(reg.ok()).toBe(true)
    expect((await intruder.request.get(`${API}/weddings/${mine.id}/content`)).status()).toBe(404)
    expect((await intruder.request.get(`${API}/weddings/${mine.id}/preview`)).status()).toBe(404)
    expect(
      (await intruder.request.put(`${API}/weddings/${mine.id}/sections/opening`, { data: { weddingTitle: 'Hacked' } })).status(),
    ).toBe(404)
    // Also with a matching If-Match revision (the ownership check comes first), and for other writes.
    expect(
      (
        await intruder.request.put(`${API}/weddings/${mine.id}/sections/opening`, {
          data: { weddingTitle: 'Hacked' },
          headers: { 'If-Match': `"${mine.revision}"` },
        })
      ).status(),
    ).toBe(404)
    expect((await intruder.request.put(`${API}/weddings/${mine.id}/content`, { data: { opening: { weddingTitle: 'Hacked' } } })).status()).toBe(404)
    expect((await intruder.request.post(`${API}/weddings/${mine.id}/events`, { data: { title: 'Hacked' } })).status()).toBe(404)
    expect((await intruder.request.patch(`${API}/weddings/${mine.id}`, { data: { themeId: 'conventional' } })).status()).toBe(404)
    await other.close()
    expect((await savedContent(page)).opening.weddingTitle).toBe('The Wedding of Dimas & Ayu')
  })

  test('CMS pages fit a phone screen and the section selector works', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    // 320 CSS px is the WCAG 1.4.10 reflow width.
    await page.setViewportSize({ width: 320, height: 720 })
    for (const section of ['opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing']) {
      await page.goto(`/wedding/${section}`)
      await expect(page).toHaveURL(editorUrl(section))
      await expect(page.getByTestId(/.*-form|list-editor|section-toggle/).filter({ visible: true }).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `/wedding/${section} must not scroll horizontally`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `test-results/screens/cms-${section}-phone.png`, fullPage: true })
    }
    await page.goto('/dashboard')
    await expect(page.getByTestId('invitation-cards')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'invitation list at 320px').toBeLessThanOrEqual(0)
    await page.screenshot({ path: 'test-results/screens/cms-dashboard-phone.png', fullPage: true })

    await page.goto('/wedding/opening')
    await goToSection(page, 'events', 'events')
    await expect(page).toHaveURL(editorUrl('events'))
  })

  test('the CMS is translated when the app language is Indonesian', async ({ page, freshUser }) => {
    void freshUser
    await seedWedding(page)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Bahasa Indonesia' }).click().catch(async () => {
      await page.evaluate(() => localStorage.setItem('kuren.appLocale', 'id'))
      await page.reload()
    })
    await expect(page.getByRole('heading', { level: 1, name: 'Undangan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buat undangan' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Tema' })).toBeVisible()
  })

  // The /welcome first-run flow was replaced by the invitation list + creation wizard.
  test.describe('first run', () => {
    test.use({ welcomeSeen: false })

    test('a new customer is guided to create their first invitation, once', async ({ page, freshUser }) => {
      void freshUser
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/invitations$/)
      await page.getByTestId('invitations-empty').locator('[data-action="create-invitation"]').click()
      await expect(page).toHaveURL(/\/invitations\/new/)
      await page.locator('input[data-category="wedding"]').check()
      await page.locator('[data-action="next"]').click()
      await page.locator('input[data-variant="wedding_ceremony"]').check()
      await page.locator('[data-action="next"]').click()
      await page.locator('input[name="template"]').first().check()
      await page.locator('[data-action="next"]').click()
      await page.locator('[data-action="create"]').click()
      await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/)
      expect((await myWedding(page)).themeId).toBeTruthy()
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/invitations$/) // not sent to a first-run flow again
      await expect(page.locator('[data-invitation]')).toHaveCount(1)
    })
  })
})
