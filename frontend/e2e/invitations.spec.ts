/**
 * Invitation engine v2.0 end to end (docs/architecture/invitation-engine.md incl. §6a,
 * docs/api/invitations.md) against the real FastAPI + PostgreSQL stack.
 *
 * Every test owns a freshly registered account (fixtures.ts) and seeds state through the
 * API (invitation-helpers.ts); the UI is driven only for the behaviour under test.
 * Waits are condition-based only: save-status `data-state`, expect.poll on the API,
 * URL changes and DOM state. Public RSVP posts from API-level checks go straight to the
 * backend (separate per-IP rate-limit bucket from the browser's proxied requests).
 */
import type { Browser, Page } from '@playwright/test'

import { expect, test } from './fixtures'
import {
  API,
  REGISTRY,
  TEMUVIBE,
  categoryOf,
  createInvitation,
  getContent,
  getInvitation,
  getPublic,
  marker,
  offers,
  postRsvp,
  postRsvpRaw,
  publish,
  publishedInvitation,
  putSection,
  seedPublishable,
  variantDef,
  type CategoryId,
  type Json,
} from './invitation-helpers'

const ALL_VARIANTS = REGISTRY.variants.map((v) => v.id)
const UI_REPRESENTATIVES: Record<CategoryId, string> = {
  wedding: 'wedding_ceremony',
  celebration: 'birthday',
  gathering: 'family_gathering',
  corporate: 'seminar',
}
/** Editor placeholders (features/wedding/draft.ts + features/invitation/draft.ts, en + id) minus
 *  the generic RSVP heading, which is also a legitimate heading text. */
const PLACEHOLDERS = [
  'Your wedding title', 'Your event title', 'Your names', 'Name to display', 'Groom’s name', 'Bride’s name',
  'Event details coming soon', 'Venue to be announced', 'Address coming soon', 'Your closing message will appear here',
  'Judul pernikahan Anda', 'Judul acara Anda', 'Nama Anda berdua', 'Nama yang ditampilkan', 'Nama mempelai pria',
  'Nama mempelai wanita', 'Detail acara segera hadir', 'Lokasi akan diumumkan', 'Alamat segera hadir',
  'Pesan penutup Anda akan tampil di sini', 'Name to be added', 'Agenda item to be added', 'Speaker to be added',
  'Nama belum diisi', 'Susunan acara belum diisi', 'Pembicara belum diisi',
]

let templatesFromApi: Array<{ id: string; categories: CategoryId[]; variants?: string[] }> | undefined
async function apiTemplates(page: Page) {
  if (!templatesFromApi) {
    const res = await page.request.get(`${API}/invitation-types`)
    expect(res.ok()).toBe(true)
    templatesFromApi = (await res.json()).templates
  }
  return templatesFromApi!
}
async function compatibleIds(page: Page, variant: string) {
  const cat = categoryOf(variant)
  return (await apiTemplates(page)).filter((t) => t.categories.includes(cat) && (!t.variants || t.variants.includes(variant))).map((t) => t.id).sort()
}

const saveStatus = (page: Page) => page.getByTestId('save-status').first()
async function expectSaved(page: Page) {
  await expect(saveStatus(page)).toHaveAttribute('data-state', 'saved', { timeout: 20_000 })
}
async function openSection(page: Page, id: string, slug: string) {
  await page.goto(`/invitations/${id}/edit/${slug}`)
  await expect(page.getByTestId('editor-layout')).toBeVisible({ timeout: 20_000 })
}
const editorUrl = (slug: string) => new RegExp(`/invitations/[0-9a-f-]{36}/edit/${slug}(\\?|#|$)`)

/** A logged-out guest page with page-error capture. */
async function guestPage(browser: Browser, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { context, page, errors }
}
async function openPublic(page: Page, slug: string, query = '') {
  await page.goto(`/i/${slug}${query}`)
  await expect(page.getByTestId('public-invitation')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('public-invitation').locator('[data-section="closing"]').first()).toBeAttached({ timeout: 20_000 })
}
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}
/** Top-level sections the temuvibe renderer drew, mapped to registry section ids. */
async function renderedSections(page: Page) {
  const ids = await page.locator('article.t-tv > [data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')!))
  return ids.map((s) => (s === 'weddingDate' ? 'countdown' : s))
}

// =====================================================================================
test.describe('Creation wizard', () => {
  for (const [category, variant] of Object.entries(UI_REPRESENTATIVES) as [CategoryId, string][]) {
    test(`creates a ${variant} through the UI (${category}) offering only compatible templates`, async ({ page, freshUser }) => {
      void freshUser
      await page.goto('/invitations/new')
      await expect(page.getByTestId('step-category')).toBeVisible()
      await expect(page.locator('[data-action="next"]')).toBeDisabled()
      await page.locator(`input[data-category="${category}"]`).check()
      await page.locator('[data-action="next"]').click()
      await expect(page.getByTestId('step-variant')).toBeVisible()
      // Only this category's variants.
      const offeredVariants = await page.locator('input[name="variant"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
      expect(offeredVariants.sort()).toEqual(REGISTRY.categories.find((c) => c.id === category)!.variants.slice().sort())
      await page.locator(`input[data-variant="${variant}"]`).check()
      await page.locator('[data-action="next"]').click()
      await expect(page.getByTestId('step-template')).toBeVisible()
      const offered = await page.locator('input[name="template"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
      expect(offered.slice().sort(), 'wizard offers exactly the compatible templates').toEqual(await compatibleIds(page, variant))
      if (category === 'corporate') expect(offered).not.toContain('temuvibe-festive')
      if (category !== 'wedding') expect(offered.filter((id) => !id.startsWith('temuvibe-'))).toEqual([])
      const pick = category === 'corporate' ? 'temuvibe-corporate' : category === 'wedding' ? 'temuvibe-elegant' : 'temuvibe-minimal'
      await page.locator(`input[data-template="${pick}"]`).check()
      await page.locator('[data-action="next"]').click()
      await expect(page.getByTestId('step-name')).toBeVisible()
      await page.locator('#wz-title').fill(`QA ${variant}`)
      await page.locator('[data-action="create"]').click()
      await expect(page).toHaveURL(/\/invitations\/[0-9a-f-]{36}\/edit/, { timeout: 20_000 })
      const id = page.url().match(/invitations\/([0-9a-f-]{36})/)![1]!
      const inv = await getInvitation(page, id)
      expect(inv).toMatchObject({ category, variant, themeId: pick, title: `QA ${variant}`, locale: 'id', timezone: 'Asia/Jakarta', status: 'draft' })
    })
  }

  test('the API creates every other variant with its registry presets', async ({ page, freshUser }) => {
    void freshUser
    const rest = ALL_VARIANTS.filter((v) => !Object.values(UI_REPRESENTATIVES).includes(v))
    expect(rest).toHaveLength(13)
    for (const variant of rest) {
      const def = variantDef(variant)
      const inv = await createInvitation(page, variant, { themeId: 'temuvibe-elegant', locale: 'en' })
      expect(inv, variant).toMatchObject({ category: def.category, variant, status: 'draft' })
      const c = await getContent(page, inv.id)
      expect(c.schemaVersion, variant).toBe(2)
      expect(c.events.map((e: Json) => e.type), `${variant} session presets`).toEqual(def.sessionPresets.map((p) => p.type))
      expect(c.events.map((e: Json) => e.title), `${variant} preset titles (en)`).toEqual(def.sessionPresets.map((p) => p.title.en))
      for (const s of def.sections.filter((x) => !x.required && x.defaultEnabled && ['profiles', 'milestone', 'organization', 'agenda', 'speakers'].includes(x.id))) {
        expect(c[s.id]?.enabled, `${variant}.${s.id} starts on`).toBe(true)
      }
      if (def.rsvpDefaults.maxGuestsPerResponse) expect(c.rsvp.maxGuestsPerResponse, variant).toBe(def.rsvpDefaults.maxGuestsPerResponse)
      if (def.rsvpDefaults.collectContact) expect(c.rsvp.collectContact, variant).toBe(def.rsvpDefaults.collectContact)
    }
    const sweet = await getContent(page, (await createInvitation(page, 'sweet_17')).id)
    expect(sweet.milestone).toMatchObject({ enabled: true, age: 17 })
    const ws = await getContent(page, (await createInvitation(page, 'workshop')).id)
    expect(ws.rsvp.registrationFields).toEqual([expect.objectContaining({ id: 'company', label: 'Company', type: 'text', required: false })])
    // The list now holds all 15 (+ nothing else).
    const list = (await (await page.request.get(`${API}/invitations`)).json()).items
    expect(list).toHaveLength(15)
  })

  test('reload mid-wizard keeps the choices; the stepper only links to reached steps', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/invitations/new')
    await page.locator('input[data-category="celebration"]').check()
    await page.locator('[data-action="next"]').click()
    await page.locator('input[data-variant="graduation"]').check()
    await page.locator('[data-action="next"]').click()
    await page.locator('input[data-template="temuvibe-festive"]').check()
    await expect(page).toHaveURL(/template=temuvibe-festive/)
    await page.reload()
    await expect(page.getByTestId('step-template')).toBeVisible()
    await expect(page.locator('input[data-template="temuvibe-festive"]')).toBeChecked()
    // Back goes to the variant step with graduation still chosen.
    await page.locator('[data-action="back"]').click()
    await expect(page.getByTestId('step-variant')).toBeVisible()
    await expect(page.locator('input[data-variant="graduation"]')).toBeChecked()
    // A step past a missing choice falls back: drop the variant from the URL.
    await page.goto('/invitations/new?step=name&category=celebration')
    await expect(page.getByTestId('step-variant')).toBeVisible()
    await expect(page.getByTestId('wizard-steps').locator('a[data-step="name"]')).toHaveCount(0)
  })

  test('?template= preselects a compatible template and explains an incompatible one', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/invitations/new?category=corporate&variant=seminar&template=temuvibe-corporate&step=template')
    await expect(page.locator('input[data-template="temuvibe-corporate"]')).toBeChecked()
    await expect(page.getByTestId('template-incompatible')).toHaveCount(0)
    await expect(page.locator('[data-action="next"]')).toBeEnabled()

    // Festive doesn't do corporate; a legacy wedding theme doesn't do birthdays.
    for (const [q, tpl] of [['category=corporate&variant=seminar', 'temuvibe-festive'], ['category=celebration&variant=birthday', 'afterglow']]) {
      await page.goto(`/invitations/new?${q}&template=${tpl}&step=name`)
      await expect(page.getByTestId('step-template'), 'cannot skip past an incompatible template').toBeVisible()
      await expect(page.getByTestId('template-incompatible')).toBeVisible()
      await expect(page.locator(`input[data-template="${tpl}"]`)).toHaveCount(0)
      await expect(page.locator('[data-action="next"]')).toBeDisabled()
    }
    // A wedding theme on an anniversary is compatible.
    await page.goto('/invitations/new?category=celebration&variant=anniversary&template=afterglow&step=template')
    await expect(page.locator('input[data-template="afterglow"]')).toBeChecked()
  })
})

// =====================================================================================
test.describe('Invitation list', () => {
  // Public RSVP posts share a 10/min/IP server window across parallel workers (see postRsvp).
  test.describe.configure({ timeout: 300_000 })
  test('shows statuses, copies the public URL and deletes with confirmation (replies too)', async ({ page, freshUser }) => {
    void freshUser
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const draft = await createInvitation(page, 'birthday', { title: 'QA draft birthday' })
    const live = await publishedInvitation(page, 'seminar', { themeId: 'temuvibe-corporate', title: 'QA live seminar' })
    const changed = await publishedInvitation(page, 'family_reunion', { themeId: 'temuvibe-festive', title: 'QA changed reunion' })
    await putSection(page, changed.id, 'closing', { message: 'Changed after publishing' })
    const reply = await postRsvp(live.slug!, { name: 'List Guest', attendance: 'attending', partySize: 1, email: 'guest@example.com' })
    expect(reply.status).toBe(201)

    await page.goto('/invitations')
    const card = (id: string) => page.locator(`[data-invitation="${id}"]`)
    await expect(card(draft.id).getByTestId('card-status')).toHaveAttribute('data-state', 'draft')
    await expect(card(live.id).getByTestId('card-status')).toHaveAttribute('data-state', 'published')
    await expect(card(changed.id).getByTestId('card-status')).toHaveAttribute('data-state', 'unpublished_changes')
    await expect(card(draft.id).getByTestId('card-name')).toHaveText('QA draft birthday')
    await expect(card(draft.id).getByTestId('card-url')).toHaveCount(0)
    await expect(card(live.id).getByTestId('card-variant')).toHaveText(/Seminar/i)
    // Newest-updated first: the reunion was changed last.
    await expect(page.locator('[data-invitation]').first()).toHaveAttribute('data-invitation', changed.id)

    const url = card(live.id).getByTestId('card-url')
    await expect(url).toHaveText(new RegExp(`/i/${live.slug}$`))
    await card(live.id).locator('[data-action="copy-link"]').click()
    await expect(page.getByText('Link copied').first()).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await url.innerText())

    // Delete: Cancel keeps it; confirming removes it, its replies and its public page.
    await card(live.id).locator('[data-action="delete"]').click()
    const dialog = page.getByTestId('confirm-dialog').filter({ hasText: 'QA live seminar' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(/RSVP replies/)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(card(live.id)).toBeVisible()
    expect((await page.request.get(`${API}/invitations/${live.id}`)).status()).toBe(200)
    await card(live.id).locator('[data-action="delete"]').click()
    await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Delete invitation' }).click()
    await expect(card(live.id)).toHaveCount(0)
    await expect(page.getByText('“QA live seminar” was deleted.').first()).toBeVisible()
    expect((await page.request.get(`${API}/invitations/${live.id}`)).status()).toBe(404)
    expect((await page.request.get(`${API}/invitations/${live.id}/rsvp-responses`)).status()).toBe(404)
    expect((await getPublic(live.slug!)).status()).toBe(404)
    await expect(page.locator('[data-invitation]')).toHaveCount(2)
  })

  test('an account without invitations gets the empty state that starts the wizard', async ({ page, freshUser }) => {
    void freshUser
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/invitations$/)
    await expect(page.getByTestId('invitations-empty')).toBeVisible()
    await page.getByTestId('invitations-empty').locator('[data-action="create-invitation"]').click()
    await expect(page).toHaveURL(/\/invitations\/new/)
  })
})

// =====================================================================================
test.describe('Variant editing', () => {
  test('birthday: celebrant, age, party theme and dress code autosave; invalid values never save', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'birthday', { themeId: 'temuvibe-festive' })
    // Non-offered sections are refused by the API.
    const couple = await page.request.put(`${API}/invitations/${inv.id}/sections/couple`, { data: { groom: { name: 'X' }, bride: { name: 'Y' } } })
    expect(couple.status()).toBe(422)
    expect((await couple.json()).error.code).toBe('section_not_available')

    await openSection(page, inv.id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Nadia Putri')
    await page.locator('#f-people-0-nickname').fill('Nadia')
    await expect(page.locator('#f-people-0-role'), 'only one role (celebrant): no role picker').toHaveCount(0)
    await expect(page.locator('#f-people-0-parents'), 'birthday has no parents field').toHaveCount(0)
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).profiles?.people?.[0]).toMatchObject({ role: 'celebrant', name: 'Nadia Putri', nickname: 'Nadia' })
    await page.locator('#f-people-0-name').fill('x'.repeat(121))
    await expect(page.locator('#f-people-0-name')).toHaveAttribute('aria-invalid', 'true')
    await expect(saveStatus(page)).not.toHaveAttribute('data-state', 'saved')
    expect((await getContent(page, inv.id)).profiles.people[0].name).toBe('Nadia Putri')
    await page.locator('#f-people-0-name').fill('Nadia Putri Ayu')
    await expectSaved(page)

    await openSection(page, inv.id, 'milestone')
    await expect(page.locator('[data-field="years"], [data-field="occasion"], [data-field="institution"]')).toHaveCount(0)
    await page.locator('#f-age').fill('abc')
    await expect(page.locator('#f-age')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-age').fill('151')
    await expect(page.locator('#f-age')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-age').fill('7')
    await page.locator('#f-partyTheme').fill('Unicorn Garden')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).milestone).toMatchObject({ enabled: true, age: 7, partyTheme: 'Unicorn Garden' })

    await openSection(page, inv.id, 'events')
    await page.getByTestId('list-editor').locator('[data-action="edit"]').first().click()
    const editor = page.getByTestId('event-editor')
    await editor.getByRole('switch', { name: 'Dress code' }).check()
    await editor.getByLabel('Dress code details').fill('Pastel colours')
    await editor.locator('[data-action="done-item"]').click()
    await expect.poll(async () => (await getContent(page, inv.id)).events[0].dressCode).toMatchObject({ enabled: true, text: 'Pastel colours' })
  })

  test('khitanan / aqiqah: child with parents, aqiqah birth date, religious message', async ({ page, freshUser }) => {
    void freshUser
    const khitanan = await createInvitation(page, 'khitanan')
    await openSection(page, khitanan.id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Muhammad Rizky')
    await page.locator('#f-people-0-parents').fill('Bapak Ahmad & Ibu Siti')
    await expect(page.locator('#f-people-0-birthDate'), 'khitanan has no birth date').toHaveCount(0)
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, khitanan.id)).profiles?.people?.[0]).toMatchObject({ role: 'child', name: 'Muhammad Rizky', parents: 'Bapak Ahmad & Ibu Siti' })
    // Role is enforced on write.
    const bad = await page.request.put(`${API}/invitations/${khitanan.id}/sections/profiles`, { data: { enabled: true, people: [{ role: 'graduate', name: 'X' }] } })
    expect(bad.status()).toBe(422)
    expect(JSON.stringify((await bad.json()).error.details)).toContain('people.0.role')

    // Religious message (holyRecite1) is offered and starts off.
    await openSection(page, khitanan.id, 'holy-recite-1')
    await page.getByRole('switch', { name: 'Show on website' }).check()
    await page.locator('#f-translation').fill('Semoga Allah memberkahi anak ini.')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, khitanan.id)).holyRecite1).toMatchObject({ enabled: true, translation: 'Semoga Allah memberkahi anak ini.' })

    const aqiqah = await createInvitation(page, 'aqiqah')
    await openSection(page, aqiqah.id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Aisyah')
    await page.locator('#f-people-0-parents').fill('Bapak Budi & Ibu Rina')
    await expect(page.locator('#f-people-0-birthDate')).toHaveCount(1)
    await page.locator('#f-people-0-birthDate').fill('2026-10-01')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, aqiqah.id)).profiles?.people?.[0]).toMatchObject({ role: 'child', name: 'Aisyah', birthDate: '2026-10-01' })
  })

  test('engagement: the couple is required (no hide switch) and autosaves', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'engagement')
    await openSection(page, inv.id, 'couple')
    await expect(page.getByTestId('couple-form').getByTestId('section-toggle')).toHaveCount(0)
    await page.locator('#f-groom-name').fill('Raka Pratama')
    await page.locator('#f-bride-name').fill('Sinta Dewi')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).couple).toMatchObject({ groom: { name: 'Raka Pratama' }, bride: { name: 'Sinta Dewi' } })
    const hide = await page.request.put(`${API}/invitations/${inv.id}/sections/couple`, { data: { enabled: false, groom: { name: 'Raka' }, bride: { name: 'Sinta' } } })
    expect(hide.status(), 'hiding a required couple').toBe(422)
    expect(JSON.stringify((await hide.json()).error.details)).toContain('enabled')
  })

  test('anniversary: the couple can be hidden and shown; years validated', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'anniversary')
    await openSection(page, inv.id, 'couple')
    await page.locator('#f-groom-name').fill('Hendra')
    await page.locator('#f-bride-name').fill('Lina')
    await expectSaved(page)
    const toggle = page.getByTestId('couple-form').getByRole('switch', { name: 'Show on website' })
    await toggle.uncheck()
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).couple.enabled).toBe(false)
    expect((await getContent(page, inv.id)).couple.groom.name, 'hidden values are kept').toBe('Hendra')
    await toggle.check()
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).couple.enabled).not.toBe(false)

    await openSection(page, inv.id, 'milestone')
    await expect(page.locator('[data-field="age"]')).toHaveCount(0)
    await page.locator('#f-years').fill('101')
    await expect(page.locator('#f-years')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-years').fill('25')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).milestone).toMatchObject({ years: 25 })
    // A wedding can't hide its couple.
    const wedding = await createInvitation(page, 'wedding_reception')
    const res = await page.request.put(`${API}/invitations/${wedding.id}/sections/couple`, { data: { enabled: false, groom: {}, bride: {} } })
    expect(res.status()).toBe(422)
  })

  test('graduation (institution/program/degree) and religious celebration (occasion)', async ({ page, freshUser }) => {
    void freshUser
    const grad = await createInvitation(page, 'graduation')
    await openSection(page, grad.id, 'milestone')
    await page.locator('#f-institution').fill('Universitas Gadjah Mada')
    await page.locator('#f-program').fill('Teknik Informatika')
    await page.locator('#f-degree').fill('S.Kom.')
    await expect(page.locator('[data-field="age"], [data-field="partyTheme"], [data-field="years"]')).toHaveCount(0)
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, grad.id)).milestone).toMatchObject({ institution: 'Universitas Gadjah Mada', program: 'Teknik Informatika', degree: 'S.Kom.' })
    await page.locator('#f-degree').fill('x'.repeat(161))
    await expect(page.locator('#f-degree')).toHaveAttribute('aria-invalid', 'true')

    const rel = await createInvitation(page, 'religious_celebration')
    await openSection(page, rel.id, 'milestone')
    await page.locator('#f-occasion').fill('Idul Fitri 1448 H')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, rel.id)).milestone).toMatchObject({ occasion: 'Idul Fitri 1448 H' })
    await openSection(page, rel.id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Keluarga Besar Hasan')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, rel.id)).profiles?.people?.[0]?.role).toBe('host')
  })

  test('gathering: hosts with roles, agenda, party-size limit (default 10)', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'community_gathering', { themeId: 'temuvibe-festive' })
    await openSection(page, inv.id, 'profiles')
    await page.locator('[data-action="add-person"]').click()
    await page.locator('#f-people-0-name').fill('Karang Taruna RW 05')
    await page.locator('#f-people-0-role').selectOption('organizer')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).profiles?.people?.[0]).toMatchObject({ role: 'organizer', name: 'Karang Taruna RW 05' })

    await openSection(page, inv.id, 'agenda')
    await page.locator('[data-action="add-agenda-item"]').click()
    await page.locator('#f-items-0-title').fill('Kerja bakti')
    await page.locator('#f-items-0-time').fill('08:00')
    await page.locator('#f-items-0-endTime').fill('07:00')
    await expect(page.locator('#f-items-0-endTime')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-items-0-endTime').fill('10:00')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).agenda?.items?.[0]).toMatchObject({ title: 'Kerja bakti', time: '08:00', endTime: '10:00' })

    await openSection(page, inv.id, 'rsvp')
    await expect(page.locator('#f-maxGuestsPerResponse')).toHaveValue('10')
    await page.locator('#f-maxGuestsPerResponse').fill('21')
    await expect(page.locator('#f-maxGuestsPerResponse')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-maxGuestsPerResponse').fill('6')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).rsvp.maxGuestsPerResponse).toBe(6)
  })

  test('seminar: organization, speakers, agenda, optional session and the registration builder', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'seminar', { themeId: 'temuvibe-corporate' })
    await openSection(page, inv.id, 'organization')
    await page.locator('#f-name').fill('PT Maju Bersama')
    await page.locator('#f-websiteUrl').fill('http://insecure.example.com')
    await expect(page.locator('#f-websiteUrl')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-websiteUrl').fill('https://maju.example.com')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).organization).toMatchObject({ name: 'PT Maju Bersama', websiteUrl: 'https://maju.example.com' })

    await openSection(page, inv.id, 'speakers')
    await page.locator('[data-action="add-speaker"]').click()
    await page.locator('#f-people-0-name').fill('Dr. Sari Wulandari')
    await page.locator('#f-people-0-role').fill('Keynote')
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).speakers?.people?.[0]).toMatchObject({ name: 'Dr. Sari Wulandari', role: 'Keynote' })
    const speakerId = (await getContent(page, inv.id)).speakers.people[0].id

    await openSection(page, inv.id, 'agenda')
    await page.locator('[data-action="add-agenda-item"]').click()
    await page.locator('#f-items-0-title').fill('Opening keynote')
    await page.locator('#f-items-0-time').fill('09:00')
    await page.getByTestId('agenda-speakers-0').locator(`input[data-speaker="${speakerId}"]`).check()
    await expectSaved(page)
    await expect.poll(async () => (await getContent(page, inv.id)).agenda?.items?.[0]).toMatchObject({ title: 'Opening keynote', speakerIds: [speakerId] })

    // An optional session (corporate only).
    await openSection(page, inv.id, 'events')
    await page.getByTestId('list-editor').locator('[data-action="add"]').click()
    const editor = page.getByTestId('list-create').getByTestId('event-editor')
    await editor.locator('input[id$="-title"]').fill('Afternoon workshop')
    await editor.getByLabel('Date').fill('2027-03-10')
    await editor.getByLabel('Start time').fill('14:00')
    await editor.getByLabel('Venue name').fill('Room B')
    await editor.getByLabel('Address').fill('Jl. Sudirman 1, Jakarta')
    await editor.getByRole('switch', { name: 'Optional session' }).check()
    await editor.locator('[data-action="save-item"]').click()
    await expect.poll(async () => (await getContent(page, inv.id)).events.map((e: Json) => [e.title, e.optional === true])).toEqual([
      ['Main Session', false],
      ['Afternoon workshop', true],
    ])
    await expect(page.getByTestId('session-optional')).toHaveCount(1)

    // RSVP builder: capacity, contact, session choice, a required select question.
    await openSection(page, inv.id, 'rsvp')
    await expect(page.locator('#f-collectContact')).toHaveValue('email')
    await expect(page.locator('#f-registrationFields-0-label')).toHaveValue('Company')
    await page.locator('#f-capacity').fill('0')
    await expect(page.locator('#f-capacity')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('#f-capacity').fill('120')
    await page.locator('#f-collectContact').selectOption('email_or_phone')
    await page.getByRole('switch', { name: 'Let guests choose sessions' }).check()
    await page.locator('[data-action="add-registration-field"]').click()
    await page.locator('#f-registrationFields-1-label').fill('Meal preference')
    await page.locator('#f-registrationFields-1-type').selectOption('select')
    const options = page.getByTestId('options-1')
    if ((await options.locator('#f-registrationFields-1-options-0').count()) === 0) await options.locator('[data-action="add-option"]').click()
    await page.locator('#f-registrationFields-1-options-0').fill('Vegetarian')
    await options.locator('[data-action="add-option"]').click()
    await page.locator('#f-registrationFields-1-options-1').fill('Regular')
    await page.getByRole('switch', { name: /required/i }).nth(1).check()
    await expectSaved(page)
    await expect
      .poll(async () => (await getContent(page, inv.id)).rsvp)
      .toMatchObject({
        capacity: 120,
        collectContact: 'email_or_phone',
        allowSessionChoice: true,
        registrationFields: [
          expect.objectContaining({ id: 'company', label: 'Company' }),
          expect.objectContaining({ label: 'Meal preference', type: 'select', required: true, options: ['Vegetarian', 'Regular'] }),
        ],
      })
  })
})

// =====================================================================================
test.describe('Templates and settings', () => {
  test('API refuses incompatible templates (create + patch); the UI never offers them', async ({ page, freshUser }) => {
    void freshUser
    const bad = await page.request.post(`${API}/invitations`, { data: { category: 'corporate', variant: 'seminar', themeId: 'temuvibe-festive' } })
    expect(bad.status()).toBe(422)
    const body = await bad.json()
    expect(body.error.code).toBe('template_incompatible')
    expect(body.error.details[0].field).toBe('themeId')
    const legacy = await page.request.post(`${API}/invitations`, { data: { category: 'celebration', variant: 'birthday', themeId: 'afterglow' } })
    expect((await legacy.json()).error.code).toBe('template_incompatible')
    const pair = await page.request.post(`${API}/invitations`, { data: { category: 'corporate', variant: 'birthday' } })
    expect(pair.status(), 'invalid category/variant pair').toBe(422)

    const inv = await createInvitation(page, 'seminar', { themeId: 'temuvibe-corporate' })
    const patch = await page.request.patch(`${API}/invitations/${inv.id}`, { data: { themeId: 'temuvibe-festive' } })
    expect(patch.status()).toBe(422)
    expect((await patch.json()).error.code).toBe('template_incompatible')
    const immut = await page.request.patch(`${API}/invitations/${inv.id}`, { data: { variant: 'workshop' } })
    expect(immut.status(), 'variant is immutable').toBe(422)

    await openSection(page, inv.id, 'settings')
    const options = await page.locator('#st-themeId option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))
    expect(options.slice().sort()).toEqual(await compatibleIds(page, 'seminar'))
  })

  test('settings page saves title, timezone and template', async ({ page, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'birthday', { themeId: 'temuvibe-elegant', title: 'Before' })
    await openSection(page, inv.id, 'settings')
    await expect(page.getByTestId('settings-page')).toContainText('Birthday')
    await page.locator('#st-title').fill('After rename')
    const patched = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/invitations/${inv.id}`))
    await page.locator('[data-action="save-title"]').click()
    expect((await patched).ok()).toBe(true)
    // The page re-syncs the field from the store when the save lands; wait for that before typing again.
    await expect(page.locator('[data-action="save-title"]')).not.toHaveAttribute('aria-busy', 'true')
    await expect.poll(async () => (await getInvitation(page, inv.id)).title).toBe('After rename')
    await page.locator('#st-title').fill('x'.repeat(121))
    await expect(page.locator('#st-title')).toHaveAttribute('aria-invalid', 'true')
    await page.locator('[data-action="save-title"]').click()
    expect((await getInvitation(page, inv.id)).title).toBe('After rename')

    await page.locator('#st-timezone').selectOption('Asia/Makassar')
    await expect.poll(async () => (await getInvitation(page, inv.id)).timezone).toBe('Asia/Makassar')
    await page.locator('#st-themeId').selectOption('temuvibe-festive')
    await expect.poll(async () => (await getInvitation(page, inv.id)).themeId).toBe('temuvibe-festive')
    await expect(page.getByTestId('live-preview')).toHaveAttribute('data-theme-id', 'temuvibe-festive')
    const zone = await page.request.patch(`${API}/invitations/${inv.id}`, { data: { timezone: 'Mars/Olympus' } })
    expect(zone.status()).toBe(422)
  })
})

// =====================================================================================
test.describe('Draft / publish lifecycle', () => {
  // sweet_17 covers a numeric milestone (BUG-1 regression).
  for (const variant of ['wedding_ceremony', 'graduation', 'sweet_17', 'family_gathering', 'seminar']) {
    test(`${variant}: blocked until complete, publish, unpublished changes, unpublish → 404`, async ({ page, browser, freshUser }) => {
      void freshUser
      const inv = await createInvitation(page, variant, { themeId: variant === 'seminar' ? 'temuvibe-corporate' : 'temuvibe-elegant' })
      const blocked = await page.request.post(`${API}/invitations/${inv.id}/publish`)
      expect(blocked.status()).toBe(422)
      const details = (await blocked.json()).error.details as Json[]
      expect(details.map((d) => d.field)).toContain('opening.weddingDate')
      expect(details.map((d) => d.field)).toContain('closing.message')
      if (offers(variant, 'profiles')) expect(details.map((d) => d.section)).toContain('profiles')
      if (offers(variant, 'organization')) expect(details.map((d) => d.field)).toContain('organization.name')

      await seedPublishable(page, inv)
      await openSection(page, inv.id, 'publish')
      await expect(page.getByTestId('publish-status')).toBeVisible()
      await page.getByTestId('publish-page').locator('[data-action="publish"]').click()
      await expect.poll(async () => (await getInvitation(page, inv.id)).status).toBe('published')
      const pub = await getInvitation(page, inv.id)
      expect(pub.hasUnpublishedChanges).toBe(false)
      await expect(page.getByTestId('public-url')).toHaveValue(new RegExp(`/i/${pub.slug}$`))
      const { context, page: guest } = await guestPage(browser)
      await openPublic(guest, pub.slug!)
      await expect(guest.getByTestId('public-invitation')).toContainText(`${marker(variant)} closing message`)

      // Edit after publishing: the guest still sees the published version.
      await putSection(page, inv.id, 'closing', { message: 'Updated but not republished' })
      await expect.poll(async () => (await getInvitation(page, inv.id)).hasUnpublishedChanges).toBe(true)
      await page.reload()
      await expect(page.getByTestId('publish-chip').first()).toHaveAttribute('data-state', /unpublished|changes/)
      await guest.reload()
      await expect(guest.getByTestId('public-invitation')).toContainText(`${marker(variant)} closing message`)
      await expect(guest.getByTestId('public-invitation')).not.toContainText('Updated but not republished')

      await page.getByTestId('publish-page').locator('[data-action="unpublish"]').click()
      const confirm = page.getByTestId('confirm-dialog').filter({ visible: true })
      if (await confirm.count()) await confirm.getByRole('button', { name: /unpublish/i }).click()
      await expect.poll(async () => (await getInvitation(page, inv.id)).status).toBe('draft')
      expect((await getPublic(pub.slug!)).status()).toBe(404)
      await guest.reload()
      await expect(guest.getByTestId('public-not-found')).toBeVisible()
      await context.close()
    })
  }
})

// Regression tests for product bugs found by QA (both fixed).
test.describe('Known product bugs', () => {
  // BUG-1: features/wedding/publishChecks.ts `has()` calls .trim() on milestone values; a numeric
  // `age`/`years` throws "value.trim is not a function" and the Preview & Publish page renders blank.
  // Hits every birthday/sweet_17 (sweet_17 is seeded with age 17) and anniversary with years set.
  test('BUG-1 (fixed): the publish page works for a birthday with an age (numeric milestone)', async ({ page, freshUser }) => {
    void freshUser
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const variant of ['sweet_17', 'anniversary']) {
      const inv = await createInvitation(page, variant)
      if (variant === 'anniversary') await putSection(page, inv.id, 'milestone', { enabled: true, years: 25 })
      await openSection(page, inv.id, 'publish')
      await expect(page.getByTestId('publish-page')).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  // BUG-2: RSVP is on by default for 15 variants but seeded without a heading. The public renderer
  // (features/wedding/draft.ts: no title → rsvpEnabled = false in public mode) then drops the RSVP
  // form, while the backend publishes and the publish checklist (completeness.ts treats
  // {enabled:true} as "not started") shows no warning. Guests silently get no RSVP form.
  test('BUG-2 (fixed): an RSVP that is on (no heading typed) is shown to guests, or publishing warns', async ({ page, browser, freshUser }) => {
    void freshUser
    const inv = await createInvitation(page, 'graduation', { themeId: 'temuvibe-minimal' })
    await seedPublishable(page, inv)
    await putSection(page, inv.id, 'rsvp', { enabled: true }) // the seeded default: on, no title
    await openSection(page, inv.id, 'publish')
    const warned = await page.getByTestId('publish-warnings').filter({ hasText: /RSVP/ }).count()
    const pub = await publish(page, inv.id)
    const { context, page: guest } = await guestPage(browser)
    await openPublic(guest, pub.slug!)
    const shown = await guest.getByTestId('rsvp-live').count()
    await context.close()
    expect(shown > 0 || warned > 0, 'RSVP silently missing on the public page with no warning').toBe(true)
  })
})

// =====================================================================================
test.describe('Public rendering', () => {
  const PER_CATEGORY: Array<[string, string[]]> = [
    ['wedding_reception', ['temuvibe-elegant', 'temuvibe-minimal']],
    ['birthday', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive']],
    ['family_reunion', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive', 'temuvibe-corporate']],
    ['workshop', ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-corporate']],
  ]
  for (const [variant, presets] of PER_CATEGORY) {
    test(`${variant} on ${presets.join(', ')}: offered sections only, canonical order, no placeholders, fits 375/320px`, async ({ page, browser, freshUser }) => {
      void freshUser
      test.slow()
      const pub = await publishedInvitation(page, variant, { themeId: presets[0], locale: 'en', rsvp: { enabled: true } })
      // Switch an offered section off and keep its content: it must not render.
      if (offers(variant, 'milestone')) await putSection(page, pub.id, 'milestone', { enabled: false, age: 9, partyTheme: 'HIDDEN-THEME' })
      if (offers(variant, 'agenda') && !offers(variant, 'speakers')) await putSection(page, pub.id, 'agenda', { enabled: false, items: [{ title: 'HIDDEN-AGENDA' }] })
      // Values of a section the variant doesn't offer can't even be written; see "Variant editing".
      await publish(page, pub.id)
      const offered = new Set(variantDef(variant).sections.map((s) => s.id))
      for (const preset of presets) {
        const patch = await page.request.patch(`${API}/invitations/${pub.id}`, { data: { themeId: preset } })
        expect(patch.ok(), `${preset}: ${await patch.text()}`).toBe(true)
        await publish(page, pub.id)
        const { context, page: guest, errors } = await guestPage(browser)
        await openPublic(guest, pub.slug!, '?to=Budi%20Santoso')
        await expect(guest.locator('article.t-tv')).toHaveAttribute('data-variant', preset)
        const rendered = await renderedSections(guest)
        for (const s of rendered) expect(offered.has(s), `${variant}/${preset}: ${s} is not offered`).toBe(true)
        const order = REGISTRY.sectionOrder
        expect(rendered.map((s) => order.indexOf(s)), `${variant}/${preset}: canonical order ${rendered}`).toEqual(rendered.map((s) => order.indexOf(s)).slice().sort((a, b) => a - b))
        for (const must of ['opening', 'events', 'closing', 'rsvp']) expect(rendered, `${variant}/${preset}`).toContain(must)
        if (offers(variant, 'couple')) expect(rendered).toContain('couple')
        if (offers(variant, 'profiles')) expect(rendered).toContain('profiles')
        if (offers(variant, 'organization')) expect(rendered).toContain('organization')
        if (offers(variant, 'speakers')) expect(rendered).toContain('speakers')
        expect(rendered).not.toContain('milestone')
        if (offers(variant, 'agenda') && !offers(variant, 'speakers')) expect(rendered).not.toContain('agenda')
        const site = guest.getByTestId('public-invitation')
        const text = await site.innerText()
        for (const p of PLACEHOLDERS) expect(text, `${variant}/${preset}: placeholder “${p}”`).not.toContain(p)
        expect(text).not.toContain('HIDDEN-')
        expect(text).toContain(`${marker(variant)} closing message`)
        await expect(site.locator('[data-editor-only]')).toHaveCount(0)
        await expect(site.locator('[data-sample]')).toHaveCount(0)
        // ?to= personalisation: greeting + RSVP name prefill.
        await expect(site).toContainText('Budi Santoso')
        await expect(site.getByTestId('rsvp-form').locator('input[name="name"]')).toHaveValue('Budi Santoso')
        for (const width of [375, 320]) {
          await guest.setViewportSize({ width, height: 800 })
          await expect.poll(() => horizontalOverflow(guest), `${variant}/${preset} @${width}px overflow`).toBeLessThanOrEqual(0)
        }
        expect(errors, `${variant}/${preset}: page errors`).toEqual([])
        await context.close()
      }
    })
  }

  test('a ?to= value is treated as text, never markup', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive' })
    const { context, page: guest, errors } = await guestPage(browser)
    let dialog = false
    guest.on('dialog', async (d) => {
      dialog = true
      await d.dismiss()
    })
    await openPublic(guest, pub.slug!, `?to=${encodeURIComponent('<img src=x onerror=alert(1)>Budi')}`)
    await expect(guest.getByTestId('public-invitation').locator('img[src="x"]')).toHaveCount(0)
    expect(dialog).toBe(false)
    expect(errors).toEqual([])
    await context.close()
  })
})

// =====================================================================================
test.describe('RSVP', () => {
  // Public RSVP posts share a 10/min/IP server window across parallel workers (see postRsvp).
  test.describe.configure({ timeout: 300_000 })
  test('a guest replies on a temuvibe template; the owner sees it, exports CSV and deletes it', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'family_gathering', { themeId: 'temuvibe-festive', rsvp: { collectContact: 'phone', confirmationMessage: 'See you at the reunion!' } })
    const { context, page: guest, errors } = await guestPage(browser)
    await openPublic(guest, pub.slug!, '?to=Keluarga%20Wijaya')
    const form = guest.getByTestId('rsvp-form')
    // Client-side validation: name + attendance + phone required.
    await form.locator('input[name="name"]').fill('')
    await form.locator('[data-action="rsvp-submit"]').click()
    const summary = guest.getByTestId('rsvp-error-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toBeFocused()
    await expect(summary.locator('li')).toHaveCount(3)
    await form.locator('input[name="name"]').fill('Keluarga Wijaya')
    await form.locator('input[value="attending"]').check()
    await expect(form.locator('select[name="partySize"] option')).toHaveCount(10)
    await form.locator('select[name="partySize"]').selectOption('4')
    await form.locator('input[name="phone"]').fill('not a phone')
    await form.locator('[data-action="rsvp-submit"]').click()
    await expect(form.locator('input[name="phone"]')).toHaveAttribute('aria-invalid', 'true')
    await form.locator('input[name="phone"]').fill('+62 812-3456-7890')
    await form.locator('textarea[name="message"]').fill('=1+1 we will bring snacks')
    await form.locator('[data-action="rsvp-submit"]').click()
    const success = guest.getByTestId('rsvp-success')
    await expect(success).toBeVisible()
    await expect(success).toContainText('See you at the reunion!')
    await expect(success).toBeFocused()
    expect(errors).toEqual([])
    expect((await context.cookies()).length, 'no cookies set on guests').toBe(0)
    await context.close()

    const second = await postRsvp(pub.slug!, { name: 'Pak Darmo', attendance: 'not_attending', phone: '0812 1111 2222' })
    expect(second.status).toBe(201)
    expect(second.json.partySize).toBe(0)

    // Owner: summary counts, table, CSV, delete.
    await page.goto(`/invitations/${pub.id}/responses`)
    const s = page.getByTestId('responses-summary')
    await expect(s.locator('[data-summary="responses"] dd')).toHaveText('2')
    await expect(s.locator('[data-summary="attending"] dd')).toHaveText('1')
    await expect(s.locator('[data-summary="notAttending"] dd')).toHaveText('1')
    await expect(s.locator('[data-summary="attendingPeople"] dd')).toHaveText('4')
    const row = page.getByTestId('responses-table').locator('tr', { hasText: 'Keluarga Wijaya' })
    await expect(row).toContainText('+62 812-3456-7890')
    await expect(row).toContainText('Keluarga Wijaya') // guest label from ?to=

    const download = page.waitForEvent('download')
    await page.locator('[data-action="export-csv"]').click()
    const file = await download
    expect(file.suggestedFilename()).toBe(`rsvp-${pub.slug}.csv`)
    const csv = (await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses.csv`)).text()).replace(/^﻿/, '')
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('Submitted at,Updated at,Possible duplicate,Name,Attendance,Party size,Email,Phone,Sessions,Guest label,Message')
    expect(csv).toContain("'=1+1 we will bring snacks")
    expect(csv).not.toMatch(/,=1\+1/)
    expect(csv).toContain("'+62 812-3456-7890")

    await row.locator('[data-action="delete-response"]').click()
    await page.getByTestId('confirm-dialog').filter({ hasText: 'Keluarga Wijaya' }).getByRole('button', { name: 'Delete' }).click()
    await expect(s.locator('[data-summary="responses"] dd')).toHaveText('1')
    const list = await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()
    expect(list.items.map((r: Json) => r.name)).toEqual(['Pak Darmo'])
    expect(list.summary).toMatchObject({ responses: 1, attending: 0, notAttending: 1, attendingPeople: 0 })
  })

  test('formula cells are escaped in the CSV (=1+1 → \'=1+1)', async ({ page, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive' })
    expect((await postRsvp(pub.slug!, { name: '=1+1', attendance: 'attending', partySize: 1, message: '@SUM(A1)' })).status).toBe(201)
    const csv = await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses.csv`)).text()
    const row = csv.split(/\r?\n/).find((l) => l.includes('1+1'))!
    expect(row.split(',')[3]).toBe("'=1+1") // after Submitted at, Updated at, Possible duplicate
    expect(row).toContain("'@SUM(A1)")
  })

  test('seminar registration: contact, questions, session choice and server-side validation', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'seminar', {
      themeId: 'temuvibe-corporate',
      extraSessions: [{ type: 'workshop', title: 'Hands-on lab', optional: true }],
      rsvp: {
        allowSessionChoice: true,
        registrationFields: [
          { id: 'company', label: 'Company', type: 'text', required: true },
          { id: 'meal', label: 'Meal', type: 'select', required: true, options: ['Vegetarian', 'Regular'] },
          { id: 'consent', label: 'I agree to be photographed', type: 'checkbox', required: true },
        ],
      },
    })
    const c = await getContent(page, pub.id)
    const optional = c.events.find((e: Json) => e.optional)
    const main = c.events.find((e: Json) => !e.optional)

    // Server-side validation (published snapshot is the source of truth).
    const base = { name: 'Rina', attendance: 'attending', partySize: 1, email: 'rina@example.com', answers: { company: 'ACME', meal: 'Regular', consent: true } }
    const noEmail = await postRsvp(pub.slug!, { ...base, email: undefined })
    expect(noEmail.status).toBe(422)
    expect(JSON.stringify(noEmail.json.error.details)).toContain('email')
    const badSelect = await postRsvp(pub.slug!, { ...base, answers: { ...base.answers, meal: 'Pizza' } })
    expect(badSelect.status).toBe(422)
    expect(JSON.stringify(badSelect.json.error.details)).toContain('answers.meal')
    const notOptional = await postRsvp(pub.slug!, { ...base, sessionIds: [main.id] })
    expect(notOptional.status, 'a non-optional session cannot be chosen').toBe(422)
    const unknownKey = await postRsvp(pub.slug!, { ...base, answers: { ...base.answers, hacker: 'x' } })
    expect(unknownKey.status).toBe(422)

    // The guest form in the browser.
    const { context, page: guest, errors } = await guestPage(browser)
    await openPublic(guest, pub.slug!)
    const form = guest.getByTestId('rsvp-form')
    await form.locator('input[name="name"]').fill('Andi Wijaya')
    await form.locator('input[value="attending"]').check()
    await form.locator('[data-action="rsvp-submit"]').click()
    await expect(guest.getByTestId('rsvp-error-summary')).toBeVisible()
    await expect(guest.getByTestId('rsvp-error-summary').locator('li')).toHaveCount(4) // email, company, meal, consent
    await form.locator('input[name="email"]').fill('andi@example.com')
    await form.getByLabel(/^Company/).fill('PT Maju')
    await form.getByLabel(/^Meal/).selectOption('Vegetarian')
    await form.getByLabel(/I agree to be photographed/).check()
    await form.getByTestId('rsvp-sessions').getByLabel('Hands-on lab').check()
    await form.locator('[data-action="rsvp-submit"]').click()
    await expect(guest.getByTestId('rsvp-success')).toBeVisible()
    expect(errors).toEqual([])
    await context.close()

    const replies = await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()
    expect(replies.items).toHaveLength(1)
    expect(replies.items[0]).toMatchObject({ name: 'Andi Wijaya', email: 'andi@example.com', sessionIds: [optional.id], answers: { company: 'PT Maju', meal: 'Vegetarian', consent: true } })
    expect(replies.items[0].phone, 'phone not requested → not stored').toBeUndefined()
    await page.goto(`/invitations/${pub.id}/responses`)
    await expect(page.getByTestId('responses-table')).toContainText('Hands-on lab')
    await expect(page.getByTestId('responses-table')).toContainText('Meal: Vegetarian')
  })

  test('party size limit, capacity reached (409) and the full state', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive', rsvp: { capacity: 3, maxGuestsPerResponse: 2 } })
    const tooMany = await postRsvp(pub.slug!, { name: 'Big family', attendance: 'attending', partySize: 3 })
    expect(tooMany.status).toBe(422)
    expect(JSON.stringify(tooMany.json.error.details)).toContain('partySize')
    expect((await postRsvp(pub.slug!, { name: 'First', attendance: 'attending', partySize: 2 })).status).toBe(201)

    // The guest's page was loaded while 1 seat remained; asking for 2 hits the 409.
    const { context, page: guest } = await guestPage(browser)
    await openPublic(guest, pub.slug!)
    const form = guest.getByTestId('rsvp-form')
    await form.locator('input[name="name"]').fill('Second')
    await form.locator('input[value="attending"]').check()
    await form.locator('select[name="partySize"]').selectOption('2')
    const resp = guest.waitForResponse((r) => r.url().includes(`/public/invitations/${pub.slug}/rsvp`))
    await form.locator('[data-action="rsvp-submit"]').click()
    expect((await resp).status()).toBe(409)
    await expect(guest.getByTestId('rsvp-closed').or(guest.getByTestId('rsvp-banner'))).toBeVisible()

    expect((await postRsvp(pub.slug!, { name: 'Third', attendance: 'attending', partySize: 1 })).status).toBe(201)
    const full = await postRsvp(pub.slug!, { name: 'Fourth', attendance: 'attending', partySize: 1 })
    expect(full.status).toBe(409)
    expect(full.json.error.code).toBe('capacity_reached')
    // Not attending is still accepted when full.
    expect((await postRsvp(pub.slug!, { name: 'Regrets', attendance: 'not_attending' })).status).toBe(201)
    const snap = await (await getPublic(pub.slug!)).json()
    expect(snap.content.rsvp).toMatchObject({ capacity: 3, full: true })
    expect(JSON.stringify(snap), 'replies never in the snapshot').not.toContain('First')
    await guest.reload()
    await expect(guest.getByTestId('rsvp-closed')).toHaveAttribute('data-state', 'full')
    await context.close()
    const summary = (await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()).summary
    expect(summary).toMatchObject({ responses: 3, attending: 2, notAttending: 1, attendingPeople: 3, capacity: 3 })
  })

  test('a past deadline closes the RSVP (form shows closed; API 422 rsvp_closed)', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'graduation', { themeId: 'temuvibe-minimal', rsvp: { deadline: '2026-01-01' } })
    const closed = await postRsvp(pub.slug!, { name: 'Late', attendance: 'attending', partySize: 1 })
    expect(closed.status).toBe(422)
    expect(closed.json.error.code).toBe('rsvp_closed')
    const { context, page: guest } = await guestPage(browser)
    await openPublic(guest, pub.slug!)
    await expect(guest.getByTestId('rsvp-closed')).toHaveAttribute('data-state', 'closed')
    await expect(guest.getByTestId('rsvp-form')).toHaveCount(0)
    await context.close()
  })

  test('a guest replies on a legacy theme (black-tie)', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'wedding_ceremony', { themeId: 'black-tie', rsvp: { enabled: true } })
    const { context, page: guest, errors } = await guestPage(browser)
    await guest.goto(`/i/${pub.slug}`)
    const live = guest.getByTestId('rsvp-live')
    await expect(live).toBeVisible({ timeout: 20_000 })
    await live.locator('input[name="name"]').fill('Tamu Undangan')
    await live.locator('input[value="attending"]').check()
    await live.locator('select[name="partySize"]').selectOption('2')
    await live.locator('[data-action="rsvp-submit"]').click()
    await expect(guest.getByTestId('rsvp-success')).toBeVisible()
    expect(errors).toEqual([])
    await context.close()
    const list = await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()
    expect(list.items[0]).toMatchObject({ name: 'Tamu Undangan', partySize: 2, attendance: 'attending' })
  })

  test('security smoke: control characters → 422, honeypot invisible and decoy, oversize body 413', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive' })
    const nul = await postRsvpRaw(pub.slug!, '{"name":"Bo\\u0000b","attendance":"attending","partySize":1}')
    expect(nul.status).toBe(422)
    expect(nul.json.error.code).toBe('validation_error')
    const bell = await postRsvpRaw(pub.slug!, '{"name":"Ann","attendance":"attending","partySize":1,"message":"hi\\u0007"}')
    expect(bell.status).toBe(422)
    const extra = await postRsvp(pub.slug!, { name: 'Ann', attendance: 'attending', partySize: 1, isAdmin: true })
    expect(extra.status, 'unknown keys rejected').toBe(422)
    const honey = await postRsvp(pub.slug!, { name: 'Bot', attendance: 'attending', partySize: 1, website: 'http://spam.example' })
    expect(honey.status, 'honeypot gets a decoy 201').toBe(201)
    const big = await postRsvp(pub.slug!, { name: 'Big', attendance: 'attending', partySize: 1, message: 'x'.repeat(17 * 1024) })
    expect(big.status).toBe(413)
    const stored = await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()
    expect(stored.total, 'nothing stored by the bot or the invalid posts').toBe(0)

    const { context, page: guest } = await guestPage(browser)
    await openPublic(guest, pub.slug!)
    const hp = guest.locator('[data-honeypot]')
    await expect(hp).toHaveAttribute('aria-hidden', 'true')
    await expect(hp.locator('input')).toHaveAttribute('tabindex', '-1')
    await expect(hp.locator('input')).toHaveAttribute('autocomplete', 'off')
    const box = await hp.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { w: r.width, h: r.height, left: r.left, top: r.top, clip: cs.clip, clipPath: cs.clipPath, opacity: cs.opacity, display: cs.display, visibility: cs.visibility }
    })
    const invisible = box.display === 'none' || box.visibility === 'hidden' || box.w <= 1 || box.h <= 1 || box.left < -1000 || box.top < -1000 || box.opacity === '0' || /rect\(0/.test(box.clip) || /inset\(50%/.test(box.clipPath)
    expect(invisible, `honeypot must not be visible: ${JSON.stringify(box)}`).toBe(true)
    // Keyboard users never land on it.
    await guest.getByTestId('rsvp-form').locator('textarea[name="message"]').focus()
    await guest.keyboard.press('Tab')
    expect(await guest.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).not.toBe('website')
    await context.close()
  })
})

// =====================================================================================
test.describe('Backward compatibility', () => {
  test('a pre-engine wedding opens in the new editor, renders on its theme, publishes, and /wedding/* redirects', async ({ page, browser, freshUser }) => {
    void freshUser
    const created = await page.request.post(`${API}/weddings`, { data: { themeId: 'gilded-vow', locale: 'id' } })
    expect(created.status()).toBe(201)
    const w = await created.json()
    expect(w).toMatchObject({ category: 'wedding', variant: 'wedding_ceremony', themeId: 'gilded-vow' })
    const legacyPut = (section: string, data: Json) => page.request.put(`${API}/weddings/${w.id}/sections/${section}`, { data })
    expect((await legacyPut('opening', { weddingTitle: 'Pernikahan Dimas & Ayu', weddingDate: '2027-09-04', coupleNames: 'Dimas & Ayu' })).ok()).toBe(true)
    expect((await legacyPut('couple', { groom: { name: 'Dimas Pratama' }, bride: { name: 'Ayu Lestari' } })).ok()).toBe(true)
    expect((await legacyPut('closing', { message: 'Terima kasih atas doa restu Anda.' })).ok()).toBe(true)
    expect((await legacyPut('rsvp', { enabled: true, title: 'Konfirmasi Kehadiran' })).ok()).toBe(true)
    const ev = await page.request.post(`${API}/weddings/${w.id}/events`, {
      data: { type: 'akad', title: 'Akad Nikah', date: '2027-09-04', startTime: '08:00', venueName: 'Masjid Agung', address: 'Jl. Alun-alun 1' },
    })
    expect(ev.status()).toBe(201)
    expect((await (await page.request.get(`${API}/weddings/me`)).json()).id).toBe(w.id)

    // Legacy URLs redirect into the new editor (query kept).
    await page.goto('/wedding/opening')
    await expect(page).toHaveURL(new RegExp(`/invitations/${w.id}/edit/opening$`))
    await expect(page.getByTestId('opening-form')).toBeVisible()
    await expect(page.locator('#f-weddingTitle')).toHaveValue('Pernikahan Dimas & Ayu')
    await page.goto('/wedding/events?x=1')
    await expect(page).toHaveURL(new RegExp(`/invitations/${w.id}/edit/events\\?x=1$`))
    await page.goto('/wedding/preview')
    await expect(page).toHaveURL(new RegExp(`/invitations/${w.id}/preview`))
    const preview = page.locator('.wedding-site[data-theme="gilded-vow"]').first()
    await expect(preview).toBeVisible({ timeout: 20_000 })
    for (const t of ['Dimas', 'Ayu', 'Akad Nikah', 'Masjid Agung', 'Terima kasih atas doa restu Anda.']) await expect(preview, 'preview shows the legacy content').toContainText(t)

    const published = await page.request.post(`${API}/weddings/${w.id}/publish`)
    expect(published.ok(), await published.text()).toBe(true)
    const { slug } = await published.json()
    expect(slug).toMatch(/^dimas-ayu-[a-z0-9]{6}$/)
    const legacyPublic = await (await getPublic(slug)).json()
    expect(legacyPublic).toMatchObject({ category: 'wedding', variant: 'wedding_ceremony', themeId: 'gilded-vow' })
    const { context, page: guest, errors } = await guestPage(browser)
    await guest.goto(`/i/${slug}`)
    const site = guest.locator('.wedding-site[data-theme="gilded-vow"]').first()
    await expect(site).toBeVisible({ timeout: 20_000 })
    for (const t of ['Dimas', 'Ayu', 'Akad Nikah', 'Masjid Agung', 'Terima kasih atas doa restu Anda.']) await expect(site, 'public page shows the legacy content').toContainText(t)
    await expect(guest.getByTestId('rsvp-live')).toBeVisible()
    expect(errors).toEqual([])
    await context.close()
    expect((await page.request.get(`${API}/public/weddings/${slug}`)).status(), 'legacy public alias').toBe(200)
  })

  test('/wedding/* without a wedding invitation goes to the list', async ({ page, freshUser }) => {
    void freshUser
    await createInvitation(page, 'birthday')
    await page.goto('/wedding/opening')
    await expect(page).toHaveURL(/\/invitations$/)
  })
})

// =====================================================================================
test.describe('Authorization', () => {
  // Public RSVP posts share a 10/min/IP server window across parallel workers (see postRsvp).
  test.describe.configure({ timeout: 300_000 })
  test('a second user gets 404 on another user’s invitation pages and API, and never sees it in the list', async ({ page, browser, freshUser }) => {
    void freshUser
    const pub = await publishedInvitation(page, 'birthday', { themeId: 'temuvibe-festive', title: 'Owner only' })
    expect((await postRsvp(pub.slug!, { name: 'Private Guest', attendance: 'attending', partySize: 1 })).status).toBe(201)
    const replyId = (await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()).items[0].id

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const other = await ctx.newPage()
    const email = `intruder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
    const reg = await other.request.post(`${API}/auth/register`, { data: { email, password: `intruder-${Math.random().toString(36).slice(2)}-pass`, full_name: 'Intruder' } })
    expect(reg.ok()).toBe(true)
    await other.addInitScript((key) => localStorage.setItem(key, '1'), `kuren.welcomeSeen.${(await reg.json()).id}`)
    await createInvitation(other, 'seminar', { themeId: 'temuvibe-corporate', title: 'Intruder own' })

    const base = `${API}/invitations/${pub.id}`
    const probes: Array<[string, string, Json?]> = [
      ['GET', base],
      ['GET', `${base}/content`],
      ['GET', `${base}/preview`],
      ['GET', `${base}/sections/opening`],
      ['PUT', `${base}/sections/closing`, { message: 'pwned' }],
      ['PATCH', base, { title: 'pwned' }],
      ['POST', `${base}/publish`],
      ['POST', `${base}/unpublish`],
      ['GET', `${base}/rsvp-responses`],
      ['GET', `${base}/rsvp-responses.csv`],
      ['DELETE', `${base}/rsvp-responses/${replyId}`],
      ['DELETE', base],
      ['GET', `${API}/weddings/${pub.id}`],
      ['GET', `${API}/weddings/${pub.id}/rsvp-responses.csv`],
    ]
    for (const [method, url, data] of probes) {
      const res = await other.request.fetch(url, { method, data })
      expect(res.status(), `${method} ${url}`).toBe(404)
      expect(await res.text()).not.toContain('Private Guest')
    }
    const list = (await (await other.request.get(`${API}/invitations`)).json()).items
    expect(list.map((i: Json) => i.title)).toEqual(['Intruder own'])

    for (const path of [`/invitations/${pub.id}/edit/opening`, `/invitations/${pub.id}/responses`, `/invitations/${pub.id}/preview`]) {
      await other.goto(path)
      await expect(other.getByText(/Owner only|Private Guest/)).toHaveCount(0)
      await expect(other.getByTestId('editor-layout').getByTestId('opening-form')).toHaveCount(0)
    }
    await other.goto('/invitations')
    await expect(other.locator('[data-invitation]')).toHaveCount(1)
    await expect(other.locator(`[data-invitation="${pub.id}"]`)).toHaveCount(0)
    await ctx.close()

    // The owner's data is untouched.
    const mine = await getInvitation(page, pub.id)
    expect(mine).toMatchObject({ title: 'Owner only', status: 'published' })
    expect((await (await page.request.get(`${API}/invitations/${pub.id}/rsvp-responses`)).json()).total).toBe(1)
    expect((await getContent(page, pub.id)).closing.message).toBe(`${marker('birthday')} closing message`)
  })
})
