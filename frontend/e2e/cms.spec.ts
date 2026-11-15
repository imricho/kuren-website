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
  return (await res.json()) as { id: string; themeId: string | null; status: string }
}

async function savedContent(page: Page) {
  const w = await myWedding(page)
  const res = await page.request.get(`${API}/weddings/${w.id}/content`)
  expect(res.ok()).toBe(true)
  return res.json()
}

const saveButton = (page: Page) => page.getByTestId('save-bar').getByRole('button', { name: /Save changes/ })

async function fillOpening(page: Page) {
  await page.goto('/wedding/opening')
  const form = page.getByTestId('opening-form')
  await form.getByLabel('Groom’s name').fill('Dimas Pratama')
  await form.getByLabel('Bride’s name').fill('Ayu Lestari')
  await form.getByLabel('Website title').fill('The Wedding of Dimas & Ayu')
  await form.getByLabel('Wedding date').fill('2027-09-04')
  await saveButton(page).click()
  await expect(page.getByTestId('toast-status')).toContainText('Opening saved')
}

test.describe('Wedding CMS', () => {
  test('a new customer starts with an empty draft that is not published', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/dashboard')
    await expect(page.getByTestId('website-name')).toHaveText('Your wedding website')
    // Unbuilt features (publishing) are not advertised.
    await expect(page.getByText(/Not published|later update/)).toHaveCount(0)
    await expect(page.getByText(/0 of 6 required sections complete/).first()).toBeVisible()
    const w = await myWedding(page)
    expect(w.status).toBe('draft')
  })

  test('opening content is saved to PostgreSQL, survives reload and can be edited', async ({ page, freshUser }) => {
    void freshUser
    await fillOpening(page)

    // Persisted server-side (same data the Couple page edits — not duplicated).
    const content = await savedContent(page)
    expect(content.opening).toMatchObject({ weddingTitle: 'The Wedding of Dimas & Ayu', weddingDate: '2027-09-04' })
    expect(content.couple.groom.name).toBe('Dimas Pratama')
    expect(content.couple.bride.name).toBe('Ayu Lestari')

    await page.reload()
    await expect(page.getByTestId('opening-form').getByLabel('Website title')).toHaveValue('The Wedding of Dimas & Ayu')

    // Edit and save again.
    await page.getByTestId('opening-form').getByLabel('Website title').fill('Dimas & Ayu')
    await saveButton(page).click()
    await expect(page.getByTestId('toast-status')).toContainText('Opening saved')
    expect((await savedContent(page)).opening.weddingTitle).toBe('Dimas & Ayu')

    await page.goto('/wedding/couple')
    await expect(page.getByTestId('couple-form').getByLabel(/full name/i).first()).toHaveValue('Dimas Pratama')
  })

  test('unsaved changes are flagged and guarded when leaving', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/wedding/opening')
    await page.getByTestId('opening-form').getByLabel('Website title').fill('Draft title')
    await expect(page.getByTestId('save-bar')).toContainText('Unsaved changes')

    await page.getByTestId('section-nav').getByRole('link', { name: /Events/ }).click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(/\/wedding\/opening$/)
    await expect(page.getByTestId('opening-form').getByLabel('Website title')).toHaveValue('Draft title')

    await page.getByTestId('section-nav').getByRole('link', { name: /Events/ }).click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Discard changes' }).click()
    await expect(page).toHaveURL(/\/wedding\/events$/)
    expect((await savedContent(page)).opening.weddingTitle).toBeUndefined()
  })

  test('events: add, validate, reorder by keyboard and delete with confirmation', async ({ page, freshUser }) => {
    void freshUser
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
    await page.goto('/themes/classic/romantic-floral')
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect(page).toHaveURL(/\/wedding\/(opening|couple|story|events|gallery|rsvp|closing)$/)
    await expect.poll(async () => (await myWedding(page)).themeId).toBe('conventional')

    // A completely separate browser (no localStorage) sees the same selection.
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const otherPage = await other.newPage()
    await freshUser.loginInto(otherPage)
    await otherPage.goto('/dashboard')
    await expect(otherPage.getByText(/Conventional \/ Classic|Blush Garden/).first()).toBeVisible()
    await other.close()
  })

  test('category and collection browse preserve the draft; sidebar previews and explicit selection saves before Edit and Back does not repeat it', async ({ page, freshUser }) => {
    void freshUser
    await fillOpening(page)
    const before = await savedContent(page)
    await page.goto('/themes')
    await page.locator('[data-family-card="traditional"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional$/)
    await page.locator('[data-collection-card="artisan-pattern"] a').click()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern$/)
    expect((await myWedding(page)).themeId).toBeNull()
    await page.locator('[data-theme-card="ethnic"] h4 a').click()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern\/woven-indigo$/)
    await expect(page.getByTestId('preview-pane').getByRole('heading', { name: 'Woven Indigo' })).toBeVisible()
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect(page).toHaveURL(/\/wedding\/(opening|couple|story|events|gallery|rsvp|closing)$/)
    expect((await myWedding(page)).themeId).toBe('ethnic')
    expect(await savedContent(page)).toEqual(before)
    await page.goBack()
    await expect(page).toHaveURL(/\/themes\/traditional\/artisan-pattern\/woven-indigo$/)
    await expect(page.getByTestId('selection-summary')).toContainText('Heritage')
  })

  test('preview renders the saved content with the selected theme', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/themes/classic/romantic-floral')
    await page.getByTestId('preview-pane').locator('[data-action="select"]').click()
    await expect.poll(async () => (await myWedding(page)).themeId).toBe('conventional')
    await fillOpening(page)

    await page.goto('/wedding/preview')
    const site = page.locator('.wedding-site[data-theme="conventional"]')
    await expect(site.locator('> article')).toBeVisible()
    await expect(site.getByText('Dimas Pratama').first()).toBeVisible()
    await expect(site.getByText('Ayu Lestari').first()).toBeVisible()
    await expect(page.getByTestId('notice-saved')).toBeVisible()
    await expect(page.getByTestId('notice-placeholders')).toBeVisible() // events etc. not filled yet

    await page.getByTestId('back-to-editing').click()
    await expect(page).toHaveURL(/\/wedding/)
  })

  test('one customer cannot read or change another customer’s wedding', async ({ page, browser, freshUser }) => {
    void freshUser
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
    await other.close()
    expect((await savedContent(page)).opening.weddingTitle).toBe('The Wedding of Dimas & Ayu')
  })

  test('CMS pages fit a phone screen and the section selector works', async ({ page, freshUser }) => {
    void freshUser
    // 320 CSS px is the WCAG 1.4.10 reflow width.
    await page.setViewportSize({ width: 320, height: 720 })
    for (const section of ['opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing']) {
      await page.goto(`/wedding/${section}`)
      await expect(page.getByTestId(/.*-form|list-editor/).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `/wedding/${section} must not scroll horizontally`).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `test-results/screens/cms-${section}-phone.png`, fullPage: true })
    }
    await page.goto('/dashboard')
    await page.screenshot({ path: 'test-results/screens/cms-dashboard-phone.png', fullPage: true })

    await page.goto('/wedding/opening')
    await page.getByTestId('section-nav').getByRole('link', { name: /Events/ }).click()
    await expect(page).toHaveURL(/\/wedding\/events$/)
  })

  test('the CMS is translated when the app language is Indonesian', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Bahasa Indonesia' }).click().catch(async () => {
      await page.evaluate(() => localStorage.setItem('kuren.appLocale', 'id'))
      await page.reload()
    })
    await expect(page.getByRole('link', { name: 'Situs saya' })).toBeVisible()
  })

  test.describe('first run', () => {
    test.use({ welcomeSeen: false })

    test('a new customer is guided through names, theme and their site, once', async ({ page, freshUser }) => {
      void freshUser
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/welcome/)
      await expect(page.getByTestId('welcome-step-of')).toHaveText('Step 1 of 3')

      const names = page.getByTestId('welcome-names')
      await names.locator('#welcome-groom-name').fill('Rizky Pratama')
      await names.locator('#welcome-groom-nickname').fill('Rizky')
      await names.locator('#welcome-bride-name').fill('Ayu Lestari')
      await names.locator('#welcome-bride-nickname').fill('Ayu')
      await names.locator('#welcome-date').fill('2027-09-04')
      await names.getByRole('button', { name: 'Save and continue' }).click()
      await expect(page.getByTestId('welcome-step-of')).toHaveText('Step 2 of 3')

      const content = await savedContent(page)
      expect(content.couple.groom).toMatchObject({ name: 'Rizky Pratama', nickname: 'Rizky' })
      expect(content.opening.weddingDate).toBe('2027-09-04')

      await page.getByTestId('welcome-theme').locator('label[data-theme]').first().click()
      await page.getByTestId('welcome-theme').getByRole('button', { name: 'Save and continue' }).click()
      await expect(page.getByTestId('welcome-step-of')).toHaveText('Step 3 of 3')
      expect((await myWedding(page)).themeId).toBeTruthy()

      await page.getByTestId('welcome-dashboard').click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByTestId('website-name')).toContainText('Rizky')
      await page.reload()
      await expect(page).toHaveURL(/\/dashboard$/) // not sent back to /welcome
    })

    test('setup can be skipped entirely', async ({ page, freshUser }) => {
      void freshUser
      await page.goto('/dashboard')
      await page.getByTestId('welcome-skip-all').click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/dashboard$/)
    })
  })
})
