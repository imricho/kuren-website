/** Interrupted-session recovery: the device copy, and how a section draft offers it. */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useAuthStore } from '@/stores/auth'
import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'

import { useSectionDraft } from './composables/useSectionDraft'
import { clearRecoveries, listRecoveries, loadRecovery, RECOVERY_MAX_AGE_MS, saveRecovery } from './draftRecovery'
import { closingForm, closingPayload } from './forms'
import { validateClosing } from './validation'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('draftRecovery storage', () => {
  it('scopes entries to user + invitation, lists newest first, expires and clears', () => {
    saveRecovery('u1', 'w1', 'opening', { form: { a: 1 }, baseline: '{}', at: 1000 })
    saveRecovery('u1', 'w1', 'events:e1', { form: { a: 2 }, baseline: '{}', at: 2000 })
    saveRecovery('u2', 'w1', 'opening', { form: { a: 3 }, baseline: '{}', at: 3000 })
    expect(listRecoveries('u1', 'w1', 5000).map((e) => e.key)).toEqual(['events:e1', 'opening'])
    expect(listRecoveries('u2', 'w1', 5000).map((e) => e.key)).toEqual(['opening'])
    expect(loadRecovery('u1', 'w1', 'opening', 1000 + RECOVERY_MAX_AGE_MS + 1)).toBeNull() // expired and removed
    clearRecoveries({ invitationId: 'w1' })
    expect(listRecoveries('u2', 'w1', 5000)).toEqual([])
    saveRecovery('u1', 'w9', 'closing', { form: { a: 1 }, baseline: '{}', at: 1 })
    clearRecoveries()
    expect(localStorage.length).toBe(0)
  })

  it('ignores corrupted entries', () => {
    localStorage.setItem('temuvibe.recovery.v1.u1.w1.opening', '{not json')
    localStorage.setItem('temuvibe.recovery.v1.u1.w1.closing', JSON.stringify({ at: 'x' }))
    expect(listRecoveries('u1', 'w1')).toEqual([])
  })
})

async function mountDraft(user = 'u1') {
  installFakeInvitationApi({ content: { closing: { message: 'Saved message' } } })
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = { id: user, email: `${user}@example.com`, full_name: 'Test', created_at: '' }
  const store = useInvitationStore()
  await store.ensureLoaded('w1')
  let draft!: ReturnType<typeof useSectionDraft<ReturnType<typeof closingForm>, ReturnType<typeof closingPayload>>>
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = useSectionDraft({
          key: 'closing',
          source: () => closingForm(store.content!.closing),
          toPayload: closingPayload,
          validate: validateClosing,
          save: async (payload) => void (await store.saveSection('closing', payload)),
        })
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } },
  )
  return { store, draft: () => draft, wrapper }
}

describe('useSectionDraft recovery', () => {
  it('keeps unsaved edits on the device until saved, then forgets them', async () => {
    vi.useFakeTimers()
    const { draft } = await mountDraft()
    draft().form.value.message = 'Typed but not saved yet'
    await flushPromises()
    expect(loadRecovery('u1', 'w1', 'closing')?.form).toMatchObject({ message: 'Typed but not saved yet' })
    await vi.advanceTimersByTimeAsync(1500) // autosave
    await flushPromises()
    expect(loadRecovery('u1', 'w1', 'closing')).toBeNull()
  })

  it('an interrupted session is offered on the next visit; Restore puts it back and saves it', async () => {
    saveRecovery('u1', 'w1', 'closing', { form: { message: 'Lost when the tab closed' }, baseline: JSON.stringify({ message: 'Saved message' }), at: Date.now() })
    const { store, draft } = await mountDraft()
    const handle = store.recoveryHandles.get('closing')!
    expect(handle).toBeTruthy()
    expect(handle.stale).toBe(false)
    expect(draft().form.value.message).toBe('Saved message') // never applied silently
    vi.useFakeTimers()
    handle.restore()
    await flushPromises()
    expect(draft().form.value.message).toBe('Lost when the tab closed')
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(store.content!.closing.message).toBe('Lost when the tab closed')
    expect(loadRecovery('u1', 'w1', 'closing')).toBeNull()
    expect(store.recoveryHandles.has('closing')).toBe(false)
  })

  it('Discard keeps the server value and removes the device copy', async () => {
    saveRecovery('u1', 'w1', 'closing', { form: { message: 'Old local edit' }, baseline: '"other"', at: Date.now() })
    const { store, draft } = await mountDraft()
    const handle = store.recoveryHandles.get('closing')!
    expect(handle.stale).toBe(true) // the server moved on since
    handle.discard()
    await flushPromises()
    expect(draft().form.value.message).toBe('Saved message')
    expect(loadRecovery('u1', 'w1', 'closing')).toBeNull()
  })

  it('an entry that already matches the server is removed silently; other users never see one', async () => {
    saveRecovery('u1', 'w1', 'closing', { form: { message: 'Saved message' }, baseline: '{}', at: Date.now() })
    const { store } = await mountDraft()
    expect(store.recoveryHandles.size).toBe(0)
    expect(loadRecovery('u1', 'w1', 'closing')).toBeNull()

    saveRecovery('u1', 'w1', 'closing', { form: { message: 'Mine' }, baseline: '{}', at: Date.now() })
    const other = await mountDraft('u2')
    expect(other.store.recoveryHandles.size).toBe(0)
  })

  it('sign-out removes every device copy', async () => {
    saveRecovery('u1', 'w1', 'closing', { form: { message: 'x' }, baseline: '{}', at: Date.now() })
    await mountDraft()
    await useAuthStore().logout().catch(() => undefined)
    expect(listRecoveries('u1', 'w1')).toEqual([])
  })
})
