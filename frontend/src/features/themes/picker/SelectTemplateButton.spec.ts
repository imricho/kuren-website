import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import SelectTemplateButton from './SelectTemplateButton.vue'

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

  const mountButton = () =>
    mount(SelectTemplateButton, { props: { templateId: 'ethnic', templateName: 'Woven Indigo' }, attachTo: document.body })

  it('is busy while saving and reads "Selected" once the server confirms', async () => {
    const api = installFakeWeddingApi()
    await useWeddingStore().ensureLoaded()
    const wrapper = mountButton()
    const button = wrapper.get('[data-action="select"]')
    api.holdResponses()
    await button.trigger('click')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toBe('Saving…')
    api.release()
    await flushPromises()
    expect(button.attributes('aria-busy')).toBeUndefined()
    expect(button.text()).toBe('Selected')
    expect(button.attributes('aria-disabled')).toBe('true')
  })

  it('shows an error and can retry', async () => {
    const api = installFakeWeddingApi()
    await useWeddingStore().ensureLoaded()
    const wrapper = mountButton()
    api.failNext('PATCH /weddings/w1', { status: 500, message: 'Down' })
    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    const error = wrapper.get('[data-testid="select-error"]')
    expect(error.text()).toBe('Not saved — try again')
    expect(wrapper.get('[data-action="select"]').attributes('aria-describedby')).toBe(error.attributes('id'))
    expect(useToast().toasts.value[0]).toMatchObject({ tone: 'error', message: 'Couldn’t save Woven Indigo as your theme. Please try again.' })

    await wrapper.get('[data-action="select"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="select-error"]').exists()).toBe(false)
    expect(wrapper.get('[data-action="select"]').text()).toBe('Selected')
  })
})
