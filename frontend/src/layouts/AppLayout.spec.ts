import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import AppLayout from './AppLayout.vue'

enableAutoUnmount(afterEach)

const Page = defineComponent({ render: () => h('p', 'page') })

async function setup() {
  installFakeWeddingApi()
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'u1', email: 'dewi@example.com', full_name: 'Dewi Lestari', created_at: '2026-01-01' }
  auth.initialized = true
  const logout = vi.spyOn(authApi, 'logout').mockResolvedValue(undefined as never)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: AppLayout,
        children: [
          { path: 'dashboard', name: 'dashboard', component: Page },
          { path: 'wedding', name: 'wedding', component: Page },
          { path: 'themes', name: 'themes', component: Page },
          { path: 'account', name: 'account', component: Page },
        ],
      },
      { path: '/login', name: 'login', component: Page },
    ],
  })
  await router.push('/wedding')
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h(RouterView) }), { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router, auth, logout }
}

const menuButton = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) => wrapper.get('[data-testid="account-menu-button"]')
async function openMenu(wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) {
  await menuButton(wrapper).trigger('click')
  await flushPromises()
}
const signOutButton = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) =>
  wrapper.get('[data-testid="account-menu"]').findAll('button').find((b) => b.text() === 'Sign out')!

describe('AppLayout', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('highlights "My website" on /wedding pages', async () => {
    const { wrapper } = await setup()
    expect(wrapper.get('[data-testid="main-nav"] a[aria-current="page"]').text()).toBe('My website')
  })

  it('names the brand link after the brand', async () => {
    const { wrapper } = await setup()
    expect(wrapper.get('header a').attributes('aria-label')).toBe('Kuren')
  })

  describe('account menu', () => {
    it('is a disclosure: aria-expanded/aria-controls, focus moves into the panel', async () => {
      const { wrapper } = await setup()
      const button = menuButton(wrapper)
      expect(button.attributes('aria-expanded')).toBe('false')
      expect(button.attributes('aria-label')).toBe('Menu for Dewi Lestari')
      const panel = wrapper.get(`#${button.attributes('aria-controls')}`)
      expect(panel.isVisible()).toBe(false)

      await openMenu(wrapper)
      expect(button.attributes('aria-expanded')).toBe('true')
      expect(panel.isVisible()).toBe(true)
      expect(panel.element.contains(document.activeElement)).toBe(true)
    })

    it('holds the nav links, language switch and sign out on phones', async () => {
      const { wrapper } = await setup()
      await openMenu(wrapper)
      const panel = wrapper.get('[data-testid="account-menu"]')
      expect(panel.findAll('nav a').map((a) => a.text())).toEqual(['Dashboard', 'My website', 'Themes', 'Account'])
      expect(panel.get('nav a[aria-current="page"]').text()).toBe('My website')
      expect(panel.find('[role="group"][aria-label="Language"]').exists()).toBe(true)
      expect(signOutButton(wrapper).exists()).toBe(true)
    })

    it('Escape closes it and returns focus to the button', async () => {
      const { wrapper } = await setup()
      await openMenu(wrapper)
      const focused = document.activeElement as HTMLElement
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()
      expect(menuButton(wrapper).attributes('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(menuButton(wrapper).element)
    })

    it('closes on a click outside', async () => {
      const { wrapper } = await setup()
      await openMenu(wrapper)
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      await flushPromises()
      expect(menuButton(wrapper).attributes('aria-expanded')).toBe('false')
    })

    it('closes after following a link', async () => {
      const { wrapper, router } = await setup()
      await openMenu(wrapper)
      await wrapper.get('[data-testid="account-menu"] nav a').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.name).toBe('dashboard')
      expect(menuButton(wrapper).attributes('aria-expanded')).toBe('false')
    })
  })

  it('language buttons have accessible names that contain their visible text', async () => {
    const { wrapper } = await setup()
    await openMenu(wrapper)
    for (const b of wrapper.get('[data-testid="account-menu"] [role="group"]').findAll('button'))
      expect(b.attributes('aria-label')).toContain(b.text())
  })

  it('asks before signing out with unsaved changes; "Keep editing" stays signed in', async () => {
    const { wrapper, router, auth, logout } = await setup()
    const wedding = useWeddingStore()
    wedding.setDirty('opening', true)
    await openMenu(wrapper)
    await signOutButton(wrapper).trigger('click')
    await flushPromises()
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain('Sign out with unsaved changes?')
    await dialog.get('[data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(logout).not.toHaveBeenCalled()
    expect(auth.isAuthenticated).toBe(true)
    expect(wedding.anyDirty).toBe(true)

    await openMenu(wrapper)
    await signOutButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(logout).toHaveBeenCalledTimes(1)
    expect(auth.isAuthenticated).toBe(false)
    expect(wedding.content).toBeNull() // reset when the user changed
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('signs out straight away when nothing is unsaved', async () => {
    const { wrapper, logout } = await setup()
    await openMenu(wrapper)
    await signOutButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
