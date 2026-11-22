/**
 * Translated auth errors, mounted in a memory router like the app. (The wedding
 * dashboard and welcome flow were replaced by the invitation list and wizard.)
 */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import type { WeddingDraft } from '@/features/wedding/draft'
import { useAuthStore } from '@/stores/auth'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'

import RegisterPage from './RegisterPage.vue'

enableAutoUnmount(afterEach)

const Stub = (name: string) => defineComponent({ name, render: () => h('div', { 'data-stub': name }) })

async function mountAt(path: string, content?: Partial<WeddingDraft>, themeId: string | null = null) {
  const api = installFakeInvitationApi({ content, themeId })
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'u1', email: 'dewi@example.com', full_name: 'Dewi Lestari', created_at: '2026-01-01' }
  auth.initialized = true
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/register', name: 'register', component: RegisterPage },
      { path: '/login', name: 'login', component: Stub('login') },
      { path: '/themes', name: 'themes', component: Stub('themes') },
      { path: '/wedding/preview', name: 'wedding-preview', component: Stub('preview') },
      ...[
        'opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing',
        'holy-recite-1', 'greeting', 'date', 'wishes', 'gifts', 'holy-recite-2', 'publish',
      ].flatMap((s) => [
        { path: `/wedding/${s}`, name: `wedding-${s}`, component: Stub(s) },
        { path: `/invitations/:id/edit/${s}`, name: `editor-${s}`, component: Stub(s) },
      ]),
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(defineComponent({ render: () => h('main', [h(RouterView)]) }), {
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router, api }
}

describe('Register errors', () => {
  beforeEach(() => useAppLocale().setLocale('id'))
  afterEach(() => {
    useAppLocale().setLocale('en')
    vi.restoreAllMocks()
  })

  it('shows localized messages instead of raw Pydantic text', async () => {
    const { wrapper } = await mountAt('/register')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'validation_error',
            message: 'Some fields are invalid.',
            details: [
              { field: 'email', message: 'value is not a valid email address: An email address must have an @-sign.' },
              { field: 'password', message: 'String should have at least 8 characters' },
            ],
          },
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Masukkan alamat email yang valid')
    expect(wrapper.text()).toContain('Gunakan minimal 8 karakter.')
    expect(wrapper.text()).not.toMatch(/String should|valid email address/)
  })
})
