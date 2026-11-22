/**
 * Critical invitation workflow regression suite (basic functional template `temuvibe-minimal`).
 *
 * The journey a real owner takes, driven through the UI end to end:
 *   wizard → required event information (with validation) → save / reopen → interrupted-session
 *   recovery → preview → publish → public page + RSVP → edit after publishing → manage the
 *   event (responses, CSV, settings, unpublish / republish, deleting a referenced session)
 * on desktop (1280×800) and phone (390×844) viewports, plus a tenant-isolation smoke.
 *
 * Every test owns a freshly registered account (fixtures.ts). The API is used only for setup
 * that is not itself under test (e.g. switching RSVP on for a wedding, seeding a published
 * invitation for the "manage" checks). Waits are condition-based only: save-status
 * `data-state`, expect.poll on the API, URL and DOM state. No fixed sleeps.
 */
import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { API, getContent, getInvitation, getPublic, postRsvp, publishedInvitation, putSection, seedPublishable, createInvitation, type CategoryId, type Json } from './invitation-helpers'

const TEMPLATE = 'temuvibe-minimal'
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

// --- Small helpers ------------------------------------------------------------------------

const saveStatus = (page: Page) => page.getByTestId('save-status').first()
async function expectSaved(page: Page) {
  await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved', { timeout: 20_000 })
}
async function openSection(page: Page, id: string, slug: string) {
  await page.goto(`/invitations/${id}/edit/${slug}`)
  await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('editor-loading')).toHaveCount(0, { timeout: 20_000 })
}
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}
const idFromUrl = (page: Page) => page.url().match(/invitations\/([0-9a-f-]{36})/)![1]!

async function guestPage(browser: Browser, viewport = DESKTOP, mobile = false) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport,
    reducedMotion: 'reduce',
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { context, page, errors }
}
async function openPublic(page: Page, slug: string) {
  await page.goto(`/i/${slug}`)
  await expect(page.getByTestId('public-invitation')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('public-invitation').locator('[data-section="closing"]').first()).toBeAttached({ timeout: 20_000 })
}

/**
 * Submit the guest RSVP form. Parallel tests share the browser-side (proxied) RSVP rate-limit
 * bucket, so a "too many attempts" banner is waited out and retried (condition-based).
 */
async function submitRsvp(g: Page, expectedTestId = 'rsvp-success') {
  await expect
    .poll(
      async () => {
        await g.locator('[data-action="rsvp-submit"], [data-action="rsvp-retry"]').first().click()
        return Promise.race([
          g.getByTestId(expectedTestId).waitFor({ timeout: 15_000 }).then(() => 'done'),
          g.locator('[data-error="rateLimited"]').waitFor({ timeout: 15_000 }).then(() => 'retry'),
        ]).catch(() => 'retry')
      },
      { timeout: 180_000, intervals: [5_000, 10_000, 15_000], message: 'RSVP was not accepted' },
    )
    .toBe('done')
}

async function responses(page: Page, id: string): Promise<Json> {
  const res = await page.request.get(`${API}/invitations/${id}/rsvp-responses`)
  expect(res.ok()).toBe(true)
  return res.json()
}

/** Register a second account in `page`'s browser context: its session cookie replaces the first. */
async function switchToNewUser(page: Page) {
  const email = `wf-other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const res = await page.request.post(`${API}/auth/register`, { data: { email, password: `wf-${Math.random().toString(36).slice(2)}-pass`, full_name: 'Second Owner' } })
  expect(res.ok(), `register second user: ${res.status()}`).toBe(true)
  const { id } = (await res.json()) as { id: string }
  await page.addInitScript((key) => localStorage.setItem(key, '1'), `kuren.welcomeSeen.${id}`)
  return { id, email }
}

// --- Wizard -------------------------------------------------------------------------------

interface WizardChoice {
  category: CategoryId
  variant: string
  title: string
  ceremony?: string
  extra?: boolean
}
/** Category → variant → template → name/settings → Create; lands in the editor. Returns the id. */
async function createViaWizard(page: Page, w: WizardChoice): Promise<string> {
  await page.goto('/invitations/new')
  await expect(page.getByTestId('step-category')).toBeVisible({ timeout: 20_000 })
  await page.locator(`input[data-category="${w.category}"]`).check()
  await page.locator('[data-action="next"]').click()
  await expect(page.getByTestId('step-variant')).toBeVisible()
  await page.locator(`input[data-variant="${w.variant}"]`).check()
  await page.locator('[data-action="next"]').click()
  await expect(page.getByTestId('step-template')).toBeVisible()
  await page.locator(`input[data-template="${TEMPLATE}"]`).check()
  await page.locator('[data-action="next"]').click()
  await expect(page.getByTestId('step-name')).toBeVisible()
  await page.locator('#wz-locale').selectOption('en')
  await expect(page).toHaveURL(/locale=en/)
  if (w.ceremony) {
    await page.locator(`[data-ceremony="${w.ceremony}"]`).check()
    await expect(page.locator(`[data-ceremony="${w.ceremony}"]`)).toBeChecked()
  }
  if (w.extra) {
    await page.locator('[data-choice="extra"]').check()
    await expect(page.locator('[data-choice="extra"]')).toBeChecked()
  }
  await page.locator('#wz-title').fill(w.title)
  await expect(page.locator('#wz-title')).toHaveValue(w.title)
  await page.locator('[data-action="create"]').click()
  await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/, { timeout: 20_000 })
  await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
  const id = idFromUrl(page)
  expect(await getInvitation(page, id)).toMatchObject({ category: w.category, variant: w.variant, themeId: TEMPLATE, title: w.title, locale: 'en', status: 'draft' })
  return id
}

// --- Editor: required information ------------------------------------------------------

interface OpeningValues {
  title: string
  date: string
  groom?: string
  bride?: string
}
async function fillOpening(page: Page, id: string, v: OpeningValues) {
  await openSection(page, id, 'opening')
  await expect(page.getByTestId('opening-form')).toBeVisible()
  if (v.groom) await page.locator('#f-couple-groom-name').fill(v.groom)
  if (v.bride) await page.locator('#f-couple-bride-name').fill(v.bride)
  await page.locator('#f-weddingTitle').fill(v.title)
  await page.locator('#f-weddingDate').fill(v.date)
  await expectSaved(page)
  await expect.poll(async () => (await getContent(page, id)).opening).toMatchObject({ weddingTitle: v.title, weddingDate: v.date })
  if (v.groom) await expect.poll(async () => (await getContent(page, id)).couple).toMatchObject({ groom: { name: v.groom }, bride: { name: v.bride } })
}

async function fillClosing(page: Page, id: string, message: string) {
  await openSection(page, id, 'closing')
  await page.locator('#f-message').fill(message)
  await expectSaved(page)
  await expect.poll(async () => (await getContent(page, id)).closing.message).toBe(message)
}

interface SessionValues {
  title: string
  date: string
  startTime: string
  endTime?: string
  venueName?: string
  address?: string
  onlineUrl?: string
}
/** Edit the saved session `eventId` on the Events page (autosaves), then close its editor. */
async function fillSession(page: Page, eventId: string, s: SessionValues, opts: { checkTimeValidation?: boolean } = {}) {
  const item = page.locator(`[data-item="${eventId}"]`)
  await item.locator('[data-action="edit"]').first().click()
  const editor = item.getByTestId('event-editor')
  await expect(editor).toBeVisible()
  const f = (name: string) => editor.locator(`#ev-${eventId}-${name}`)
  await f('title').fill(s.title)
  await f('date').fill(s.date)
  await f('startTime').fill(s.startTime)
  if (opts.checkTimeValidation) {
    // End before start: inline error, nothing saved.
    await f('endTime').fill(shiftTime(s.startTime, -60))
    await expect(f('endTime')).toHaveAttribute('aria-invalid', 'true')
    await expect(editor.locator(`#ev-${eventId}-endTime-msg`)).toHaveText('End time must be after the start time.')
    await expect(saveStatus(page)).not.toHaveAttribute('data-state', 'saved')
  }
  if (s.endTime !== undefined) await f('endTime').fill(s.endTime)
  if (s.onlineUrl) {
    await editor.locator('[data-format="online"]').check()
    await expect(f('venueName')).toHaveCount(0)
    await f('onlineUrl').fill('http://not-secure.example.com/join')
    await expect(f('onlineUrl')).toHaveAttribute('aria-invalid', 'true')
    await f('onlineUrl').fill(s.onlineUrl)
    await expect(f('onlineUrl')).not.toHaveAttribute('aria-invalid', 'true')
  } else {
    await f('venueName').fill(s.venueName!)
    await f('address').fill(s.address!)
  }
  if (opts.checkTimeValidation) await expect(f('endTime')).not.toHaveAttribute('aria-invalid', 'true')
  await expectSaved(page)
  await editor.locator('[data-action="done-item"]').click()
  await expect(item.getByTestId('event-editor')).toHaveCount(0)
}
function shiftTime(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const t = (h * 60 + m + minutes + 24 * 60) % (24 * 60)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
async function eventIds(page: Page, id: string): Promise<string[]> {
  return ((await getContent(page, id)).events as Json[]).map((e) => e.id as string)
}

/** Preview & Publish: all clear (server agrees) → Publish → published. Returns the public URL shown. */
async function publishViaUi(page: Page, id: string, expectUpdate = false) {
  await openSection(page, id, 'publish')
  await expect(page.getByTestId('publish-all-clear')).toBeVisible({ timeout: 20_000 })
  const button = page.getByTestId('publish-page').locator('[data-action="publish"]')
  if (expectUpdate) await expect(button).toHaveText(/Publish update/)
  await button.click()
  await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published', { timeout: 20_000 })
  await expect.poll(async () => (await getInvitation(page, id)).status).toBe('published')
  const url = await page.getByTestId('public-url').inputValue()
  expect(url).toMatch(/\/i\/[a-z0-9-]+$/)
  return url
}

// =====================================================================================
// 1–3, 5–8, 10: the core happy path on desktop and phone.
// =====================================================================================

interface CoreResult {
  id: string
  slug: string
}

async function coreHappyPath(page: Page, browser: Browser, viewport: { width: number; height: number }, phone: boolean): Promise<CoreResult> {
  await page.setViewportSize(viewport)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const tag = phone ? 'Phone' : 'Desk'
  const v = {
    title: `${tag} Raka & Sinta Wedding`,
    date: '2027-08-14',
    groom: 'Raka Pratama',
    bride: 'Sinta Dewi',
    akad: { title: `${tag} Akad Nikah`, date: '2027-08-14', startTime: '08:00', endTime: '09:30', venueName: `${tag} Masjid Raya`, address: 'Jl. Merdeka No. 1, Bandung' },
    reception: { title: `${tag} Resepsi`, date: '2027-08-14', startTime: '11:00', endTime: '14:00', venueName: `${tag} Gedung Sate Hall`, address: 'Jl. Diponegoro No. 22, Bandung' },
    closing: `${tag} Thank you for your prayers and blessings.`,
    closingAfter: `${tag} Updated closing after publishing.`,
  }

  // 1. Wizard: wedding ceremony, akad + reception.
  const id = await createViaWizard(page, { category: 'wedding', variant: 'wedding_ceremony', title: v.title, ceremony: 'akad', extra: true })
  const sessions = (await getContent(page, id)).events as Json[]
  expect(sessions.map((e) => e.type)).toEqual(['akad', 'reception'])
  if (phone) await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', 'tabs')
  else await expect(page.getByTestId('editor-layout')).toHaveAttribute('data-mode', 'split')

  // Setup not under test: switch the RSVP on (weddings start without it). Done before any UI
  // edit so the editor (opened fresh below) carries the new content revision.
  await putSection(page, id, 'rsvp', { enabled: true, title: 'Will you join us?' })

  // 2. Required information through the editor, with validation.
  await fillOpening(page, id, { title: v.title, date: v.date, groom: v.groom, bride: v.bride })
  expect(await horizontalOverflow(page), 'editor (opening) fits the viewport').toBeLessThanOrEqual(0)
  await openSection(page, id, 'events')
  const [akadId, receptionId] = sessions.map((e) => e.id as string) as [string, string]
  await fillSession(page, akadId, v.akad, { checkTimeValidation: true })
  await fillSession(page, receptionId, v.reception)
  expect(await horizontalOverflow(page), 'editor (events) fits the viewport').toBeLessThanOrEqual(0)
  await expect
    .poll(async () => ((await getContent(page, id)).events as Json[]).map((e) => [e.title, e.date, e.startTime, e.endTime, e.venueName, e.address]))
    .toEqual([
      [v.akad.title, v.akad.date, v.akad.startTime, v.akad.endTime, v.akad.venueName, v.akad.address],
      [v.reception.title, v.reception.date, v.reception.startTime, v.reception.endTime, v.reception.venueName, v.reception.address],
    ])
  await fillClosing(page, id, v.closing)

  // On phones the editor has Edit / Preview tabs; the preview follows the saved form.
  if (phone) {
    const tabs = page.getByRole('tablist', { name: 'Editor view' })
    await tabs.getByRole('tab', { name: 'Preview' }).click()
    await expect(page.getByTestId('editor-panel')).toBeHidden()
    await expect(page.getByTestId('live-preview')).toContainText(v.closing)
    await tabs.getByRole('tab', { name: 'Edit' }).click()
    await expect(page.locator('#f-message')).toHaveValue(v.closing)
  } else {
    await expect(page.getByTestId('live-preview')).toContainText(v.closing)
  }

  // 3. Save and reopen: reload, then open again from the list.
  await page.reload()
  await expect(page.locator('#f-message')).toHaveValue(v.closing, { timeout: 20_000 })
  await expect(saveStatus(page)).not.toHaveAttribute('data-state', /failed|offline|conflict/)
  await page.goto('/invitations')
  const card = page.locator(`[data-invitation="${id}"]`)
  await expect(card.getByTestId('card-name')).toHaveText(v.title)
  await expect(card.getByTestId('card-status')).toHaveAttribute('data-state', 'draft')
  await card.locator('[data-action="edit"]').click()
  await expect(page).toHaveURL(new RegExp(`/invitations/${id}/edit`), { timeout: 20_000 })
  await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
  await openSection(page, id, 'opening')
  await expect(page.locator('#f-weddingTitle')).toHaveValue(v.title)
  await expect(page.locator('#f-weddingDate')).toHaveValue(v.date)
  await expect(page.locator('#f-couple-groom-name')).toHaveValue(v.groom)
  await expect(page.locator('#f-couple-bride-name')).toHaveValue(v.bride)
  await openSection(page, id, 'events')
  for (const [eid, s] of [[akadId, v.akad], [receptionId, v.reception]] as const) {
    const item = page.locator(`[data-item="${eid}"]`)
    await expect(item).toContainText(s.title)
    await item.locator('[data-action="edit"]').first().click()
    for (const [field, value] of Object.entries(s)) await expect(item.locator(`#ev-${eid}-${field}`)).toHaveValue(value)
    await item.getByTestId('event-editor').locator('[data-action="done-item"]').click()
  }
  await openSection(page, id, 'closing')
  await expect(page.locator('#f-message')).toHaveValue(v.closing)

  // 5. Full-screen preview shows the saved values.
  await page.goto(`/invitations/${id}/preview`)
  const preview = page.getByRole('main', { name: 'Website preview' })
  await expect(preview).toBeVisible({ timeout: 20_000 })
  for (const text of [v.title, v.akad.title, v.akad.venueName, v.reception.title, v.reception.venueName, v.reception.address, v.closing]) {
    await expect(preview, `preview shows “${text}”`).toContainText(text)
  }

  // 6. Publish from Preview & Publish; copy the public URL.
  const publicUrl = await publishViaUi(page, id)
  await page.getByTestId('publish-link').locator('[data-action="copy-link"]').click()
  await expect(page.getByTestId('copy-status')).not.toBeEmpty()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(publicUrl)
  const slug = (await getInvitation(page, id)).slug!
  expect(publicUrl.endsWith(`/i/${slug}`)).toBe(true)

  // 7. Public page in a logged-out context: content matches; one RSVP reply.
  const { context, page: guest, errors } = await guestPage(browser, viewport, phone)
  await guest.goto(publicUrl)
  await expect(guest.getByTestId('public-invitation')).toBeVisible({ timeout: 20_000 })
  const site = guest.getByTestId('public-invitation')
  for (const text of [v.groom.split(' ')[0]!, v.bride.split(' ')[0]!, v.akad.title, v.akad.venueName, v.akad.address, v.reception.title, v.reception.venueName, v.closing]) {
    await expect(site, `public page shows “${text}”`).toContainText(text)
  }
  expect(await horizontalOverflow(guest), 'public page fits the viewport').toBeLessThanOrEqual(0)
  const form = guest.getByTestId('rsvp-form')
  await form.locator('input[name="name"]').fill(`${tag} Guest Budi`)
  await form.locator('input[value="attending"]').check()
  await form.locator('select[name="partySize"]').selectOption('2')
  await submitRsvp(guest)
  await expect.poll(async () => (await responses(page, id)).total).toBe(1)

  // 8. Edit after publishing: unpublished changes until "Publish update".
  await fillClosing(page, id, v.closingAfter)
  await expect(page.getByTestId('publish-chip').first()).toHaveAttribute('data-state', 'unpublished_changes')
  await openSection(page, id, 'publish')
  await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'unpublished_changes')
  await guest.reload()
  await expect(site).toContainText(v.closing, { timeout: 20_000 })
  await expect(site).not.toContainText(v.closingAfter)
  await publishViaUi(page, id, true)
  await guest.reload()
  await expect(site).toContainText(v.closingAfter, { timeout: 20_000 })
  await expect(site).not.toContainText(v.closing)
  expect((await getInvitation(page, id)).slug, 'slug unchanged after Publish update').toBe(slug)
  // The earlier reply is still there and counted.
  const list = await responses(page, id)
  expect(list.total).toBe(1)
  expect(list.items[0]).toMatchObject({ name: `${tag} Guest Budi`, attendance: 'attending', partySize: 2 })
  expect(list.summary).toMatchObject({ responses: 1, attending: 1, attendingPeople: 2 })
  await page.goto(`/invitations/${id}/responses`)
  await expect(page.getByTestId('responses-summary').locator('[data-summary="responses"] dd')).toHaveText('1')
  await expect(page.getByTestId('responses-page')).toContainText(`${tag} Guest Budi`)
  expect(errors, 'no page errors on the public page').toEqual([])
  await context.close()
  return { id, slug }
}

test.describe('Core happy path', () => {
  test.describe.configure({ timeout: 360_000 })

  test.describe('desktop 1280×800', () => {
    test.use({ viewport: DESKTOP })
    test('wedding (akad + reception): wizard → required info → reopen → preview → publish → public RSVP → edit after publish', async ({ page, browser, freshUser }) => {
      void freshUser
      await coreHappyPath(page, browser, DESKTOP, false)
    })
  })

  test.describe('phone 390×844', () => {
    test.use({ viewport: PHONE, isMobile: true, hasTouch: true })
    test('wedding (akad + reception) on a phone: Edit/Preview tabs, no horizontal overflow, same journey', async ({ page, browser, freshUser }) => {
      void freshUser
      await coreHappyPath(page, browser, PHONE, true)
    })
  })
})

// =====================================================================================
// 1–2, 5–7 for the other categories.
// =====================================================================================

test.describe('Other categories through the UI', () => {
  test.describe.configure({ timeout: 300_000 })
  test.use({ viewport: DESKTOP })

  test('birthday: wizard → opening, celebrant, party session, closing → publish → public page', async ({ page, browser, freshUser }) => {
    void freshUser
    const id = await createViaWizard(page, { category: 'celebration', variant: 'birthday', title: 'Nadia turns 30' })
    await fillOpening(page, id, { title: 'Nadia’s 30th Birthday', date: '2027-05-20' })
    await openSection(page, id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Nadia Putri')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, id)).profiles?.people?.[0]).toMatchObject({ role: 'celebrant', name: 'Nadia Putri' })
    // The milestone is shown by default for a birthday: what is being celebrated (age).
    await openSection(page, id, 'milestone')
    await page.locator('#f-age').fill('151')
    await expect(page.locator('#f-age')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-age').fill('30')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, id)).milestone).toMatchObject({ enabled: true, age: 30 })
    await openSection(page, id, 'events')
    const [partyId] = await eventIds(page, id)
    await fillSession(page, partyId!, { title: 'Garden Party', date: '2027-05-20', startTime: '16:00', endTime: '19:00', venueName: 'Taman Kenanga', address: 'Jl. Kenanga No. 3, Yogyakarta' }, { checkTimeValidation: true })
    await fillClosing(page, id, 'See you at the party!')
    // RSVP is on by default for birthdays; give it a heading so guests get the form.
    await openSection(page, id, 'rsvp')
    await page.locator('#f-title').fill('Coming to the party?')
    await expectSaved(page)

    await page.goto(`/invitations/${id}/preview`)
    const preview = page.getByRole('main', { name: 'Website preview' })
    for (const text of ['Nadia’s 30th Birthday', 'Garden Party', 'Taman Kenanga', 'See you at the party!']) await expect(preview).toContainText(text, { timeout: 20_000 })

    const url = await publishViaUi(page, id)
    const { context, page: g, errors } = await guestPage(browser)
    await g.goto(url)
    const site = g.getByTestId('public-invitation')
    for (const text of ['Nadia’s 30th Birthday', 'Nadia Putri', 'Garden Party', 'Taman Kenanga', 'Jl. Kenanga No. 3, Yogyakarta', 'See you at the party!']) await expect(site).toContainText(text, { timeout: 20_000 })
    await expect(g.getByTestId('rsvp-form')).toBeVisible()
    expect(await horizontalOverflow(g)).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
    await context.close()
  })

  test('seminar: one ONLINE session with a joining link (https enforced) → publish → public join link, no venue/map', async ({ page, browser, freshUser }) => {
    void freshUser
    const id = await createViaWizard(page, { category: 'corporate', variant: 'seminar', title: 'Data Summit 2027' })
    await fillOpening(page, id, { title: 'Data Summit 2027', date: '2027-03-10' })
    // Sections a seminar shows by default: organization (needs a name), speakers, agenda.
    await openSection(page, id, 'organization')
    await page.locator('#f-name').fill('PT Data Nusantara')
    await expectSaved(page)
    await openSection(page, id, 'speakers')
    await page.locator('[data-action="add-speaker"]').click()
    await page.locator('#f-people-0-name').fill('Dr. Sari Wulandari')
    await expectSaved(page)
    await openSection(page, id, 'agenda')
    await page.locator('[data-action="add-agenda-item"]').click()
    await page.locator('#f-items-0-title').fill('Opening keynote')
    await page.locator('#f-items-0-time').fill('09:00')
    await expectSaved(page)
    await openSection(page, id, 'events')
    const [sessionId] = await eventIds(page, id)
    await fillSession(page, sessionId!, { title: 'Live Keynote Stream', date: '2027-03-10', startTime: '09:00', endTime: '11:00', onlineUrl: 'https://meet.example.com/data-summit' }, { checkTimeValidation: true })
    await expect.poll(async () => ((await getContent(page, id)).events as Json[])[0]).toMatchObject({ format: 'online', onlineUrl: 'https://meet.example.com/data-summit', title: 'Live Keynote Stream' })
    await fillClosing(page, id, 'Thank you for joining online.')
    await openSection(page, id, 'rsvp')
    await page.locator('#f-title').fill('Register now')
    await expectSaved(page)

    await page.goto(`/invitations/${id}/preview`)
    const preview = page.getByRole('main', { name: 'Website preview' })
    await expect(preview).toContainText('Live Keynote Stream', { timeout: 20_000 })
    await expect(preview.locator('[data-role="online-link"]').first()).toHaveAttribute('href', 'https://meet.example.com/data-summit')

    const url = await publishViaUi(page, id)
    const { context, page: g, errors } = await guestPage(browser)
    await g.goto(url)
    const events = g.getByTestId('public-invitation').locator('[data-section="events"]')
    await expect(events).toContainText('Live Keynote Stream', { timeout: 20_000 })
    await expect(events.locator('[data-role="online-link"]')).toHaveAttribute('href', 'https://meet.example.com/data-summit')
    await expect(events.getByText('View map')).toHaveCount(0)
    await expect(g.getByTestId('public-invitation')).toContainText('PT Data Nusantara')
    expect(errors).toEqual([])
    await context.close()
  })
})

// =====================================================================================
// 4. Interrupted-session recovery.
// =====================================================================================

test.describe('Interrupted-session recovery', () => {
  test.describe.configure({ timeout: 180_000 })
  test.use({ viewport: DESKTOP })

  const SAVED = 'Server copy of the closing message'
  const LOST = 'Typed just before the tab closed'

  async function seeded(page: Page) {
    const inv = await createInvitation(page, 'birthday', { themeId: TEMPLATE })
    await seedPublishable(page, inv)
    await putSection(page, inv.id, 'closing', { message: SAVED })
    return inv.id
  }
  const banner = (page: Page) => page.getByTestId('recovery-banner')

  test('tab closed before autosave → banner lists the section; Restore puts the values back and autosaves them', async ({ page, freshUser }) => {
    void freshUser
    const id = await seeded(page)
    const context = page.context()
    await openSection(page, id, 'closing')
    await expect(page.locator('#f-message')).toHaveValue(SAVED)
    await page.locator('#f-message').fill(LOST)
    await page.close() // well inside the 1 s autosave debounce
    expect((await getContent(await context.newPage(), id)).closing.message, 'the edit never reached the server').toBe(SAVED)

    const again = await context.newPage()
    await openSection(again, id, 'opening')
    await expect(banner(again)).toBeVisible({ timeout: 20_000 })
    await expect(banner(again)).toContainText(/Closing/i)
    await openSection(again, id, 'closing')
    await expect(again.locator('#f-message'), 'nothing is applied automatically').toHaveValue(SAVED)
    await again.locator('[data-action="restore-recovery"]').click()
    await expect(again.locator('#f-message')).toHaveValue(LOST)
    await expectSaved(again)
    await expect.poll(async () => (await getContent(again, id)).closing.message).toBe(LOST)
    await again.reload()
    await expect(again.locator('#f-message')).toHaveValue(LOST, { timeout: 20_000 })
    await expect(banner(again)).toHaveCount(0)
  })

  test('save fails (500) and the tab closes → banner; Discard removes it and keeps the server value', async ({ page, freshUser }) => {
    void freshUser
    const id = await seeded(page)
    const context = page.context()
    await openSection(page, id, 'closing')
    let failed = 0
    await page.route(`**${API}/invitations/${id}/sections/closing`, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      failed++
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
    })
    await page.locator('#f-message').fill(LOST)
    await expect.poll(() => failed, { message: 'the autosave was attempted and failed' }).toBeGreaterThan(0)
    await expect(saveStatus(page)).not.toHaveAttribute('data-state', 'saved')
    await page.close()
    expect((await getContent(await context.newPage(), id)).closing.message).toBe(SAVED)

    const again = await context.newPage()
    await openSection(again, id, 'closing')
    await expect(banner(again)).toBeVisible({ timeout: 20_000 })
    await expect(banner(again)).toContainText(/Closing/i)
    await again.locator('[data-action="discard-recovery"]').click()
    await expect(banner(again)).toHaveCount(0)
    await expect(again.locator('#f-message')).toHaveValue(SAVED)
    await again.reload()
    await expect(again.locator('#f-message')).toHaveValue(SAVED, { timeout: 20_000 })
    await expect(banner(again)).toHaveCount(0)
    expect((await getContent(again, id)).closing.message).toBe(SAVED)
  })

  test('recovery data is never shown to a different user on the same browser', async ({ page, freshUser }) => {
    const id = await seeded(page)
    const context = page.context()
    await openSection(page, id, 'closing')
    // Hold the save so it never completes (tab dies with the request in flight).
    await page.route(`**${API}/invitations/${id}/sections/closing`, (route) => (route.request().method() === 'PUT' ? undefined : route.fallback()))
    await page.locator('#f-message').fill(LOST)
    await page.close()

    // A second account signs in on the same browser profile.
    const other = await context.newPage()
    await switchToNewUser(other)
    const own = await createInvitation(other, 'birthday', { themeId: TEMPLATE })
    await openSection(other, own.id, 'closing')
    await expect(other.getByTestId('closing-form')).toBeVisible()
    await expect(banner(other)).toHaveCount(0)
    await expect(other.locator('body')).not.toContainText(LOST)
    await other.goto(`/invitations/${id}/edit/closing`)
    await expect(other.getByTestId('closing-form')).toHaveCount(0)
    await expect(banner(other)).toHaveCount(0)
    await expect(other.locator('body')).not.toContainText(LOST)

    // Back as the owner: the entry is still offered (it existed all along).
    await freshUser.loginInto(other)
    await openSection(other, id, 'closing')
    await expect(banner(other)).toBeVisible({ timeout: 20_000 })
  })
})

// =====================================================================================
// 9. Manage the event.
// =====================================================================================

test.describe('Manage a published event', () => {
  test.describe.configure({ timeout: 300_000 })
  test.use({ viewport: DESKTOP })

  test('responses + CSV, settings title, unpublish → 404, republish → same slug, deleting a referenced session keeps the reply', async ({ page, browser, freshUser }) => {
    void freshUser
    // Setup (not under test): a published seminar with an optional session guests can choose.
    const pub = await publishedInvitation(page, 'seminar', {
      themeId: TEMPLATE,
      title: 'Manage me',
      extraSessions: [{ type: 'workshop', title: 'Optional Workshop', optional: true }],
      rsvp: { allowSessionChoice: true },
    })
    const optional = ((await getContent(page, pub.id)).events as Json[]).find((e) => e.optional)!
    const reply = await postRsvp(pub.slug!, { name: 'Rina Kusuma', attendance: 'attending', partySize: 1, email: 'rina@example.com', sessionIds: [optional.id] })
    expect(reply.status, JSON.stringify(reply.json)).toBe(201)

    // Responses page + CSV export.
    await page.goto(`/invitations/${pub.id}/responses`)
    await expect(page.getByTestId('responses-summary').locator('[data-summary="responses"] dd')).toHaveText('1', { timeout: 20_000 })
    await expect(page.getByTestId('responses-table')).toContainText('Rina Kusuma')
    await expect(page.getByTestId('responses-table')).toContainText('Optional Workshop')
    const download = page.waitForEvent('download')
    await page.locator('[data-action="export-csv"]').click()
    const file = await download
    expect(file.suggestedFilename()).toBe(`rsvp-${pub.slug}.csv`)
    const { readFileSync } = await import('node:fs')
    const csv = readFileSync((await file.path())!, 'utf8')
    expect(csv).toContain('Rina Kusuma')
    expect(csv).toContain('rina@example.com')

    // Settings: the title persists.
    await openSection(page, pub.id, 'settings')
    await page.locator('#st-title').fill('Managed seminar')
    const patched = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/invitations/${pub.id}`))
    await page.locator('[data-action="save-title"]').click()
    expect((await patched).ok()).toBe(true)
    await page.reload()
    await expect(page.locator('#st-title')).toHaveValue('Managed seminar', { timeout: 20_000 })
    expect((await getInvitation(page, pub.id)).title).toBe('Managed seminar')

    // Unpublish → the public URL is a not-found page.
    const { context, page: g } = await guestPage(browser)
    await openPublic(g, pub.slug!)
    await openSection(page, pub.id, 'publish')
    await page.getByTestId('publish-page').locator('[data-action="unpublish"]').click()
    const confirm = page.getByTestId('confirm-dialog').filter({ visible: true })
    if (await confirm.count()) await confirm.getByRole('button', { name: /unpublish/i }).click()
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'draft', { timeout: 20_000 })
    await expect.poll(async () => (await getPublic(pub.slug!)).status()).toBe(404)
    await g.reload()
    await expect(g.getByTestId('public-not-found')).toBeVisible({ timeout: 20_000 })

    // Republish → the same slug works again; the reply is still there.
    await publishViaUi(page, pub.id)
    expect((await getInvitation(page, pub.id)).slug).toBe(pub.slug)
    await openPublic(g, pub.slug!)
    expect((await responses(page, pub.id)).total).toBe(1)

    // Delete the session the reply chose: the reply stays.
    await openSection(page, pub.id, 'events')
    const item = page.locator(`[data-item="${optional.id}"]`)
    await item.locator('[data-action="delete"]').click()
    await page.getByTestId('confirm-dialog').filter({ visible: true }).getByRole('button', { name: 'Delete' }).click()
    await expect(item).toHaveCount(0)
    await expect.poll(async () => ((await getContent(page, pub.id)).events as Json[]).map((e) => e.id)).not.toContain(optional.id)
    await publishViaUi(page, pub.id, true)
    const after = await responses(page, pub.id)
    expect(after.total).toBe(1)
    expect(after.items[0]).toMatchObject({ name: 'Rina Kusuma', attendance: 'attending' })
    await page.goto(`/invitations/${pub.id}/responses`)
    await expect(page.getByTestId('responses-summary').locator('[data-summary="responses"] dd')).toHaveText('1', { timeout: 20_000 })
    await expect(page.getByTestId('responses-table')).toContainText('Rina Kusuma')
    await context.close()
  })
})

// =====================================================================================
// 11. Tenant isolation smoke.
// =====================================================================================

test.describe('Tenant isolation', () => {
  test('a second user gets 404 for the first user’s editor, invitation, publish-check and responses', async ({ page, browser, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'birthday', { themeId: TEMPLATE, title: 'Tenant A only' })
    await seedPublishable(page, inv)

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: DESKTOP })
    const other = await ctx.newPage()
    await switchToNewUser(other)
    for (const path of [`${API}/invitations/${inv.id}`, `${API}/invitations/${inv.id}/publish-check`, `${API}/invitations/${inv.id}/rsvp-responses`]) {
      const res = await other.request.get(path)
      expect(res.status(), path).toBe(404)
      expect(await res.text()).not.toContain('Tenant A only')
    }
    const editorLoad = other.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname.startsWith(`${API}/invitations/${inv.id}`))
    await other.goto(`/invitations/${inv.id}/edit/opening`)
    expect((await editorLoad).status(), 'the editor’s own request is refused').toBe(404)
    // The editor settles on its load-failed state (not a spinner, not the owner's form).
    await expect(other.getByRole('alert').filter({ hasText: /couldn|load|not found/i }).first()).toBeVisible({ timeout: 20_000 })
    await expect(other.locator('body')).not.toContainText('Tenant A only')
    await expect(other.getByTestId('opening-form')).toHaveCount(0)
    await ctx.close()
    expect((await getInvitation(page, inv.id)).title).toBe('Tenant A only')
  })
})
