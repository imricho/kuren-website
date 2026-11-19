import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import UseTemplatePage from './UseTemplatePage.vue'

const selection = vi.hoisted(() => ({ select: vi.fn() }))
vi.mock('@/stores/themeSelection', () => ({ useThemeSelectionStore: () => selection }))

async function page(templateId = 'royal-maroon-v2') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'account-a', email: 'a@example.invalid', full_name: 'A Couple', created_at: '2026-01-01' }
  const empty = { template: '<div />' }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/use-template/:templateId', name: 'use-template', component: empty },
    { path: '/wedding/opening', name: 'wedding-opening', component: empty },
    { path: '/templates', name: 'public-templates', component: empty },
  ] })
  await router.push(`/use-template/${templateId}`)
  const wrapper = mount(UseTemplatePage, { global: { plugins: [pinia, router] } })
  return { wrapper, router, auth }
}

describe('template handoff', () => {
  beforeEach(() => { selection.select.mockReset() })
  afterEach(() => vi.restoreAllMocks())

  it('waits for confirmed selection before opening the editor', async () => {
    let finish!: (success: boolean) => void
    selection.select.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve }))
    const { wrapper, router } = await page()
    expect(selection.select).toHaveBeenCalledExactlyOnceWith('royal-maroon-v2')
    expect(wrapper.get('[role=status]').text()).toContain('Menyimpan')
    expect(router.currentRoute.value.name).toBe('use-template')
    finish(true)
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding-opening')
    wrapper.unmount()
  })

  it('offers retry after failure and only opens the editor after success', async () => {
    selection.select.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const { wrapper, router } = await page()
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('belum berhasil')
    expect(router.currentRoute.value.name).toBe('use-template')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(selection.select).toHaveBeenCalledTimes(2)
    expect(router.currentRoute.value.name).toBe('wedding-opening')
    wrapper.unmount()
  })

  it.each(['unknown-template', 'bali-draft'])('does not write an unavailable template %s', async id => {
    const { wrapper } = await page(id)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Template tidak tersedia')
    expect(selection.select).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not navigate or restart a selection after the account changes', async () => {
    let finish!: (success: boolean) => void
    selection.select.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve }))
    const { wrapper, router, auth } = await page()
    auth.user = { ...auth.user!, id: 'account-b' }
    await flushPromises()
    finish(true)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Akun telah berubah')
    expect(router.currentRoute.value.name).toBe('use-template')
    expect(selection.select).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('does not navigate when an abandoned request completes', async () => {
    let finish!: (success: boolean) => void
    selection.select.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve }))
    const { wrapper, router } = await page()
    wrapper.unmount()
    await router.push('/templates')
    finish(true)
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('public-templates')
  })
})
