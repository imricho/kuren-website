import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import SelectTemplateButton from './SelectTemplateButton.vue'
import * as registry from '../core/registry'

enableAutoUnmount(afterEach)

describe('SelectTemplateButton', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    useToast().clear()
    vi.restoreAllMocks()
  })

  let router: ReturnType<typeof createRouter>
  const mountButton = async (templateId = 'ethnic') => {
    router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/themes', name: 'themes', component: { template: '<div />' } },
      { path: '/wedding', name: 'wedding', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    ] })
    await router.push('/themes')
    await router.isReady()
    return mount(SelectTemplateButton, {
      props: { templateId, templateName: 'Woven Indigo' },
      global: { plugins: [router] }, attachTo: document.body,
    })
  }

  it('opens Edit only once the server confirms, preserving Back history', async () => {
    const api = installFakeWeddingApi()
    await useWeddingStore().ensureLoaded()
    const wrapper = await mountButton()
    const button = wrapper.get('[data-action="select"]')
    api.holdResponses()
    await button.trigger('click')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('Saving…')
    expect(router.currentRoute.value.name).toBe('themes')
    api.release()
    await flushPromises()
    expect(button.attributes('aria-busy')).toBeUndefined()
    expect(button.text()).toBe('Edit')
    expect(router.currentRoute.value.name).toBe('wedding')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('themes'))
  })

  it('shows an error and can retry', async () => {
    const api = installFakeWeddingApi()
    await useWeddingStore().ensureLoaded()
    const wrapper = await mountButton()
    api.failNext('PATCH /weddings/w1', { status: 500, message: 'Down' })
    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    const error = wrapper.get('[data-testid="select-error"]')
    expect(error.text()).toBe('Not saved — try again')
    expect(router.currentRoute.value.name).toBe('themes')
    expect(wrapper.get('[data-action="select"]').attributes('aria-describedby')).toBe(error.attributes('id'))
    expect(useToast().toasts.value[0]).toMatchObject({ tone: 'error', message: 'Couldn’t save Woven Indigo as your theme. Please try again.' })

    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="select-error"]').exists()).toBe(false)
    expect(wrapper.get('[data-action="select"]').text()).toBe('Edit')
    expect(router.currentRoute.value.name).toBe('wedding')
  })
  it('keeps draft templates preview-only without saving or navigating', async () => {
    const api = installFakeWeddingApi()
    const draft = { ...registry.getTheme('ethnic')!, status: 'draft' as const }
    vi.spyOn(registry, 'getTheme').mockReturnValue(draft)
    const wrapper = await mountButton()
    expect(wrapper.find('[data-action="select"]').exists()).toBe(false)
    expect(wrapper.get('[data-action="draft-not-selectable"]').attributes('role')).toBe('note')
    expect(api.calls).toHaveLength(0)
    expect(router.currentRoute.value.name).toBe('themes')
  })

  it('reopens an already selected template without rewriting the wedding or content', async () => {
    const api = installFakeWeddingApi({ themeId: 'ethnic' })
    const wedding = useWeddingStore()
    await wedding.ensureLoaded()
    const content = JSON.stringify(wedding.content)
    const wrapper = await mountButton()
    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding')
    expect(api.callsTo('PATCH', '/weddings/w1')).toHaveLength(0)
    expect(JSON.stringify(wedding.content)).toBe(content)
  })

  it('does not redirect someone who browsed away during a save', async () => {
    const api = installFakeWeddingApi()
    await useWeddingStore().ensureLoaded()
    const wrapper = await mountButton()
    api.holdResponses()
    await wrapper.get('[data-action="select"]').trigger('click')
    await router.push('/dashboard')
    api.release()
    await flushPromises()
    expect(useWeddingStore().themeId).toBe('ethnic')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('keeps a saved selection retryable if navigation is blocked', async () => {
    installFakeWeddingApi()
    const wrapper = await mountButton()
    const removeGuard = router.beforeEach(to => to.name === 'wedding' ? false : undefined)
    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    expect(useWeddingStore().themeId).toBe('ethnic')
    expect(wrapper.get('[role="alert"]').text()).toContain('saved')
    expect(router.currentRoute.value.name).toBe('themes')
    removeGuard()
    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding')
  })
})
