import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/http'
import { useToast } from '@/composables/useToast'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import { useAuthStore } from './auth'

import { useWeddingStore } from './wedding'

describe('wedding store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('loads the wedding once, even with concurrent callers', async () => {
    const api = installFakeWeddingApi({ themeId: 'ethnic', content: { opening: { weddingTitle: 'Hi' } } })
    const store = useWeddingStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded()])
    await store.ensureLoaded()
    expect(api.callsTo('GET', '/weddings/me')).toHaveLength(1)
    expect(api.callsTo('GET', '/weddings/w1/content')).toHaveLength(1)
    expect(store.loadState).toBe('ready')
    expect(store.themeId).toBe('ethnic')
    expect(store.content?.opening.weddingTitle).toBe('Hi')
    expect(store.content?.couple).toEqual({ groom: {}, bride: {} })
  })

  it('creates the wedding on first visit (404 → POST)', async () => {
    const api = installFakeWeddingApi({ hasWedding: false })
    const store = useWeddingStore()
    await store.ensureLoaded()
    expect(api.callsTo('POST', '/weddings')).toEqual([{ method: 'POST', path: '/weddings', body: { locale: 'id' } }])
    expect(store.record?.id).toBe('w1')
    expect(store.loadState).toBe('ready')
  })

  it('passes a valid stored theme when creating the wedding, then forgets it', async () => {
    localStorage.setItem('kuren.selectedThemeId', 'woven-indigo')
    const api = installFakeWeddingApi({ hasWedding: false })
    const store = useWeddingStore()
    await store.ensureLoaded()
    expect(api.callsTo('POST', '/weddings')[0]!.body).toEqual({ themeId: 'ethnic', locale: 'id' })
    expect(store.themeId).toBe('ethnic')
    expect(localStorage.getItem('kuren.selectedThemeId')).toBeNull()
    expect(api.callsTo('PATCH', '/weddings/w1')).toHaveLength(0)
  })

  it('reports load errors and can retry', async () => {
    const api = installFakeWeddingApi()
    api.failNext('GET /weddings/me', { status: 500, message: 'Server down' })
    const store = useWeddingStore()
    await store.ensureLoaded()
    expect(store.loadState).toBe('error')
    expect(store.loadError).toBe('Server down')
    await store.reload()
    expect(store.loadState).toBe('ready')
  })

  it('saving a section replaces the local copy with the server response', async () => {
    const api = installFakeWeddingApi({ content: { story: { title: 'Old', timeline: [{ id: 's1', title: 'Met' }] } } })
    const store = useWeddingStore()
    await store.ensureLoaded()
    await store.saveSection('opening', { weddingTitle: 'Our day', weddingDate: '2027-06-12' })
    expect(store.content?.opening).toEqual({ weddingTitle: 'Our day', weddingDate: '2027-06-12' })
    await store.saveSection('story', { title: 'New' })
    // Story meta replaces only the meta; the timeline is kept.
    expect(store.content?.story).toEqual({ title: 'New', timeline: [{ id: 's1', title: 'Met' }] })
    expect(api.callsTo('PUT', '/weddings/w1/sections/story')[0]!.body).toEqual({ title: 'New' })
  })

  it('keeps the saved copy when a save fails (pessimistic)', async () => {
    const api = installFakeWeddingApi({ content: { closing: { message: 'Saved' } } })
    const store = useWeddingStore()
    await store.ensureLoaded()
    api.failNext('PUT /weddings/w1/sections/closing', {
      status: 422,
      code: 'validation_error',
      details: [{ field: 'message', message: 'too long' }],
    })
    const err = await store.saveSection('closing', { message: 'x'.repeat(3000) }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).fieldErrors).toEqual([{ field: 'message', message: 'too long' }])
    expect(store.content?.closing).toEqual({ message: 'Saved' })
  })

  it('creates, updates, reorders and deletes collection items', async () => {
    installFakeWeddingApi()
    const store = useWeddingStore()
    await store.ensureLoaded()
    const a = await store.createItem('events', { type: 'akad', title: 'Akad' })
    const b = await store.createItem('events', { type: 'reception', title: 'Resepsi' })
    expect(store.items('events').map((e) => e.title)).toEqual(['Akad', 'Resepsi'])
    await store.updateItem('events', a.id, { type: 'akad', title: 'Akad Nikah' })
    await store.reorder('events', [b.id, a.id])
    expect(store.items('events').map((e) => e.title)).toEqual(['Resepsi', 'Akad Nikah'])
    await store.deleteItem('events', b.id)
    expect(store.items('events').map((e) => e.id)).toEqual([a.id])
    expect(store.completeness.sections.events.status).toBe('in_progress')
  })

  it('setTheme and setLocale PATCH the record', async () => {
    const api = installFakeWeddingApi()
    const store = useWeddingStore()
    await store.ensureLoaded()
    await store.setTheme('international')
    await store.setLocale('id')
    expect(api.callsTo('PATCH', '/weddings/w1').map((c) => c.body)).toEqual([{ themeId: 'international' }, { locale: 'id' }])
    expect(store.themeId).toBe('international')
    expect(store.content?.locale).toBe('id')
    expect(store.previewContent?.locale).toBe('id')
  })

  it('drops the result of a load that finishes after reset()', async () => {
    const api = installFakeWeddingApi({ content: { opening: { weddingTitle: 'Secret' } } })
    const store = useWeddingStore()
    api.holdResponses()
    const loading = store.ensureLoaded()
    store.reset()
    api.release()
    await loading
    expect(store.record).toBeNull()
    expect(store.content).toBeNull()
    expect(store.loadState).toBe('idle')
  })

  it('drops the result of a write that finishes after reset()', async () => {
    const api = installFakeWeddingApi()
    const store = useWeddingStore()
    await store.ensureLoaded()
    api.holdResponses()
    const saving = store.saveSection('closing', { message: 'x' }).catch((e: unknown) => e)
    store.reset()
    api.release()
    expect((await saving) as Error).toMatchObject({ name: 'StaleError' })
    expect(store.content).toBeNull()
  })

  it('clears everything (and toasts) when the signed-in user changes', async () => {
    installFakeWeddingApi({ content: { opening: { weddingTitle: 'Alice’s wedding' } } })
    const auth = useAuthStore()
    auth.user = { id: 'alice', email: 'a@example.com', full_name: 'Alice', created_at: '2026-01-01' }
    const store = useWeddingStore()
    await store.ensureLoaded()
    store.setDirty('opening', true)
    useToast().success('Opening saved')
    auth.user = { id: 'bob', email: 'b@example.com', full_name: 'Bob', created_at: '2026-01-01' }
    expect(store.content).toBeNull()
    expect(store.record).toBeNull()
    expect(store.anyDirty).toBe(false)
    expect(store.loadState).toBe('idle')
    expect(useToast().toasts.value).toEqual([])
  })

  it('tracks unsaved drafts by section', () => {
    installFakeWeddingApi()
    const store = useWeddingStore()
    store.setDirty('events:e1', true)
    expect(store.anyDirty).toBe(true)
    expect(store.isSectionDirty('events')).toBe(true)
    expect(store.isSectionDirty('story')).toBe(false)
    store.setDirty('events:e1', false)
    expect(store.anyDirty).toBe(false)
  })
})
