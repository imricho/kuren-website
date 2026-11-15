/**
 * In-memory stand-in for the Wedding CMS API (docs/api/weddings.md), installed
 * as a mocked `fetch`. Unit tests use it instead of the real backend.
 */
import { vi, type MockInstance } from 'vitest'

import type { WeddingRead } from '@/api/weddings'
import { emptyDraft, normalizeDraft, type WeddingDraft } from '@/features/wedding/draft'

export interface FakeCall {
  method: string
  path: string
  body: unknown
}

export interface FakeFailure {
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
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const error = (f: FakeFailure) =>
  json(f.status, { error: { code: f.code ?? 'error', message: f.message ?? 'Request failed', details: f.details } })

export function installFakeWeddingApi(options: FakeApiOptions = {}) {
  let idSeq = 1
  const state: { wedding: WeddingRead | null; content: WeddingDraft } = {
    wedding:
      options.hasWedding === false
        ? null
        : {
            id: 'w1',
            themeId: options.themeId ?? null,
            locale: options.content?.locale ?? 'en',
            status: 'draft',
            publishedAt: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
    content: normalizeDraft({ ...emptyDraft(), ...structuredClone(options.content ?? {}) }),
  }
  const calls: FakeCall[] = []
  /** Failures keyed by "METHOD /path" (path without /api/v1); consumed once. */
  const failures = new Map<string, FakeFailure>()
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

  async function handle(method: string, path: string, body: unknown): Promise<Response> {
    const failure = failures.get(`${method} ${path}`)
    if (failure) {
      failures.delete(`${method} ${path}`)
      return error(failure)
    }
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
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      return json(201, state.wedding)
    }
    const m = path.match(/^\/weddings\/([^/]+)(?:\/(.*))?$/)
    if (!m || !state.wedding || m[1] !== state.wedding.id) return error({ status: 404, code: 'not_found' })
    const rest = m[2] ?? ''
    if (rest === '' && method === 'PATCH') {
      state.wedding = { ...state.wedding, ...(body as object) }
      state.content.locale = state.wedding.locale
      return json(200, state.wedding)
    }
    if (rest === 'content' && method === 'GET') return json(200, state.content)
    const section = rest.match(/^sections\/(\w+)$/)
    if (section && method === 'PUT') {
      const name = section[1] as 'opening' | 'couple' | 'story' | 'gallery' | 'rsvp' | 'closing'
      const value = structuredClone(body) as never
      if (name === 'story') state.content.story = { ...(value as object), timeline: state.content.story.timeline }
      else if (name === 'gallery') state.content.gallery = { ...(value as object), images: state.content.gallery.images }
      else (state.content as unknown as Record<string, unknown>)[name] = value
      return json(200, body)
    }
    const coll = rest.match(/^(stories|events|gallery)(?:\/([^/]+))?$/)
    if (coll) {
      const name = coll[1] as keyof typeof lists
      const itemId = coll[2]
      const list = lists[name]() as { id: string }[]
      if (!itemId && method === 'GET') return json(200, list)
      if (!itemId && method === 'POST') {
        const created = { ...(name === 'events' ? { type: 'other' } : {}), ...(body as object), id: `new-${idSeq++}` }
        setList(name, [...list, created] as never[])
        return json(201, created)
      }
      if (itemId === 'order' && method === 'PUT') {
        const ids = (body as { ids: string[] }).ids
        const ordered = ids.map((id) => list.find((i) => i.id === id)!)
        setList(name, ordered as never[])
        return json(200, ordered)
      }
      if (itemId && method === 'PUT') {
        const saved = { ...(body as object), id: itemId }
        setList(name, list.map((i) => (i.id === itemId ? saved : i)) as never[])
        return json(200, saved)
      }
      if (itemId && method === 'DELETE') {
        setList(name, list.filter((i) => i.id !== itemId) as never[])
        return json(204)
      }
    }
    return error({ status: 404, code: 'not_found' })
  }

  const fetchMock: MockInstance = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^.*\/api\/v1/, '')
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })
    if (hold) await hold
    return handle(method, path, body)
  })

  let release: () => void = () => {}
  return {
    state,
    calls,
    fetch: fetchMock,
    /** Make the next request to "METHOD /path" fail. */
    failNext(key: string, failure: FakeFailure) {
      failures.set(key, failure)
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
  }
}
