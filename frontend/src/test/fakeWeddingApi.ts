/**
 * In-memory stand-in for the Wedding CMS API (docs/api/weddings.md), installed
 * as a mocked `fetch`. Unit tests use it instead of the real backend.
 *
 * Emulates optimistic concurrency: content GETs and writes answer with
 * `ETag: "<revision>"`; writes with a stale `If-Match` get 409 `edit_conflict`
 * (`details.currentRevision`) and change nothing; successful content writes bump
 * the revision. `editElsewhere()` simulates a save from another device.
 */
import { vi, type MockInstance } from 'vitest'

import type { WeddingRead } from '@/api/weddings'
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

export interface FakeApiOptions {
  /** Start with an existing wedding (default true). */
  hasWedding?: boolean
  themeId?: string | null
  content?: Partial<WeddingDraft>
  /** Initial content revision (default 1). */
  revision?: number
}

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
const error = (f: FakeFailure) =>
  json(f.status, { error: { code: f.code ?? 'error', message: f.message ?? 'Request failed', details: f.details } })

class NetworkFailure extends Error {}

export function installFakeWeddingApi(options: FakeApiOptions = {}) {
  let idSeq = 1
  let assetSeq = 1
  const state: {
    wedding: WeddingRead | null
    content: WeddingDraft
    revision: number
    offline: boolean
    assets: { id: string; src: string; width: number; height: number; kind: string }[]
  } = {
    wedding:
      options.hasWedding === false
        ? null
        : {
            id: 'w1',
            themeId: options.themeId ?? null,
            locale: options.content?.locale ?? 'en',
            status: 'draft',
            publishedAt: null,
            revision: options.revision ?? 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
    content: normalizeDraft({ ...emptyDraft(), ...structuredClone(options.content ?? {}) }),
    revision: options.revision ?? 1,
    /** While true, every request fails like a dropped connection. */
    offline: false,
    /** Uploaded image assets (POST /weddings/{id}/assets). */
    assets: [],
  }
  const calls: FakeCall[] = []
  /** Failures keyed by "METHOD /path" (path without /api/v1), each with how many requests it still fails. */
  const failures = new Map<string, { failure: FakeFailure; remaining: number }>()
  /** Requests whose response is held until `release()` is called. */
  let hold: Promise<void> | null = null

  const lists = {
    stories: () => state.content.story.timeline,
    events: () => state.content.events,
    gallery: () => state.content.gallery.images,
  } as const
  const setList = (name: keyof typeof lists, items: never[]) => {
    if (name === 'stories') state.content.story.timeline = items
    else if (name === 'events') state.content.events = items
    else state.content.gallery.images = items
  }

  const etag = () => ({ ETag: `"${state.revision}"` })
  /** Content responses carry the revision. */
  const ok = (status: number, body?: unknown) => json(status, body, etag())
  /** null = the If-Match matches (or is absent/"*"); otherwise the error response. */
  function checkIfMatch(ifMatch: string | undefined): Response | null {
    if (ifMatch === undefined || ifMatch.trim() === '*') return null
    const m = ifMatch.trim().match(/^(?:W\/)?"?(\d+)"?$/)
    if (!m) return error({ status: 400, code: 'bad_request', message: 'Malformed If-Match' })
    if (Number(m[1]) === state.revision) return null
    return json(409, { error: { code: 'edit_conflict', message: 'Edited elsewhere', details: { currentRevision: state.revision } } }, etag())
  }
  const bump = () => {
    state.revision++
    if (state.wedding) state.wedding = { ...state.wedding, revision: state.revision }
  }

  // --- Publishing (CMS v2.0; Agent B) -------------------------------------------------
  /** Live publication: snapshot in draft shape (as the public endpoint returns it). */
  let publication: { slug: string; themeId: string | null; revision: number; publishedAt: string; content: WeddingDraft } | null = null
  let slug: string | null = null
  /** Next publish answers 422 publish_blocked with these details (once). */
  let blockNextPublish: { section: string; field: string; code: string; message: string }[] | null = null
  let publishSeq = 0
  const withPublication = (): WeddingRead => {
    const w = state.wedding!
    const live = publication
    return {
      ...w,
      status: live ? 'published' : 'draft',
      publishedAt: live ? live.publishedAt : null,
      slug,
      publication: live ? { publishedAt: live.publishedAt, revision: live.revision, themeId: live.themeId } : null,
      hasUnpublishedChanges: !!live && (live.revision !== state.revision || live.themeId !== w.themeId),
    }
  }
  function handlePublishing(method: string, path: string, ifMatch: string | undefined): Response | null {
    const pub = path.match(/^\/public\/weddings\/([^/]+)$/)
    if (pub && method === 'GET') {
      if (!publication || decodeURIComponent(pub[1]!) !== publication.slug) return error({ status: 404, code: 'not_found', message: 'Not found' })
      return json(200, { themeId: publication.themeId, locale: publication.content.locale, content: publication.content, publishedAt: publication.publishedAt }, { 'X-Robots-Tag': 'noindex, nofollow' })
    }
    const own = path.match(/^\/weddings\/([^/]+)\/(publish|unpublish)$/)
    if (!own || method !== 'POST') return null
    if (!state.wedding || own[1] !== state.wedding.id) return error({ status: 404, code: 'not_found' })
    if (own[2] === 'unpublish') {
      publication = null
      state.wedding = withPublication()
      return json(200, state.wedding)
    }
    const rejected = checkIfMatch(ifMatch)
    if (rejected) return rejected
    if (blockNextPublish) {
      const details = blockNextPublish
      blockNextPublish = null
      return json(422, { error: { code: 'publish_blocked', message: 'Not ready to publish', details } })
    }
    slug ??= 'alex-sarah-abc123'
    publication = {
      slug,
      themeId: state.wedding.themeId,
      revision: state.revision,
      publishedAt: `2026-11-16T10:0${publishSeq++ % 10}:00Z`,
      content: structuredClone(state.content),
    }
    state.wedding = withPublication()
    return ok(200, state.wedding)
  }

  async function handle(method: string, path: string, body: unknown, ifMatch: string | undefined): Promise<Response> {
    const pendingFailure = failures.get(`${method} ${path}`)
    if (pendingFailure) {
      if (--pendingFailure.remaining <= 0) failures.delete(`${method} ${path}`)
      const failure = pendingFailure.failure
      if (failure.status === 0) throw new NetworkFailure()
      return error(failure)
    }
    const publishingResponse = handlePublishing(method, path, ifMatch)
    if (publishingResponse) return publishingResponse
    if (method === 'GET' && path === '/weddings/me')
      return state.wedding ? json(200, state.wedding) : error({ status: 404, code: 'not_found' })
    if (method === 'POST' && path === '/weddings') {
      if (state.wedding) return error({ status: 409, code: 'wedding_exists' })
      const b = (body ?? {}) as { themeId?: string | null; locale?: 'en' | 'id' }
      state.wedding = {
        id: 'w1',
        themeId: b.themeId ?? null,
        locale: b.locale ?? 'en',
        status: 'draft',
        publishedAt: null,
        revision: state.revision,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      return json(201, state.wedding)
    }
    const m = path.match(/^\/weddings\/([^/]+)(?:\/(.*))?$/)
    if (!m || !state.wedding || m[1] !== state.wedding.id) return error({ status: 404, code: 'not_found' })
    const rest = m[2] ?? ''
    if (rest === '' && method === 'PATCH') {
      // Theme/locale are not content: the revision does not change.
      state.wedding = { ...state.wedding, ...(body as object) }
      state.content.locale = state.wedding.locale
      return json(200, state.wedding)
    }
    if (rest === 'content' && method === 'GET') return ok(200, state.content)
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
      state.assets.push(asset)
      return json(201, asset)
    }
    const assetItem = rest.match(/^assets\/([^/]+)$/)
    if (assetItem && method === 'DELETE') {
      const before = state.assets.length
      state.assets = state.assets.filter((a) => a.id !== assetItem[1])
      return state.assets.length === before ? error({ status: 404, code: 'not_found' }) : new Response(null, { status: 204 })
    }
    const universal = rest.match(/^sections\/(holyRecite1|holyRecite2|greeting|countdown|wishes|amplopDigital)$/)
    if (universal && method === 'GET') return ok(200, (state.content as unknown as Record<string, unknown>)[universal[1]!] ?? { enabled: false })
    if (method !== 'GET') {
      const rejected = checkIfMatch(ifMatch)
      if (rejected) return rejected
      bump()
    }
    const section = rest.match(/^sections\/(\w+)$/)
    if (section && method === 'PUT') {
      const name = section[1] as 'opening' | 'couple' | 'story' | 'gallery' | 'rsvp' | 'closing'
      const value = structuredClone(body) as never
      if (name === 'story') state.content.story = { ...(value as object), timeline: state.content.story.timeline }
      else if (name === 'gallery') state.content.gallery = { ...(value as object), images: state.content.gallery.images }
      else (state.content as unknown as Record<string, unknown>)[name] = value
      return ok(200, body)
    }
    const coll = rest.match(/^(stories|events|gallery)(?:\/([^/]+))?$/)
    if (coll) {
      const name = coll[1] as keyof typeof lists
      const itemId = coll[2]
      const list = lists[name]() as { id: string }[]
      if (!itemId && method === 'GET') return ok(200, list)
      if (!itemId && method === 'POST') {
        const created = { ...(name === 'events' ? { type: 'other' } : {}), ...(body as object), id: `new-${idSeq++}` }
        setList(name, [...list, created] as never[])
        return ok(201, created)
      }
      if (itemId === 'order' && method === 'PUT') {
        const ids = (body as { ids: string[] }).ids
        const ordered = ids.map((id) => list.find((i) => i.id === id)!)
        setList(name, ordered as never[])
        return ok(200, ordered)
      }
      if (itemId && method === 'PUT') {
        const saved = { ...(body as object), id: itemId }
        setList(name, list.map((i) => (i.id === itemId ? saved : i)) as never[])
        return ok(200, saved)
      }
      if (itemId && method === 'DELETE') {
        setList(name, list.filter((i) => i.id !== itemId) as never[])
        return new Response(null, { status: 204, headers: etag() })
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
    if (state.offline) throw new TypeError('Failed to fetch')
    try {
      return await handle(method, path, body, ifMatch)
    } catch (err) {
      if (err instanceof NetworkFailure) throw new TypeError('Failed to fetch')
      throw err
    }
  })

  let release: () => void = () => {}
  return {
    state,
    calls,
    fetch: fetchMock,
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
    writes: () => calls.filter((c) => c.method !== 'GET' && !(c.method === 'PATCH' && /^\/weddings\/[^/]+$/.test(c.path))),
    /** Simulate a content save from another device: apply `change` and bump the revision. */
    editElsewhere(change: (content: WeddingDraft) => void = () => {}) {
      change(state.content)
      bump()
    },
    /** Publishing (Agent B): make the next publish fail with 422 publish_blocked. */
    blockNextPublish(details: { section: string; field: string; code: string; message: string }[]) {
      blockNextPublish = details
    },
    /** Publishing (Agent B): the live publication, or null. */
    publication: () => publication,
    /** Make every request fail like a dropped connection (true) or work again (false). */
    setOffline(value: boolean) {
      state.offline = value
    },
  }
}
