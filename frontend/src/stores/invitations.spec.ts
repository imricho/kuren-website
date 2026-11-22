/**
 * The invitation store keyed by invitation id (load by id, switching) and the
 * invitations list store, against the multi-invitation fake API.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installFakeInvitationApi } from '@/test/fakeInvitationApi'

import { useInvitationStore } from './invitation'
import { useInvitationsStore } from './invitations'

const seeds = () => [
  { id: 'w1', themeId: 'ethnic', content: { opening: { weddingTitle: 'Our wedding' } }, revision: 3, updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'b1', variant: 'birthday' as const, title: 'Nadia 30', content: { opening: { weddingTitle: 'Nadia turns 30' } }, revision: 7, updatedAt: '2026-03-01T00:00:00Z' },
]

describe('invitation store (keyed by id)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('loads an invitation by id with its record fields and variant-driven sections', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    const store = useInvitationStore()
    await store.ensureLoaded('b1')
    expect(api.callsTo('GET', '/invitations/b1')).toHaveLength(1)
    expect(api.callsTo('GET', '/invitations/b1/content')).toHaveLength(1)
    expect(store).toMatchObject({ invitationId: 'b1', category: 'celebration', variant: 'birthday', title: 'Nadia 30', timezone: 'Asia/Jakarta', revision: 7 })
    expect(store.sections.map((s) => s.id)).toContain('profiles')
    expect(store.content?.opening.weddingTitle).toBe('Nadia turns 30')
    // Birthday: no couple; required = theme + opening, event date, events, closing.
    expect(store.completeness.total).toBe(5)
    expect(store.completeness.sections.couple).toEqual({ status: 'optional', missing: [], required: false })
    expect(store.livePreviewContent?.sections).not.toContain('couple')
    // Same id again: nothing reloads.
    await store.ensureLoaded('b1')
    expect(api.callsTo('GET', '/invitations/b1')).toHaveLength(1)
  })

  it('switching invitations drops the previous state and writes go to the new id with its own revision', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    const store = useInvitationStore()
    await store.ensureLoaded('w1')
    store.setDirty('opening', true)
    store.setLiveDraft('opening', { kind: 'section', section: 'opening', value: { weddingTitle: 'Typing…' } })
    await store.ensureLoaded('b1')
    expect(store.record?.id).toBe('b1')
    expect(store.anyDirty).toBe(false)
    expect(store.liveDraft?.opening.weddingTitle).toBe('Nadia turns 30')
    await store.saveSection('closing', { message: 'See you!' })
    expect(api.callsTo('PUT', '/invitations/b1/sections/closing')[0]!.ifMatch).toBe('"7"')
    expect(api.invitation('b1')!.content.closing.message).toBe('See you!')
    expect(api.invitation('w1')!.content.closing.message).toBeUndefined()
    expect(api.invitation('w1')!.revision).toBe(3)
  })

  it('drops a load still in flight for the previous invitation', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    const store = useInvitationStore()
    api.holdResponses()
    const first = store.ensureLoaded('w1')
    const second = store.ensureLoaded('b1')
    api.release()
    await Promise.all([first, second])
    expect(store.record?.id).toBe('b1')
    expect(store.content?.opening.weddingTitle).toBe('Nadia turns 30')
    expect(store.loadState).toBe('ready')
  })

  it('reports an unknown (or not owned) invitation as not found', async () => {
    installFakeInvitationApi({ invitations: seeds() })
    const store = useInvitationStore()
    await store.ensureLoaded('nope')
    expect(store.loadState).toBe('error')
    expect(store.notFound).toBe(true)
    await store.ensureLoaded('w1')
    expect(store.notFound).toBe(false)
    expect(store.loadState).toBe('ready')
  })

  it('updates record settings without touching the content revision', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    const store = useInvitationStore()
    await store.ensureLoaded('b1')
    await store.updateSettings({ title: 'Nadia’s 30th', timezone: 'Asia/Makassar' })
    expect(api.callsTo('PATCH', '/invitations/b1')[0]!.body).toEqual({ title: 'Nadia’s 30th', timezone: 'Asia/Makassar' })
    expect(store).toMatchObject({ title: 'Nadia’s 30th', timezone: 'Asia/Makassar', revision: 7 })
  })
})

describe('invitations list store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists newest-updated first and finds the latest invitation of a category', async () => {
    installFakeInvitationApi({ invitations: seeds() })
    const list = useInvitationsStore()
    await Promise.all([list.ensureLoaded(), list.ensureLoaded()])
    expect(list.items.map((i) => i.id)).toEqual(['b1', 'w1'])
    expect(list.latestOf('wedding')?.id).toBe('w1')
    expect(list.latestOf('corporate')).toBeUndefined()
    expect(list.byId.get('b1')?.title).toBe('Nadia 30')
  })

  it('creates (newest first) and deletes, dropping the deleted invitation from the editor', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    const list = useInvitationsStore()
    const open = useInvitationStore()
    await list.load()
    const created = await list.create({ category: 'corporate', variant: 'seminar', title: 'Tech talk' })
    expect(api.callsTo('POST', '/invitations')[0]!.body).toEqual({ category: 'corporate', variant: 'seminar', title: 'Tech talk' })
    expect(list.items[0]).toMatchObject({ id: created.id, variant: 'seminar', category: 'corporate' })

    await open.ensureLoaded(created.id)
    await list.remove(created.id)
    expect(api.callsTo('DELETE', `/invitations/${created.id}`)).toHaveLength(1)
    expect(list.items.map((i) => i.id)).toEqual(['b1', 'w1'])
    expect(open.record).toBeNull()
    // Deleting again (404) is not an error.
    await expect(list.remove(created.id)).resolves.toBeUndefined()
  })

  it('reports list failures', async () => {
    const api = installFakeInvitationApi({ invitations: seeds() })
    api.failNext('GET /invitations', { status: 500, message: 'Down' })
    const list = useInvitationsStore()
    await list.load()
    expect(list.loadState).toBe('error')
    expect(list.loadError).toBe('Down')
    await list.load()
    expect(list.loadState).toBe('ready')
  })
})
