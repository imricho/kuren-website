import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installFakeInvitationApi } from '@/test/fakeInvitationApi'

import { useThemeSelectionStore } from './themeSelection'
import { useInvitationStore } from './invitation'
import { useAuthStore } from './auth'

const KEY = 'kuren.selectedThemeId'

describe('theme selection store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('starts with no selection', async () => {
    installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    expect(useThemeSelectionStore().selectedThemeId).toBeNull()
  })

  it('selects a valid theme and saves it on the wedding record', async () => {
    const api = installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    await expect(store.select('ethnic')).resolves.toBe(true)
    expect(api.callsTo('PATCH', '/invitations/w1').map((c) => c.body)).toEqual([{ themeId: 'ethnic' }])
    expect(localStorage.getItem(KEY)).toBeNull()

    // A fresh app session loads it back from the API.
    setActivePinia(createPinia())
    await useInvitationStore().ensureLoaded('w1')
    const reloaded = useThemeSelectionStore()
    expect(reloaded.selectedThemeId).toBe('ethnic')
    // The id is stable; only the display name changed with the theme-family update.
    expect(reloaded.selectedTheme?.name).toBe('Woven Indigo')
  })

  it('is pessimistic: pending while saving, unchanged until the server confirms', async () => {
    const api = installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    api.holdResponses()
    const done = store.select('international')
    await vi.waitFor(() => expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(1))
    expect(store.pendingThemeId).toBe('international')
    expect(store.selectedThemeId).toBeNull()
    api.release()
    await done
    expect(store.pendingThemeId).toBeNull()
    expect(store.selectedThemeId).toBe('international')
  })

  it('ignores competing selections until the first save settles', async () => {
    const api = installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    api.holdResponses()
    const first = store.select('ethnic')
    await vi.waitFor(() => expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(1))
    await expect(store.select('international')).resolves.toBe(false)
    api.release()
    await expect(first).resolves.toBe(true)
    expect(store.selectedThemeId).toBe('ethnic')
    expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(1)
  })

  it('does not report success or apply a selection after the user changes', async () => {
    const api = installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    api.holdResponses()
    const first = store.select('ethnic')
    await vi.waitFor(() => expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(1))
    useAuthStore().user = { id: 'other', email: 'other@example.com', full_name: 'Other' } as never
    api.release()
    await expect(first).resolves.toBe(false)
    expect(store.selectedThemeId).toBeNull()
  })

  it('records an error and keeps the old selection when saving fails', async () => {
    const api = installFakeInvitationApi({ themeId: 'ethnic' })
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    api.failNext('PATCH /invitations/w1', { status: 500, message: 'Nope' })
    await expect(store.select('international')).resolves.toBe(false)
    expect(store.selectedThemeId).toBe('ethnic')
    expect(store.error).toEqual({ themeId: 'international', message: 'Nope' })
  })

  it('ignores unknown and draft theme ids', async () => {
    const api = installFakeInvitationApi()
    const store = useThemeSelectionStore()
    await expect(store.select('not-a-theme')).resolves.toBe(false)
    expect(store.selectedThemeId).toBeNull()
    expect(api.calls).toHaveLength(0)
  })

  it('previewing a template never changes the selection', async () => {
    installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    await store.select('international')
    store.preview('blush-garden')
    expect(store.previewedThemeId).toBe('conventional')
    expect(store.selectedThemeId).toBe('international')
  })

  it('stores the canonical id when selecting by slug', async () => {
    const api = installFakeInvitationApi()
    await useInvitationStore().ensureLoaded('w1')
    const store = useThemeSelectionStore()
    await store.select('gallery-bold')
    expect(store.selectedThemeId).toBe('artistic')
    expect(api.callsTo('PATCH', '/invitations/w1')[0]!.body).toEqual({ themeId: 'artistic' })
  })

  it('selects only for an open invitation, and only compatible templates', async () => {
    const api = installFakeInvitationApi({ invitations: [{ id: 'b1', variant: 'birthday' }] })
    const store = useThemeSelectionStore()
    await expect(store.select('ethnic')).resolves.toBe(false)
    expect(store.needsInvitation).toBe(true)
    expect(store.error).toMatchObject({ message: 'no_invitation' })
    await useInvitationStore().ensureLoaded('b1')
    expect(store.isCompatible('ethnic')).toBe(false) // legacy themes are wedding-style only
    await expect(store.select('ethnic')).resolves.toBe(false)
    expect(store.error).toMatchObject({ message: 'template_incompatible' })
    expect(api.callsTo('PATCH', '/invitations/b1')).toHaveLength(0)
  })

  it('ignores removed theme ids in selection and preview', async () => {
    installFakeInvitationApi()
    const store = useThemeSelectionStore()
    await store.select('removed-theme')
    expect(store.selectedThemeId).toBeNull()
    store.preview('removed-theme')
    expect(store.previewedThemeId).toBeNull()
  })
})

describe('one-time migration of the localStorage theme', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => vi.restoreAllMocks())

  it('wedding without a theme + valid stored id → PATCH it, then remove the key', async () => {
    localStorage.setItem(KEY, 'blush-garden') // slug of a selectable template
    const api = installFakeInvitationApi({ themeId: null })
    await useInvitationStore().ensureLoaded('w1')
    expect(api.callsTo('PATCH', '/invitations/w1').map((c) => c.body)).toEqual([{ themeId: 'conventional' }])
    expect(useThemeSelectionStore().selectedThemeId).toBe('conventional')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('wedding already has a theme → keep it and remove the key', async () => {
    localStorage.setItem(KEY, 'international')
    const api = installFakeInvitationApi({ themeId: 'ethnic' })
    await useInvitationStore().ensureLoaded('w1')
    expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(0)
    expect(useThemeSelectionStore().selectedThemeId).toBe('ethnic')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('invalid stored id → remove the key without saving', async () => {
    localStorage.setItem(KEY, 'removed-theme')
    const api = installFakeInvitationApi({ themeId: null })
    await useInvitationStore().ensureLoaded('w1')
    expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(0)
    expect(useThemeSelectionStore().selectedThemeId).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('failed PATCH keeps the key so the next load retries', async () => {
    localStorage.setItem(KEY, 'international')
    const api = installFakeInvitationApi({ themeId: null })
    api.failNext('PATCH /invitations/w1', { status: 500 })
    await useInvitationStore().ensureLoaded('w1')
    expect(useInvitationStore().loadState).toBe('ready')
    expect(useThemeSelectionStore().selectedThemeId).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('international')

    setActivePinia(createPinia())
    await useInvitationStore().ensureLoaded('w1')
    expect(useThemeSelectionStore().selectedThemeId).toBe('international')
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
