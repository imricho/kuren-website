/**
 * API seeding helpers for the invitation engine (docs/api/invitations.md).
 *
 * Setup goes through the API (fast, deterministic, parallel-safe); specs then drive the UI
 * only for the behaviour under test. Every helper works on the account whose session
 * cookie is on `page` (see `freshUser` in fixtures.ts).
 */
import { readFileSync } from 'node:fs'

import { expect, request, type APIRequestContext, type Page } from '@playwright/test'

export const API = '/api/v1'
/** The backend, reached directly (not through the Vite proxy): public RSVP posts made by the
 *  API-level tests use this so they count against a different per-IP rate-limit bucket than
 *  the RSVPs guests submit in the browser (which arrive through the proxy). */
export const BACKEND_URL = process.env.E2E_API_URL ?? 'http://localhost:8000'
export const APP_ORIGIN = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
export type CategoryId = 'wedding' | 'celebration' | 'gathering' | 'corporate'

export interface Registry {
  sectionOrder: string[]
  categories: Array<{ id: CategoryId; variants: string[] }>
  variants: Array<{
    id: string
    category: CategoryId
    label: { en: string; id: string }
    sections: Array<{ id: string; required?: boolean; defaultEnabled?: boolean; roles?: string[]; fields?: string[] }>
    sessionPresets: Array<{ type: string; title: { en: string; id: string } }>
    rsvpDefaults: Json
    milestoneDefaults?: Json
  }>
  templates: Array<{ id: string; categories: CategoryId[]; variants?: string[] }>
}

export const REGISTRY: Registry = JSON.parse(
  readFileSync(new URL('../../backend/app/core/invitation_registry.json', import.meta.url), 'utf8'),
)
export const SELECTABLE_THEME_IDS: string[] = JSON.parse(
  readFileSync(new URL('../src/features/themes/catalog/selectable-theme-ids.json', import.meta.url), 'utf8'),
)
export const TEMUVIBE = ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive', 'temuvibe-corporate'] as const

export const variantDef = (variant: string) => {
  const v = REGISTRY.variants.find((x) => x.id === variant)
  if (!v) throw new Error(`unknown variant ${variant}`)
  return v
}
export const categoryOf = (variant: string) => variantDef(variant).category
export const offers = (variant: string, section: string) => variantDef(variant).sections.some((s) => s.id === section)
export const sectionDef = (variant: string, section: string) => variantDef(variant).sections.find((s) => s.id === section)

/** Every template id the wizard may offer for a variant (temuvibe by category, legacy by variant). */
export function compatibleTemplateIds(variant: string, templates = REGISTRY.templates): string[] {
  const cat = categoryOf(variant)
  return templates.filter((t) => t.categories.includes(cat) && (!t.variants || t.variants.includes(variant))).map((t) => t.id)
}

export interface Invitation {
  id: string
  category: CategoryId
  variant: string
  title: string | null
  timezone: string
  themeId: string | null
  locale: 'en' | 'id'
  status: 'draft' | 'published'
  slug: string | null
  revision: number
  hasUnpublishedChanges: boolean
}

export async function createInvitation(
  page: Page,
  variant: string,
  opts: { themeId?: string | null; title?: string; locale?: 'en' | 'id'; timezone?: string } = {},
): Promise<Invitation> {
  const data: Json = { category: categoryOf(variant), variant, locale: opts.locale ?? 'en' }
  if (opts.themeId !== null) data.themeId = opts.themeId ?? 'temuvibe-elegant'
  if (opts.title) data.title = opts.title
  if (opts.timezone) data.timezone = opts.timezone
  const res = await page.request.post(`${API}/invitations`, { data })
  expect(res.status(), `POST /invitations ${variant}: ${await res.text()}`).toBe(201)
  return res.json()
}

export async function getInvitation(page: Page, id: string): Promise<Invitation> {
  const res = await page.request.get(`${API}/invitations/${id}`)
  expect(res.ok(), `GET /invitations/${id} → ${res.status()}`).toBe(true)
  return res.json()
}

export async function getContent(page: Page, id: string): Promise<Json> {
  const res = await page.request.get(`${API}/invitations/${id}/content`)
  expect(res.ok(), `GET content → ${res.status()}`).toBe(true)
  return res.json()
}

export async function putSection(page: Page, id: string, section: string, body: Json) {
  const res = await page.request.put(`${API}/invitations/${id}/sections/${section}`, { data: body })
  expect(res.ok(), `PUT sections/${section}: ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

export async function publish(page: Page, id: string): Promise<Invitation> {
  const res = await page.request.post(`${API}/invitations/${id}/publish`)
  expect(res.ok(), `publish: ${res.status()} ${await res.text()}`).toBe(true)
  return res.json()
}

/** A per-variant marker so public-page assertions can find the content they seeded. */
export const marker = (variant: string) => `Mk-${variant.replace(/_/g, '-')}`

export interface SeedOptions {
  date?: string
  rsvp?: Json
  /** Extra sessions to append (e.g. optional corporate sessions). */
  extraSessions?: Json[]
}

/**
 * Fills everything a variant needs to publish (every section it shows by default gets
 * real content), using a per-variant marker in visible text. Returns the content written.
 */
export async function seedPublishable(page: Page, inv: Invitation, opts: SeedOptions = {}) {
  const v = inv.variant
  const m = marker(v)
  const date = opts.date ?? '2027-06-12'
  await putSection(page, inv.id, 'opening', { weddingTitle: `${m} Title`, weddingDate: date, guestGreeting: { enabled: true, label: 'Dear' }, coupleNames: offers(v, 'couple') ? 'Raka & Sinta' : undefined })
  await putSection(page, inv.id, 'closing', { message: `${m} closing message` })
  if (offers(v, 'couple')) {
    await putSection(page, inv.id, 'couple', { groom: { name: 'Raka Pratama' }, bride: { name: 'Sinta Dewi' } })
  }
  const profiles = sectionDef(v, 'profiles')
  if (profiles?.defaultEnabled) {
    const role = profiles.roles![0]!
    const person: Json = { role, name: `${m} Person`, nickname: 'Nadia' }
    if (!profiles.fields?.includes('nickname')) delete person.nickname
    if (profiles.fields?.includes('parents')) person.parents = 'Bapak Ahmad & Ibu Siti'
    await putSection(page, inv.id, 'profiles', { enabled: true, people: [person] })
  }
  const milestone = sectionDef(v, 'milestone')
  if (milestone?.defaultEnabled) {
    const body: Json = { enabled: true }
    for (const f of milestone.fields ?? []) {
      if (f === 'age') body.age = 17
      else if (f === 'years') body.years = 25
      else body[f] = `${m} ${f}`
    }
    await putSection(page, inv.id, 'milestone', body)
  }
  if (sectionDef(v, 'organization')?.defaultEnabled) {
    await putSection(page, inv.id, 'organization', { enabled: true, name: `${m} Org`, tagline: 'Building together' })
  }
  if (sectionDef(v, 'speakers')?.defaultEnabled) {
    await putSection(page, inv.id, 'speakers', { enabled: true, people: [{ id: 'spk-1', name: `${m} Speaker`, role: 'Keynote' }] })
  }
  if (sectionDef(v, 'agenda')?.defaultEnabled) {
    await putSection(page, inv.id, 'agenda', {
      enabled: true,
      items: [{ time: '09:00', endTime: '10:00', title: `${m} Agenda`, ...(sectionDef(v, 'speakers')?.defaultEnabled ? { speakerIds: ['spk-1'] } : {}) }],
    })
  }
  // Sessions: fill the seeded presets (legacy POST /weddings seeds none → add one).
  const content = await getContent(page, inv.id)
  const where = { date, startTime: '10:00', endTime: '12:00', venueName: `${m} Venue`, address: 'Jl. Kenanga No. 3, Yogyakarta' }
  if (content.events.length === 0) {
    const res = await page.request.post(`${API}/invitations/${inv.id}/events`, { data: { type: 'reception', title: `${m} Session`, ...where } })
    expect(res.status(), await res.text()).toBe(201)
  }
  for (const [i, e] of (content.events as Json[]).entries()) {
    const res = await page.request.put(`${API}/invitations/${inv.id}/events/${e.id}`, { data: { ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== "id")), title: `${m} Session ${i + 1}`, ...where } })
    expect(res.ok(), await res.text()).toBe(true)
  }
  for (const s of opts.extraSessions ?? []) {
    const res = await page.request.post(`${API}/invitations/${inv.id}/events`, { data: { ...where, ...s } })
    expect(res.status(), await res.text()).toBe(201)
  }
  // An RSVP heading is what a real owner types; without one the public page drops the form
  // (see the test.fixme "RSVP without a heading" in invitations.spec.ts).
  const rsvp = (await getContent(page, inv.id)).rsvp
  if (rsvp.enabled || opts.rsvp) await putSection(page, inv.id, 'rsvp', { ...rsvp, title: `${m} RSVP`, ...(opts.rsvp ?? {}) })
  return getContent(page, inv.id)
}

/** Create + seed + publish in one go; returns the published record (with slug). */
export async function publishedInvitation(page: Page, variant: string, opts: SeedOptions & { themeId?: string; title?: string; locale?: 'en' | 'id' } = {}) {
  const inv = await createInvitation(page, variant, { themeId: opts.themeId, title: opts.title, locale: opts.locale })
  await seedPublishable(page, inv, opts)
  const pub = await publish(page, inv.id)
  expect(pub.slug).toBeTruthy()
  return pub
}

// --- Public RSVP (rate-limited: 10/min per client IP, fixed one-minute windows) -----------

let backend: APIRequestContext | undefined
async function backendContext() {
  backend ??= await request.newContext({ baseURL: BACKEND_URL, extraHTTPHeaders: { Origin: APP_ORIGIN } })
  return backend
}

/**
 * POST /public/invitations/{slug}/rsvp as an anonymous guest, straight to the backend.
 * A 429 means this process's fixed one-minute window is used up by parallel workers: the
 * server's window is the condition we wait on (polling until it accepts), never a fixed sleep.
 */
export async function postRsvp(slug: string, body: Json): Promise<{ status: number; json: Json }> {
  const ctx = await backendContext()
  let last: { status: number; json: Json } = { status: 0, json: {} }
  await expect
    .poll(
      async () => {
        // `Connection: close`: the server may drop the socket after rejecting a request (e.g. 413),
        // which must not break the next request on a reused keep-alive connection.
        const res = await ctx.post(`/api/v1/public/invitations/${slug}/rsvp`, { data: body, headers: { Connection: 'close' } }).catch(() => null)
        if (!res) return 'retry'
        last = { status: res.status(), json: await res.json().catch(() => ({})) }
        return last.status === 429 ? 'retry' : 'done'
      },
      { timeout: 180_000, intervals: [2_000, 5_000, 10_000], message: 'RSVP rate-limit window did not reopen' },
    )
    .toBe('done')
  return last
}

/** A raw body (e.g. with a NUL escape) to the RSVP endpoint, same rate-limit handling. */
export async function postRsvpRaw(slug: string, raw: string): Promise<{ status: number; json: Json }> {
  const ctx = await backendContext()
  let last: { status: number; json: Json } = { status: 0, json: {} }
  await expect
    .poll(
      async () => {
        const res = await ctx
          .post(`/api/v1/public/invitations/${slug}/rsvp`, { data: raw, headers: { 'content-type': 'application/json', Connection: 'close' } })
          .catch(() => null)
        if (!res) return 'retry'
        last = { status: res.status(), json: await res.json().catch(() => ({})) }
        return last.status === 429 ? 'retry' : 'done'
      },
      { timeout: 180_000, intervals: [2_000, 5_000, 10_000] },
    )
    .toBe('done')
  return last
}

export async function getPublic(slug: string) {
  const ctx = await backendContext()
  return ctx.get(`/api/v1/public/invitations/${slug}`)
}
