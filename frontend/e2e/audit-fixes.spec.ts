/**
 * Audit follow-up (2026-11-23) end to end against the real stack:
 * RSVP changes without double counting, publish checks that agree with the server (in
 * Indonesian), online/hybrid sessions, the published time zone, ceremony presets, editor
 * navigation during creation, the collapsible sidebar and personal guest links.
 * Every test owns a fresh account; nothing touches existing data.
 */
import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { API, createInvitation, getInvitation, postRsvp, publish, publishedInvitation, putSection, seedPublishable, type Json } from './invitation-helpers'

async function guest(browser: Browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { context, page, errors }
}
async function openPublic(page: Page, slug: string, suffix = '') {
  await page.goto(`/i/${slug}${suffix}`)
  await expect(page.getByTestId('public-invitation')).toBeVisible({ timeout: 20_000 })
}
async function summary(page: Page, id: string): Promise<Json> {
  return (await (await page.request.get(`${API}/invitations/${id}/rsvp-responses`)).json()).summary
}
/**
 * Submit the guest form; parallel tests share the browser-side RSVP rate-limit bucket, so a
 * "too many attempts" banner is waited out and retried (condition-based, no fixed sleeps).
 */
async function submitRsvp(g: Page, expectedTestId: string) {
  await expect
    .poll(
      async () => {
        await g.locator('[data-action="rsvp-submit"], [data-action="rsvp-retry"]').first().click()
        const outcome = await Promise.race([
          g.getByTestId(expectedTestId).waitFor({ timeout: 15_000 }).then(() => 'done'),
          g.locator('[data-error="rateLimited"]').waitFor({ timeout: 15_000 }).then(() => 'retry'),
        ]).catch(() => 'retry')
        return outcome
      },
      { timeout: 180_000, intervals: [5_000, 10_000, 15_000], message: 'RSVP was not accepted' },
    )
    .toBe('done')
}
const useIndonesianUi = (page: Page) => page.addInitScript(() => localStorage.setItem('kuren.appLocale', 'id'))

test.describe('RSVP: a guest changes their own reply', () => {
  test('attending → not attending replaces the reply; totals and capacity follow; a lost link is explained', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive', rsvp: { enabled: true, capacity: 3, maxGuestsPerResponse: 3 } })
    const { context, page: g, errors } = await guest(browser)
    await openPublic(g, pub.slug!)
    const form = g.getByTestId('rsvp-form')
    await form.getByLabel(/Your name/).fill('Rina Wulandari')
    await form.getByLabel(/I’ll be there|Yes/).first().check()
    await form.getByLabel(/Number of people/).selectOption('3')
    await submitRsvp(g, 'rsvp-success')
    const success = g.getByTestId('rsvp-success')
    // Personal link: token in the fragment, explained as private.
    const link = await success.getByTestId('rsvp-edit-link').locator('input').inputValue()
    expect(link).toMatch(new RegExp(`/i/${pub.slug}#rsvp=[A-Za-z0-9_-]{43}$`))
    expect((await summary(page, pub.id)).attendingPeople).toBe(3)
    expect((await (await page.request.get(`${API}/public/invitations/${pub.slug}`)).json()).content.rsvp.full).toBe(true)

    // Later visit on the same device: "Your reply", then change it.
    await openPublic(g, pub.slug!)
    const own = g.getByTestId('rsvp-own')
    await expect(own).toContainText('Rina Wulandari')
    await expect(own).toContainText('Attending · 3 people')
    await own.locator('[data-action="rsvp-change"]').click()
    await expect(g.getByTestId('rsvp-editing')).toContainText('replaces it')
    await g.getByTestId('rsvp-form').getByLabel(/can’t make it|Sorry/).check()
    await submitRsvp(g, 'rsvp-success')
    await expect(g.getByTestId('rsvp-success')).toContainText('updated')

    const s = await summary(page, pub.id)
    expect(s).toMatchObject({ responses: 1, attending: 0, notAttending: 1, attendingPeople: 0, possibleDuplicates: 0 })
    expect((await (await page.request.get(`${API}/public/invitations/${pub.slug}`)).json()).content.rsvp.full).toBe(false)

    // The organizer sees one reply, marked as changed by the guest.
    await page.goto(`/invitations/${pub.id}/responses`)
    await expect(page.locator('[data-badge="updated"]').first()).toBeVisible()

    // The same personal link on another device works; a broken one is explained.
    const other = await guest(browser)
    await other.page.goto(link)
    await expect(other.page.getByTestId('rsvp-own')).toContainText('Not attending')
    expect(other.page.url()).not.toContain('rsvp=')
    // A broken personal link (here: on the same open page) is forgotten and explained.
    await other.page.goto(`/i/${pub.slug}#rsvp=${'y'.repeat(43)}`)
    await expect(other.page.getByTestId('rsvp-link-lost')).toBeVisible()
    expect(await other.page.evaluate((slug) => localStorage.getItem(`temuvibe.rsvp.token.${slug}`), pub.slug)).toBeNull()
    expect(errors).toEqual([])
    await other.context.close()
    await context.close()
  })

  test('a second reply from the same person is kept and flagged for the organizer, never merged', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'family_gathering', { themeId: 'temuvibe-minimal' })
    for (const body of [{ name: 'Budi Santoso', attendance: 'attending', partySize: 2 }, { name: 'budi  santoso', attendance: 'not_attending' }]) {
      expect((await postRsvp(pub.slug!, body)).status).toBe(201)
    }
    expect(await summary(page, pub.id)).toMatchObject({ responses: 2, attending: 1, notAttending: 1, possibleDuplicates: 2 })
    await page.goto(`/invitations/${pub.id}/responses`)
    await expect(page.getByTestId('responses-duplicates')).toContainText('2 replies')
    await expect(page.locator('[data-badge="duplicate"]').first()).toBeVisible()
    void browser
  })
})

test.describe('Publish checks agree with the server', () => {
  test('the audited seminar: empty organization, agenda and speakers block before clicking, in Indonesian', async ({ page, freshUser }) => {
    void freshUser
    await useIndonesianUi(page)
    const inv = await createInvitation(page, 'seminar', { themeId: 'temuvibe-corporate', locale: 'id' })
    await seedPublishable(page, inv)
    for (const section of ['organization', 'agenda', 'speakers']) await putSection(page, inv.id, section, { enabled: true })
    await page.goto(`/invitations/${inv.id}/edit/publish`)
    const errors = page.getByTestId('publish-errors')
    await expect(errors).toBeVisible({ timeout: 20_000 })
    await expect(errors).toContainText('Organisasi ditampilkan tetapi belum ada nama')
    await expect(errors).toContainText('Susunan acara ditampilkan')
    await expect(errors).toContainText('Pembicara ditampilkan')
    await expect(page.getByTestId('publish-all-clear')).toHaveCount(0)
    await expect(page.locator('[data-action="publish"]')).toHaveAttribute('aria-disabled', 'true')
    // And the server says the same.
    const check = await (await page.request.get(`${API}/invitations/${inv.id}/publish-check`)).json()
    expect(check.issues.map((i: Json) => i.section).sort()).toEqual(['agenda', 'organization', 'speakers'])
    // Fill one, hide the others: all clear only once the server confirms, then publish works.
    await putSection(page, inv.id, 'organization', { enabled: true, name: 'PT Contoh' })
    await putSection(page, inv.id, 'agenda', { enabled: false })
    await putSection(page, inv.id, 'speakers', { enabled: false })
    await page.reload()
    await expect(page.getByTestId('publish-all-clear')).toBeVisible({ timeout: 20_000 })
    await page.locator('[data-action="publish"]').click()
    await expect(page.getByTestId('publish-status')).toHaveAttribute('data-state', 'published', { timeout: 20_000 })
  })
})

test.describe('Online and hybrid sessions', () => {
  test('an online seminar needs no venue; guests get a join link, no map; calendar times use the published zone', async ({ page, browser, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'seminar', { themeId: 'temuvibe-corporate', timezone: 'Asia/Makassar' })
    await seedPublishable(page, inv)
    await page.goto(`/invitations/${inv.id}/edit/events`)
    await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
    await page.locator('[data-action="edit-item"], [data-action="edit"]').first().click()
    const editor = page.getByTestId('event-editor')
    await editor.locator('[data-format="online"]').check()
    await expect(editor.getByLabel('Venue name')).toHaveCount(0)
    await expect(editor.getByTestId('venue-kept')).toBeVisible()
    await editor.getByLabel('Joining link').fill('https://zoom.us/j/123456')
    await expect(page.getByTestId('save-status').first()).toHaveAttribute('data-state', 'saved', { timeout: 20_000 })
    const pub = await publish(page, inv.id)

    const { context, page: g, errors } = await guest(browser, { width: 1280, height: 900 })
    await openPublic(g, pub.slug!)
    const session = g.locator('[data-section="events"]')
    await expect(session.locator('[data-role="online-link"]')).toHaveAttribute('href', 'https://zoom.us/j/123456')
    await expect(session.getByText('View map')).toHaveCount(0)
    const google = await g.locator('[data-calendar="google"]').first().getAttribute('href')
    const url = new URL(google!)
    expect(url.searchParams.get('ctz')).toBe('Asia/Makassar')
    expect(url.searchParams.get('location')).toBe('https://zoom.us/j/123456')
    expect(url.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    expect(errors).toEqual([])
    await context.close()
  })

  test('a hybrid workshop needs a venue AND joining details', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'workshop', { themeId: 'temuvibe-corporate' })
    await seedPublishable(page, inv)
    const sessions = await (await page.request.get(`${API}/invitations/${inv.id}/events`)).json()
    const res = await page.request.put(`${API}/invitations/${inv.id}/events/${sessions[0].id}`, {
      data: { type: 'workshop', title: 'Hands-on', date: '2027-06-12', startTime: '09:00', format: 'hybrid', venueName: 'Lab', address: 'Jl. A' },
    })
    expect(res.ok()).toBe(true)
    const blocked = await page.request.post(`${API}/invitations/${inv.id}/publish`)
    expect(blocked.status()).toBe(422)
    expect((await blocked.json()).error.details.map((d: Json) => d.field)).toEqual(['events.0.onlineUrl'])
  })
})

test.describe('Published time zone', () => {
  test('changing the draft time zone does not reach guests until republished', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'graduation', { themeId: 'temuvibe-elegant' })
    expect((await (await page.request.get(`${API}/public/invitations/${pub.slug}`)).json()).timezone).toBe('Asia/Jakarta')
    await page.goto(`/invitations/${pub.id}/edit/settings`)
    await expect(page.getByTestId('timezone-published-note')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('timezone-field').locator('[data-role="timezone-search"]').fill('WIT ')
    await page.getByTestId('timezone-field').locator('select').selectOption('Asia/Jayapura')
    await expect.poll(async () => (await getInvitation(page, pub.id)).timezone).toBe('Asia/Jayapura')
    expect((await getInvitation(page, pub.id)).hasUnpublishedChanges).toBe(true)
    expect((await (await page.request.get(`${API}/public/invitations/${pub.slug}`)).json()).timezone).toBe('Asia/Jakarta')
    await publish(page, pub.id)
    expect((await (await page.request.get(`${API}/public/invitations/${pub.slug}`)).json()).timezone).toBe('Asia/Jayapura')
    void browser
  })
})

test.describe('Wedding ceremony presets', () => {
  async function wizardTo(page: Page, variant: string) {
    await page.goto(`/invitations/new?category=wedding&variant=${variant}&template=temuvibe-elegant&step=name`)
    await expect(page.getByTestId('wizard-sessions')).toBeVisible({ timeout: 20_000 })
  }
  async function createdSessions(page: Page) {
    await page.locator('[data-action="create"]').click()
    await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/, { timeout: 20_000 })
    const id = page.url().match(/invitations\/([0-9a-f-]{36})/)![1]!
    return ((await (await page.request.get(`${API}/invitations/${id}/events`)).json()) as Json[]).map((e) => `${e.type}:${e.title}`)
  }

  test('ceremony only (akad), blessing + reception, reception only, reception + ceremony', async ({ page, freshUser }) => {
    void freshUser
    await wizardTo(page, 'wedding_ceremony')
    await page.locator('[data-ceremony="akad"]').check()
    expect(await createdSessions(page)).toEqual(['akad:Akad Nikah'])

    await wizardTo(page, 'wedding_ceremony')
    await page.locator('[data-ceremony="holy_matrimony"]').check()
    await page.locator('[data-choice="extra"]').check()
    expect(await createdSessions(page)).toEqual(['holy_matrimony:Pemberkatan Nikah', 'reception:Resepsi'])

    await wizardTo(page, 'wedding_reception')
    await expect(page.getByTestId('wizard-ceremony-type')).toHaveCount(0)
    expect(await createdSessions(page)).toEqual(['reception:Resepsi'])

    await wizardTo(page, 'wedding_reception')
    await page.locator('[data-choice="extra"]').check()
    await page.locator('[data-ceremony="ceremony"]').check()
    expect(await createdSessions(page)).toEqual(['ceremony:Upacara Pernikahan', 'reception:Resepsi'])
  })
})

test.describe('Editor navigation and layout', () => {
  test('while creating, no shortcut points at the previously edited invitation; the sidebar collapses', async ({ page, freshUser }) => {
    void freshUser
    await page.setViewportSize({ width: 1366, height: 800 })
    const inv = await createInvitation(page, 'wedding_reception', { title: 'Audit wedding' })
    await page.goto(`/invitations/${inv.id}/edit/opening`)
    await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
    const sidebar = page.locator('aside.cms-sidebar')
    // Editor: collapsed by default (room for form + preview); expand shows the active invitation.
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    await sidebar.locator('[data-action="toggle-sidebar"]').click()
    await expect(page.getByTestId('sidebar-active-invitation')).toContainText('Audit wedding')
    await expect(sidebar.locator(`a[href^="/invitations/${inv.id}/"]`).first()).toBeVisible()

    await page.goto('/invitations/new?category=wedding&variant=wedding_ceremony&step=template')
    await expect(page.getByTestId('step-template')).toBeVisible({ timeout: 20_000 })
    await expect(sidebar.locator(`a[href*="${inv.id}"]`)).toHaveCount(0)
    await expect(page.getByTestId('main-nav').locator(`a[href*="${inv.id}"]`)).toHaveCount(0)
    // Template discovery: search + preview link that opens in a new tab.
    await page.getByLabel('Search templates').fill('temuvibe')
    await expect(page.getByTestId('template-count')).toContainText(/^2 of \d+ templates$/)
    await expect(page.locator('[data-preview="temuvibe-elegant"]')).toHaveAttribute('target', '_blank')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })

  test('personal guest link: generated on Preview & Publish, greets the guest by name (fragment, not query)', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive' })
    await page.goto(`/invitations/${pub.id}/edit/publish`)
    const box = page.getByTestId('personal-link')
    await box.getByLabel('Guest name').fill('Bapak Budi & Keluarga')
    const link = await box.getByTestId('personal-link-url').inputValue()
    expect(link).toContain(`/i/${pub.slug}#to=`)
    expect(link).not.toContain('?to=')
    const { context, page: g } = await guest(browser)
    await g.goto(link)
    await expect(g.getByTestId('public-invitation')).toContainText('Bapak Budi & Keluarga', { timeout: 20_000 })
    await expect(g.locator('input[name="name"]')).toHaveValue('Bapak Budi & Keluarga')
    await context.close()
  })
})
