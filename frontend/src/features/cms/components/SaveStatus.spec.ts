import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import { closingForm, closingPayload } from '../forms'
import { useSectionDraft } from '../composables/useSectionDraft'
import ConfirmHost from './ConfirmHost.vue'
import ConflictBanner from './ConflictBanner.vue'
import SaveStatus from './SaveStatus.vue'

enableAutoUnmount(afterEach)

async function setup(options: { banner?: boolean; twice?: boolean } = {}) {
  const api = installFakeWeddingApi({ content: { closing: { message: 'Saved' } } })
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useWeddingStore()
  await store.ensureLoaded()
  let draft!: ReturnType<typeof useSectionDraft<ReturnType<typeof closingForm>, ReturnType<typeof closingPayload>>>
  const Editor = defineComponent({
    setup() {
      draft = useSectionDraft({
        key: 'closing',
        source: () => closingForm(store.content!.closing),
        toPayload: closingPayload,
        save: async (payload) => void (await store.saveSection('closing', payload)),
        live: (value) => ({ kind: 'section', section: 'closing', value }),
      })
      return () => null
    },
  })
  const wrapper = mount(
    defineComponent({
      render: () => [
        h(SaveStatus),
        options.twice ? h(SaveStatus) : null,
        options.banner ? h(ConflictBanner) : null,
        h(Editor),
        h(ConfirmHost),
      ],
    }),
    { global: { plugins: [pinia] }, attachTo: document.body },
  )
  const status = () => wrapper.get('[data-testid="save-status"]')
  const live = () => document.querySelectorAll('[data-testid="save-status-live"]')
  return { api, store, wrapper, status, live, draft: () => draft }
}

describe('SaveStatus', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    useToast().clear()
    useAppLocale().setLocale('en')
    vi.restoreAllMocks()
  })

  it('shows the state with full and short text; the text itself is not a live region', async () => {
    const { status, draft } = await setup()
    expect(status().attributes('data-state')).toBe('saved')
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('All changes saved')
    expect(status().text()).toContain('Saved') // short word for 320px
    expect(status().find('[aria-live], [role="status"]').exists()).toBe(false)
    expect(status().find('button').exists()).toBe(false)

    draft().form.value.message = 'New'
    await flushPromises()
    expect(status().attributes('data-state')).toBe('unsaved')
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Unsaved changes')
    expect(status().get('[data-action="save-now"]').text()).toBe('Save now')
  })

  it('Save now saves immediately and announces "All changes saved" politely (once)', async () => {
    const { status, draft, api, live } = await setup({ twice: true })
    expect(live()).toHaveLength(1) // one region, even with two status instances
    draft().form.value.message = 'New'
    await flushPromises()
    await status().get('[data-action="save-now"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('PUT', '/weddings/w1/sections/closing')).toHaveLength(1)
    expect(status().attributes('data-state')).toBe('saved')
    expect(live()[0]!.textContent).toBe('All changes saved')
    expect(live()[0]!.getAttribute('aria-live')).toBe('polite')
  })

  it('an autosave success is not announced', async () => {
    const { draft, live } = await setup()
    draft().form.value.message = 'New'
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(live()[0]!.textContent).toBe('')
  })

  it('Ctrl/Cmd+S saves right away instead of the browser dialog', async () => {
    const { draft, api } = await setup({ twice: true })
    draft().form.value.message = 'New'
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true })
    window.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(api.callsTo('PUT', '/weddings/w1/sections/closing')).toHaveLength(1) // once, not per instance
  })

  it('Failed → Retry, announced', async () => {
    const { status, draft, api, live } = await setup()
    api.failNext('PUT /weddings/w1/sections/closing', { status: 400, message: 'Bad' })
    draft().form.value.message = 'New'
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(status().attributes('data-state')).toBe('failed')
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Couldn’t save')
    expect(live()[0]!.textContent).toBe('Couldn’t save')
    await status().get('[data-action="retry-save"]').trigger('click')
    await flushPromises()
    expect(status().attributes('data-state')).toBe('saved')
    expect(live()[0]!.textContent).toBe('All changes saved')
  })

  it('Offline copy and announcement', async () => {
    const { status, draft, live } = await setup()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    draft().form.value.message = 'New'
    await flushPromises()
    expect(status().attributes('data-state')).toBe('offline')
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Offline — saves when you reconnect')
    expect(live()[0]!.textContent).toBe('Offline — saves when you reconnect')
  })

  it('Conflict: the banner (role="alert") holds Reload latest / Keep mine; Reload asks first', async () => {
    const { status, draft, api, wrapper, store } = await setup({ banner: true })
    api.editElsewhere((c) => (c.closing = { message: 'Theirs' }))
    draft().form.value.message = 'Mine'
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(status().attributes('data-state')).toBe('conflict')
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Edited on another device')
    expect(status().find('[data-action="reload-latest"]').exists()).toBe(false) // in the banner instead
    const banner = wrapper.get('[data-testid="conflict-banner"]')
    expect(banner.attributes('role')).toBe('alert')
    expect(banner.get('[data-action="reload-latest"]').text()).toBe('Reload latest')
    expect(banner.get('[data-action="keep-mine"]').text()).toBe('Keep mine')

    await banner.get('[data-action="reload-latest"]').trigger('click')
    await flushPromises()
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain('Reload the latest version?')
    await dialog.get('[data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(store.saveState).toBe('conflict')
    expect(draft().form.value.message).toBe('Mine')

    await wrapper.get('[data-testid="conflict-banner"] [data-action="reload-latest"]').trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(store.saveState).toBe('saved')
    expect(draft().form.value.message).toBe('Theirs')
    expect(wrapper.find('[data-testid="conflict-banner"]').exists()).toBe(false)
  })

  it('Conflict without a banner: the status itself offers the actions; Keep mine saves over', async () => {
    const { status, draft, api } = await setup()
    api.editElsewhere()
    draft().form.value.message = 'Mine'
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    const keep = status().get('[data-action="keep-mine"]')
    ;(keep.element as HTMLElement).focus()
    await keep.trigger('click')
    await flushPromises()
    // Overwriting the other version is confirmed first (WCAG 3.3.4).
    expect(document.querySelector('dialog')?.textContent).toContain('Replace the other version?')
    ;(document.querySelector('dialog [data-action="confirm"]') as HTMLElement).click()
    await flushPromises()
    expect(api.state.content.closing.message).toBe('Mine')
    expect(status().attributes('data-state')).toBe('saved')
    // The clicked button is gone; focus lands on the status text, not <body> (WCAG 2.4.3).
    expect(document.activeElement?.hasAttribute('data-save-status-anchor')).toBe(true)
  })

  it('speaks Indonesian', async () => {
    useAppLocale().setLocale('id')
    const { status, draft } = await setup()
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Semua perubahan tersimpan')
    expect(status().text()).toContain('Tersimpan')
    draft().form.value.message = 'Baru'
    await flushPromises()
    expect(status().get('[data-testid="save-status-text"]').text()).toBe('Ada perubahan belum tersimpan')
    expect(status().get('[data-action="save-now"]').text()).toBe('Simpan sekarang')
  })
})
