import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { publishableDraft } from '@/test/publishFixture'

import { useInvitationStore } from './invitation'

describe('wedding store publishing', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  async function loaded(revision = 3) {
    const api = installFakeInvitationApi({ themeId: 'ethnic', content: publishableDraft(), revision })
    const store = useInvitationStore()
    await store.ensureLoaded('w1')
    return { api, store }
  }

  it('saves first, publishes with If-Match, then reports Published with a public URL', async () => {
    const { api, store } = await loaded()
    expect(store.publishState).toBe('draft')
    expect(store.publicUrl).toBeNull()
    const flush = vi.fn(async () => true)
    store.registerAutosave('opening', { flush, retry: async () => true, resume: () => {}, reload: () => {} })

    expect(await store.publish()).toBe('published')
    expect(flush).toHaveBeenCalledTimes(1)
    const [call] = api.callsTo('POST', '/invitations/w1/publish')
    expect(call!.ifMatch).toBe('"3"')
    expect(store.publishState).toBe('published')
    expect(store.isPublished).toBe(true)
    expect(store.publicUrl).toBe(`${location.origin}/i/alex-sarah-abc123`)
    expect(store.publishAnnouncement?.kind).toBe('published')
    expect(api.publication()?.content.closing.message).toBe('Thank you for celebrating with us.')
  })

  it('refuses to publish while changes cannot be saved', async () => {
    const { api, store } = await loaded()
    store.registerAutosave('opening', { flush: async () => false, retry: async () => false, resume: () => {}, reload: () => {} })
    store.setDirty('opening', true)
    expect(await store.publish()).toBe('unsaved')
    expect(api.callsTo('POST', '/invitations/w1/publish')).toHaveLength(0)
    expect(store.publishState).toBe('draft')
  })

  it('tracks unpublished changes from the content revision and the theme', async () => {
    const { store } = await loaded()
    await store.publish()
    expect(store.hasUnpublishedChanges).toBe(false)
    await store.saveSection('closing', { message: 'Updated message' })
    expect(store.hasUnpublishedChanges).toBe(true)
    expect(store.publishState).toBe('unpublished_changes')
    expect(await store.publish()).toBe('published')
    expect(store.publishAnnouncement?.kind).toBe('updated')
    expect(store.publishState).toBe('published')
    await store.setTheme('international')
    expect(store.publishState).toBe('unpublished_changes')
  })

  it('maps 422 publish_blocked details to issues and keeps the state', async () => {
    const { api, store } = await loaded()
    api.blockNextPublish([{ section: 'closing', field: 'closing.message', code: 'required', message: 'Closing message is required' }])
    expect(await store.publish()).toBe('blocked')
    expect(store.publishIssues).toEqual([
      expect.objectContaining({ severity: 'error', section: 'closing', field: 'message', message: 'Add a closing message.', to: { name: 'editor-closing', hash: '#f-message' } }),
    ])
    expect(store.publishState).toBe('draft')
    expect(store.publishAnnouncement).toMatchObject({ kind: 'blocked', count: 1 })
    // Server issues are dropped once content changes.
    await store.saveSection('closing', { message: 'Now set' })
    expect(store.publishIssues).toEqual([])
  })

  it('surfaces the existing conflict state on 409', async () => {
    const { api, store } = await loaded()
    api.editElsewhere()
    expect(await store.publish()).toBe('conflict')
    expect(store.conflict).toEqual({ currentRevision: 4 })
    expect(store.saveState).toBe('conflict')
    expect(store.publishState).toBe('draft')
  })

  it('a failed publish says so and leaves the live invitation unchanged', async () => {
    const { api, store } = await loaded()
    await store.publish()
    const live = api.publication()
    api.failNext('POST /invitations/w1/publish', { status: 500 })
    await store.saveSection('closing', { message: 'Changed' })
    expect(await store.publish()).toBe('failed')
    expect(store.publishState).toBe('failed')
    expect(store.publishAnnouncement?.kind).toBe('failed')
    expect(api.publication()).toBe(live)
    expect(await store.publish()).toBe('published')
    expect(store.publishState).toBe('published')
  })

  it('unpublishes after confirming (slug kept)', async () => {
    const { store } = await loaded()
    await store.publish()
    expect(await store.unpublish({ confirm: false })).toBe(true)
    expect(store.publishState).toBe('draft')
    expect(store.isPublished).toBe(false)
    expect(store.record?.slug).toBe('alex-sarah-abc123')
    expect(store.publishAnnouncement?.kind).toBe('unpublished')
  })

  it('derives Published from a record loaded from the server', async () => {
    const api = installFakeInvitationApi({ themeId: 'ethnic', content: publishableDraft(), revision: 5 })
    api.state.invitation = {
      ...api.state.invitation!,
      status: 'published',
      slug: 'a-b-123456',
      publication: { publishedAt: '2026-11-15T10:00:00Z', revision: 4, themeId: 'ethnic' },
      hasUnpublishedChanges: true,
    }
    const store = useInvitationStore()
    await store.ensureLoaded('w1')
    expect(store.publishState).toBe('unpublished_changes')
    expect(store.publicUrl).toBe(`${location.origin}/i/a-b-123456`)
  })
})
