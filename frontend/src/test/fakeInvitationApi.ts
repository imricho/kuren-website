/**
 * In-memory stand-in for the Invitation API (docs/architecture/invitation-engine.md
 * §4), installed as a mocked `fetch`. Unit tests use it instead of the real backend.
 *
 * Holds any number of invitations (`options.invitations`, or the single default
 * wedding `w1`); `state` is a view of the PRIMARY one (the first) so single-invitation
 * tests stay short, `invitation(id)` reaches any of them.
 *
 * Emulates optimistic concurrency per invitation: content GETs and writes answer
 * with `ETag: "<revision>"`; writes with a stale `If-Match` get 409 `edit_conflict`
 * (`details.currentRevision`) and change nothing; successful content writes bump
 * the revision. `editElsewhere()` simulates a save from another device.
 */
import { vi, type MockInstance } from 'vitest'

import type { InvitationRead, InvitationSummary, RsvpResponse } from '@/api/invitations'
import { variantOf, type CategoryId, type VariantId } from '@/features/invitation/registry'
import { emptyDraft, normalizeDraft, type WeddingDraft } from '@/features/wedding/draft'

export interface FakeCall {
  method: string
  path: string
  body: unknown
  /** Raw `If-Match` request header, if sent. */
  ifMatch?: string
}

export interface FakeFailure {
  /** HTTP status; 0 = network failure (fetch rejects with a TypeError). */
  status: number
  code?: string
  message?: string
  details?: { field: string; message: string }[]
}

export interface FakeInvitationSeed {
  id: string
  variant?: VariantId
  title?: string | null
  themeId?: string | null
  content?: Partial<WeddingDraft>
  revision?: number
  /** ISO timestamp; the list is newest-updated first. */
  updatedAt?: string
}

export interface FakeApiOptions {
  /** Start with the default wedding `w1` (default true). Ignored when `invitations` is given. */
  hasWedding?: boolean
  themeId?: string | null
  content?: Partial<WeddingDraft>
  /** Initial content revision (default 1). */
  revision?: number
  /** Variant of the default invitation `w1` (default wedding_ceremony). */
  variant?: VariantId
  /** Several invitations (the first is the primary one `state` refers to). */
  invitations?: FakeInvitationSeed[]
}

interface Asset {
  id: string
  src: string
  width: number
  height: number
  kind: string
}

interface Publication {
  slug: string
  themeId: string | null
  revision: number
  publishedAt: string
  content: WeddingDraft
}

interface FakeInvitation {
  /** RSVP replies, newest first. */
  responses: RsvpResponse[]
  record: InvitationRead
  content: WeddingDraft
  revision: number
  assets: Asset[]
  publication: Publication | null
  slug: string | null
}

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
const error = (f: FakeFailure) =>
  json(f.status, { error: { code: f.code ?? 'error', message: f.message ?? 'Request failed', details: f.details } })

class NetworkFailure extends Error {}

function newRecord(seed: { id: string; variant?: VariantId; title?: string | null; themeId?: string | null; locale?: 'en' | 'id'; revision: number; updatedAt?: string }): InvitationRead {
  const variant = seed.variant ?? 'wedding_ceremony'
  return {
    id: seed.id,
    category: variantOf(variant).category,
    variant,
    title: seed.title ?? null,
    timezone: 'Asia/Jakarta',
    themeId: seed.themeId ?? null,
    locale: seed.locale ?? 'en',
    status: 'draft',
    publishedAt: null,
    revision: seed.revision,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: seed.updatedAt ?? '2026-01-01T00:00:00Z',
  }
}

function newInvitation(seed: FakeInvitationSeed): FakeInvitation {
  const content = normalizeDraft({ ...emptyDraft(), ...structuredClone(seed.content ?? {}) })
  const revision = seed.revision ?? 1
  return {
    record: newRecord({ ...seed, locale: content.locale, revision }),
    content,
    revision,
    responses: [],
    assets: [],
    publication: null,
    slug: null,
  }
}

export function installFakeInvitationApi(options: FakeApiOptions = {}) {
  let idSeq = 1
  let assetSeq = 1
  let createSeq = 1
  const seeds: FakeInvitationSeed[] =
    options.invitations ??
    (options.hasWedding === false ? [] : [{ id: 'w1', variant: options.variant, themeId: options.themeId ?? null, content: options.content, revision: options.revision }])
  const invitations = new Map<string, FakeInvitation>(seeds.map((seed) => [seed.id, newInvitation(seed)]))
  /** Id the `state` view refers to (the first invitation, or the first one created). */
  let primaryId: string | null = seeds[0]?.id ?? null
  const primary = () => (primaryId ? invitations.get(primaryId) ?? null : null)
  /** Content of a not-yet-created primary invitation (so `state.content` is always usable). */
  const pendingContent = normalizeDraft({ ...emptyDraft(), ...structuredClone(options.content ?? {}) })
  let offline = false

  const state = {
    get invitation(): InvitationRead | null {
      return primary()?.record ?? null
    },
    set invitation(value: InvitationRead | null) {
      const p = primary()
      if (p && value) p.record = value
    },
    get content(): WeddingDraft {
      return primary()?.content ?? pendingContent
    },
    get revision(): number {
      return primary()?.revision ?? options.revision ?? 1
    },
    get assets(): Asset[] {
      return primary()?.assets ?? []
    },
    /** While true, every request fails like a dropped connection. */
    get offline() {
      return offline
    },
    set offline(value: boolean) {
      offline = value
    },
  }

  const calls: FakeCall[] = []
  /** Failures keyed by "METHOD /path" (path without /api/v1), each with how many requests it still fails. */
  const failures = new Map<string, { failure: FakeFailure; remaining: number }>()
  /** Requests whose response is held until `release()` is called. */
  let hold: Promise<void> | null = null
  /** Next publish answers 422 publish_blocked with these details (once). */
  let blockNextPublish: { section: string; field: string; code: string; message: string }[] | null = null
  let nextCheckIssues: { section: string; field: string; code: string; message: string }[] | null = null
  let publishSeq = 0

  const lists = {
    stories: (inv: FakeInvitation) => inv.content.story.timeline,
    events: (inv: FakeInvitation) => inv.content.events,
    gallery: (inv: FakeInvitation) => inv.content.gallery.images,
  } as const
  const setList = (inv: FakeInvitation, name: keyof typeof lists, items: never[]) => {
    if (name === 'stories') inv.content.story.timeline = items
    else if (name === 'events') inv.content.events = items
    else inv.content.gallery.images = items
  }

  const etag = (inv: FakeInvitation) => ({ ETag: `"${inv.revision}"` })
  /** Content responses carry the revision. */
  const ok = (inv: FakeInvitation, status: number, body?: unknown) => json(status, body, etag(inv))
  /** null = the If-Match matches (or is absent/"*"); otherwise the error response. */
  function checkIfMatch(inv: FakeInvitation, ifMatch: string | undefined): Response | null {
    if (ifMatch === undefined || ifMatch.trim() === '*') return null
    const m = ifMatch.trim().match(/^(?:W\/)?"?(\d+)"?$/)
    if (!m) return error({ status: 400, code: 'bad_request', message: 'Malformed If-Match' })
    if (Number(m[1]) === inv.revision) return null
    return json(409, { error: { code: 'edit_conflict', message: 'Edited elsewhere', details: { currentRevision: inv.revision } } }, etag(inv))
  }
  const bump = (inv: FakeInvitation) => {
    inv.revision++
    inv.record = { ...inv.record, revision: inv.revision }
  }

  const withPublication = (inv: FakeInvitation): InvitationRead => {
    const r = inv.record
    const live = inv.publication
    return {
      ...r,
      status: live ? 'published' : 'draft',
      publishedAt: live ? live.publishedAt : null,
      slug: inv.slug,
      publication: live ? { publishedAt: live.publishedAt, revision: live.revision, themeId: live.themeId, category: r.category, variant: r.variant } : null,
      hasUnpublishedChanges: !!live && (live.revision !== inv.revision || live.themeId !== r.themeId),
    }
  }

  const summary = (inv: FakeInvitation): InvitationSummary => {
    const r = withPublication(inv)
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      variant: r.variant,
      themeId: r.themeId,
      status: r.status,
      slug: r.slug ?? null,
      hasUnpublishedChanges: r.hasUnpublishedChanges === true,
      eventDate: inv.content.opening.weddingDate ?? null,
      updatedAt: r.updatedAt,
      publishedAt: r.publishedAt,
    }
  }

  function handlePublic(method: string, path: string): Response | null {
    const pub = path.match(/^\/public\/invitations\/([^/]+)$/)
    if (!pub || method !== 'GET') return null
    const slug = decodeURIComponent(pub[1]!)
    const inv = [...invitations.values()].find((i) => i.publication?.slug === slug)
    if (!inv?.publication) return error({ status: 404, code: 'not_found', message: 'Not found' })
    const p = inv.publication
    return json(
      200,
      { category: inv.record.category, variant: inv.record.variant, themeId: p.themeId, locale: p.content.locale, timezone: inv.record.timezone, content: p.content, publishedAt: p.publishedAt },
      { 'X-Robots-Tag': 'noindex, nofollow' },
    )
  }

  function handlePublishing(inv: FakeInvitation, rest: string, method: string, ifMatch: string | undefined): Response | null {
    // Dry run: reports `nextCheckIssues` (set by a test) for the current revision, else ready.
    if (rest === 'publish-check' && method === 'GET') {
      const issues = nextCheckIssues ?? []
      return json(200, { revision: inv.revision, ready: issues.length === 0, issues })
    }
    if ((rest !== 'publish' && rest !== 'unpublish') || method !== 'POST') return null
    if (rest === 'unpublish') {
      inv.publication = null
      inv.record = withPublication(inv)
      return json(200, inv.record)
    }
    const rejected = checkIfMatch(inv, ifMatch)
    if (rejected) return rejected
    if (blockNextPublish) {
      const details = blockNextPublish
      blockNextPublish = null
      return json(422, { error: { code: 'publish_blocked', message: 'Not ready to publish', details } })
    }
    inv.slug ??= inv.record.id === 'w1' ? 'alex-sarah-abc123' : `${inv.record.id}-abc123`
    inv.publication = {
      slug: inv.slug,
      themeId: inv.record.themeId,
      revision: inv.revision,
      publishedAt: `2026-11-16T10:0${publishSeq++ % 10}:00Z`,
      content: structuredClone(inv.content),
    }
    inv.record = withPublication(inv)
    return ok(inv, 200, inv.record)
  }

  async function handle(method: string, path: string, body: unknown, ifMatch: string | undefined): Promise<Response> {
    const pendingFailure = failures.get(`${method} ${path}`)
    if (pendingFailure) {
      if (--pendingFailure.remaining <= 0) failures.delete(`${method} ${path}`)
      const failure = pendingFailure.failure
      if (failure.status === 0) throw new NetworkFailure()
      return error(failure)
    }
    const publicResponse = handlePublic(method, path)
    if (publicResponse) return publicResponse

    if (method === 'GET' && path === '/invitations') {
      const items = [...invitations.values()].map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      return json(200, { items })
    }
    if (method === 'POST' && path === '/invitations') {
      const b = (body ?? {}) as { category?: CategoryId; variant?: VariantId; themeId?: string | null; locale?: 'en' | 'id'; title?: string | null }
      if (!b.variant || variantOf(b.variant).id !== b.variant || variantOf(b.variant).category !== b.category)
        return error({ status: 422, code: 'validation_error', message: 'Unknown category/variant' })
      // The default wedding keeps the id `w1` so single-invitation tests read naturally.
      const id = invitations.size === 0 && !invitations.has('w1') ? 'w1' : `inv-${createSeq++}`
      const inv = newInvitation({ id, variant: b.variant, title: b.title, themeId: b.themeId, revision: options.revision, content: id === 'w1' ? options.content : undefined })
      inv.record = { ...inv.record, locale: b.locale ?? 'en', updatedAt: `2026-02-0${Math.min(9, createSeq)}T00:00:00Z` }
      inv.content.locale = inv.record.locale
      invitations.set(id, inv)
      primaryId ??= id
      return json(201, inv.record)
    }

    const m = path.match(/^\/invitations\/([^/]+)(?:\/(.*))?$/)
    const inv = m ? invitations.get(decodeURIComponent(m[1]!)) : undefined
    if (!m || !inv) return error({ status: 404, code: 'not_found' })
    const rest = m[2] ?? ''

    const publishing = handlePublishing(inv, rest, method, ifMatch)
    if (publishing) return publishing
    if (rest === '' && method === 'GET') return json(200, inv.record)
    if (rest === '' && method === 'DELETE') {
      invitations.delete(inv.record.id)
      return new Response(null, { status: 204 })
    }
    if (rest === '' && method === 'PATCH') {
      // Record settings are not content: the revision does not change.
      inv.record = { ...inv.record, ...(body as object) }
      inv.content.locale = inv.record.locale
      return json(200, inv.record)
    }
    if (rest === 'content' && method === 'GET') return ok(inv, 200, inv.content)
    // RSVP replies (owner): list with summary, CSV, delete.
    const replies = rest.match(/^rsvp-responses(?:\?(.*))?$/)
    if (replies && method === 'GET') {
      const query = new URLSearchParams(replies[1] ?? '')
      const limit = Number(query.get('limit') ?? 50)
      const offset = Number(query.get('offset') ?? 0)
      const attending = inv.responses.filter((r) => r.attendance === 'attending')
      return json(200, {
        items: inv.responses.slice(offset, offset + limit),
        total: inv.responses.length,
        summary: {
          responses: inv.responses.length,
          attending: attending.length,
          notAttending: inv.responses.length - attending.length,
          attendingPeople: attending.reduce((n, r) => n + r.partySize, 0),
          capacity: inv.content.rsvp.capacity ?? null,
        },
      })
    }
    if (rest === 'rsvp-responses.csv' && method === 'GET')
      return new Response(['Name,Attendance', ...inv.responses.map((r) => `${r.name},${r.attendance}`)].join('\n'), { status: 200, headers: { 'Content-Type': 'text/csv' } })
    const reply = rest.match(/^rsvp-responses\/([^/]+)$/)
    if (reply && method === 'DELETE') {
      const before = inv.responses.length
      inv.responses = inv.responses.filter((r) => r.id !== reply[1])
      return inv.responses.length === before ? error({ status: 404, code: 'not_found' }) : new Response(null, { status: 204 })
    }
    // Image uploads (not content: no If-Match, no revision bump).
    if (rest === 'assets' && method === 'POST') {
      const form = body as FormData | undefined
      const file = form?.get('file')
      const kind = form?.get('kind')
      if (!(file instanceof Blob) || (kind !== 'image' && kind !== 'qris'))
        return error({ status: 422, code: 'validation_error', message: 'file and kind are required' })
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        return error({ status: 422, code: 'unsupported_image', message: 'Unsupported image' })
      const n = assetSeq++
      const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const asset = { id, src: `/media/${id}.${ext}`, width: 800, height: 800, kind }
      inv.assets.push(asset)
      return json(201, asset)
    }
    const assetItem = rest.match(/^assets\/([^/]+)$/)
    if (assetItem && method === 'DELETE') {
      const before = inv.assets.length
      inv.assets = inv.assets.filter((a) => a.id !== assetItem[1])
      return inv.assets.length === before ? error({ status: 404, code: 'not_found' }) : new Response(null, { status: 204 })
    }
    const sectionName = rest.match(/^sections\/(\w+)$/)?.[1]
    const offered = (name: string) => {
      const id = name === 'countdown' ? 'countdown' : name
      return variantOf(inv.record.variant).sections.some((s) => s.id === id)
    }
    if (sectionName && !offered(sectionName))
      return error({ status: 422, code: 'section_not_available', message: `${sectionName} is not offered for this variant` })
    const universal = rest.match(/^sections\/(holyRecite1|holyRecite2|greeting|countdown|wishes|amplopDigital|profiles|milestone|organization|agenda|speakers)$/)
    if (universal && method === 'GET') return ok(inv, 200, (inv.content as unknown as Record<string, unknown>)[universal[1]!] ?? { enabled: false })
    if (method !== 'GET') {
      const rejected = checkIfMatch(inv, ifMatch)
      if (rejected) return rejected
      bump(inv)
    }
    if (sectionName && method === 'PUT') {
      const value = structuredClone(body) as never
      if (sectionName === 'story') inv.content.story = { ...(value as object), timeline: inv.content.story.timeline }
      else if (sectionName === 'gallery') inv.content.gallery = { ...(value as object), images: inv.content.gallery.images }
      else (inv.content as unknown as Record<string, unknown>)[sectionName] = value
      return ok(inv, 200, body)
    }
    const coll = rest.match(/^(stories|events|gallery)(?:\/([^/]+))?$/)
    if (coll) {
      const name = coll[1] as keyof typeof lists
      const itemId = coll[2]
      const list = lists[name](inv) as { id: string }[]
      if (!itemId && method === 'GET') return ok(inv, 200, list)
      if (!itemId && method === 'POST') {
        const created = { ...(name === 'events' ? { type: 'other' } : {}), ...(body as object), id: `new-${idSeq++}` }
        setList(inv, name, [...list, created] as never[])
        return ok(inv, 201, created)
      }
      if (itemId === 'order' && method === 'PUT') {
        const ids = (body as { ids: string[] }).ids
        const ordered = ids.map((id) => list.find((i) => i.id === id)!)
        setList(inv, name, ordered as never[])
        return ok(inv, 200, ordered)
      }
      if (itemId && method === 'PUT') {
        const saved = { ...(body as object), id: itemId }
        setList(inv, name, list.map((i) => (i.id === itemId ? saved : i)) as never[])
        return ok(inv, 200, saved)
      }
      if (itemId && method === 'DELETE') {
        setList(inv, name, list.filter((i) => i.id !== itemId) as never[])
        return new Response(null, { status: 204, headers: etag(inv) })
      }
    }
    return error({ status: 404, code: 'not_found' })
  }

  const fetchMock: MockInstance = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^.*\/api\/v1/, '')
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body instanceof FormData ? init.body : undefined
    const ifMatch = new Headers(init?.headers).get('If-Match') ?? undefined
    calls.push(ifMatch === undefined ? { method, path, body } : { method, path, body, ifMatch })
    if (hold) await hold
    if (offline) throw new TypeError('Failed to fetch')
    try {
      return await handle(method, path, body, ifMatch)
    } catch (err) {
      if (err instanceof NetworkFailure) throw new TypeError('Failed to fetch')
      throw err
    }
  })

  const requirePrimary = () => {
    const p = primary()
    if (!p) throw new Error('fake API: no invitation yet')
    return p
  }

  let release: () => void = () => {}
  return {
    state,
    calls,
    fetch: fetchMock,
    /** Any invitation by id (undefined once deleted). */
    invitation: (id: string) => invitations.get(id),
    /** Ids of every invitation, in creation order. */
    ids: () => [...invitations.keys()],
    /** Make the next `times` requests to "METHOD /path" fail (status 0 = network failure). */
    failNext(key: string, failure: FakeFailure, times = 1) {
      failures.set(key, { failure, remaining: times })
    },
    /** Hold every response until `release()`. */
    holdResponses() {
      hold = new Promise<void>((resolve) => (release = resolve))
    },
    release() {
      hold = null
      release()
    },
    callsTo: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
    /** Content writes (anything but GET and the record PATCH). */
    writes: () => calls.filter((c) => c.method !== 'GET' && !(c.method === 'PATCH' && /^\/invitations\/[^/]+$/.test(c.path))),
    /** Simulate a content save from another device on an invitation (default: the primary one). */
    editElsewhere(change: (content: WeddingDraft) => void = () => {}, id?: string) {
      const inv = id ? invitations.get(id)! : requirePrimary()
      change(inv.content)
      bump(inv)
    },
    /** Make the next publish fail with 422 publish_blocked. */
    /** What `GET …/publish-check` reports from now on (null = ready). */
    setCheckIssues(details: { section: string; field: string; code: string; message: string }[] | null) {
      nextCheckIssues = details
    },
    blockNextPublish(details: { section: string; field: string; code: string; message: string }[]) {
      blockNextPublish = details
    },
    /** The primary invitation's live publication, or null. */
    publication: () => primary()?.publication ?? null,
    /** Seed RSVP replies for an invitation (newest first), filling defaults. */
    seedResponses(id: string, rows: Partial<RsvpResponse>[]) {
      invitations.get(id)!.responses = rows.map((r, i) => ({
        id: `r${i + 1}`,
        name: `Guest ${i + 1}`,
        attendance: 'attending',
        partySize: 1,
        email: null,
        phone: null,
        sessionIds: [],
        answers: {},
        message: null,
        guestLabel: null,
        createdAt: '2026-11-20T10:00:00Z',
        ...r,
      }))
    },
    /** Make every request fail like a dropped connection (true) or work again (false). */
    setOffline(value: boolean) {
      offline = value
    },
  }
}
