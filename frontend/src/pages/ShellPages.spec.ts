/**
 * Dashboard (hero + next step + first-run redirect), the welcome flow and
 * translated auth errors, mounted in a memory router like the app.
 */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import { markWelcomeSeen } from '@/features/shell/firstRun'
import type { WeddingDraft } from '@/features/wedding/draft'
import { useAuthStore } from '@/stores/auth'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import DashboardPage from './DashboardPage.vue'
import RegisterPage from './RegisterPage.vue'
import WelcomePage from './WelcomePage.vue'

enableAutoUnmount(afterEach)

const Stub = (name: string) => defineComponent({ name, render: () => h('div', { 'data-stub': name }) })

async function mountAt(path: string, content?: Partial<WeddingDraft>, themeId: string | null = null) {
  const api = installFakeWeddingApi({ content, themeId })
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = { id: 'u1', email: 'dewi@example.com', full_name: 'Dewi Lestari', created_at: '2026-01-01' }
  auth.initialized = true
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'dashboard', component: DashboardPage },
      { path: '/welcome', name: 'welcome', component: WelcomePage },
      { path: '/register', name: 'register', component: RegisterPage },
      { path: '/login', name: 'login', component: Stub('login') },
      { path: '/themes', name: 'themes', component: Stub('themes') },
      { path: '/wedding/preview', name: 'wedding-preview', component: Stub('preview') },
      ...['opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing'].map((s) => ({
        path: `/wedding/${s}`,
        name: `wedding-${s}`,
        component: Stub(s),
      })),
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

const started: Partial<WeddingDraft> = {
  opening: { weddingTitle: 'Pernikahan Rizky & Ayu', weddingDate: '2027-06-12' },
  couple: { groom: { name: 'Rizky Pratama' }, bride: { name: 'Ayu Lestari' } },
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppLocale().setLocale('en')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 15, 10))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the couple, the full date, a countdown and ONE next step', async () => {
    const { wrapper } = await mountAt('/dashboard', started)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('[data-testid="website-name"]').text()).toBe('Rizky & Ayu')
    expect(wrapper.get('[data-testid="wedding-date"]').text()).toMatch(/^Saturday,? 12 June 2027$/)
    expect(wrapper.get('[data-testid="countdown"]').text()).toBe('209 days to go')
    expect(wrapper.text()).toContain('of 6 required sections complete')
    // Theme is the first incomplete required section.
    expect(wrapper.get('[data-testid="next-step"]').attributes('data-step')).toBe('theme')
    expect(wrapper.get('[data-testid="next-step-action"]').text()).toContain('Choose your theme')
    // No unavailable features or per-row status pills.
    expect(wrapper.text()).not.toMatch(/Publishing|Not published|coming soon/i)
    expect(wrapper.text()).not.toContain('In progress')
  })

  it('moves the next step along as sections are completed, then offers the preview', async () => {
    const { wrapper } = await mountAt('/dashboard', started, 'international')
    expect(wrapper.get('[data-testid="next-step"]').attributes('data-step')).toBe('events')
    expect(wrapper.get('[data-testid="next-step-action"]').attributes('href')).toBe('/wedding/events')
    expect(wrapper.get('[data-section="events"]').attributes('data-state')).toBe('todo')
    expect(wrapper.get('[data-section="couple"]').attributes('data-state')).toBe('done')
    expect(wrapper.get('[data-section="story"]').attributes('data-state')).toBe('optional')

    const done = await mountAt(
      '/dashboard',
      {
        ...started,
        events: [{ id: 'e1', type: 'akad', title: 'Akad', date: '2027-06-12', startTime: '08:00', venueName: 'Masjid', address: 'Jl. Merdeka 1' }],
        rsvp: { enabled: true, title: 'RSVP' },
        closing: { message: 'Terima kasih' },
      },
      'international',
    )
    expect(done.wrapper.get('[data-testid="next-step"]').attributes('data-step')).toBe('preview')
    expect(done.wrapper.get('[data-testid="next-step-action"]').text()).toContain('Preview your website')
  })

  it('uses the UI language for the date and copy', async () => {
    useAppLocale().setLocale('id')
    const { wrapper } = await mountAt('/dashboard', started)
    expect(wrapper.get('[data-testid="wedding-date"]').text()).toMatch(/^Sabtu,? 12 Juni 2027$/)
    expect(wrapper.get('[data-testid="countdown"]').text()).toBe('209 hari lagi')
  })

  it('sends a fresh wedding to /welcome once', async () => {
    const first = await mountAt('/dashboard')
    expect(first.router.currentRoute.value.name).toBe('welcome')
    first.wrapper.unmount()

    const again = await mountAt('/dashboard')
    expect(again.router.currentRoute.value.name).toBe('dashboard')
    expect(again.wrapper.get('[data-testid="website-name"]').text()).toBe('Your wedding website')
  })

  it('does not redirect a wedding that has names or a date', async () => {
    const { router } = await mountAt('/dashboard', { opening: { weddingDate: '2027-06-12' } })
    expect(router.currentRoute.value.name).toBe('dashboard')
  })
})

describe('Welcome flow', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppLocale().setLocale('en')
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a step indicator with aria-current="step" and Indonesian example names', async () => {
    const { wrapper } = await mountAt('/welcome')
    expect(wrapper.get('[data-testid="welcome-step-of"]').text()).toBe('Step 1 of 3')
    const current = wrapper.findAll('[data-testid="welcome-steps"] li').filter((li) => li.attributes('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toBe('Names & date')
    expect(wrapper.get('#welcome-groom-name').attributes('placeholder')).toBe('e.g. Rizky Pratama')
    expect(wrapper.get('#welcome-bride-nickname').attributes('placeholder')).toBe('e.g. Ayu')
    expect(wrapper.html()).not.toMatch(/Alex|Sarah/)
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('step 1 saves names and date through the section APIs, then moves to the theme', async () => {
    const { wrapper, router, api } = await mountAt('/welcome')
    await wrapper.get('#welcome-groom-name').setValue('Rizky Pratama')
    await wrapper.get('#welcome-groom-nickname').setValue('Rizky')
    await wrapper.get('#welcome-bride-name').setValue('Ayu Lestari')
    await wrapper.get('#welcome-date').setValue('2027-06-12')
    await wrapper.get('[data-testid="welcome-names"]').trigger('submit')
    await flushPromises()

    expect(api.callsTo('PUT', '/weddings/w1/sections/couple')[0]!.body).toEqual({
      groom: { name: 'Rizky Pratama', nickname: 'Rizky' },
      bride: { name: 'Ayu Lestari' },
    })
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')[0]!.body).toEqual({ weddingDate: '2027-06-12' })
    expect(router.currentRoute.value.query.step).toBe('2')
    expect(wrapper.get('[data-testid="welcome-step-of"]').text()).toBe('Step 2 of 3')
    expect(document.activeElement?.tagName).toBe('H1')
  })

  it('shows a localized message when saving fails, and stays on the step', async () => {
    const { wrapper, router, api } = await mountAt('/welcome')
    api.failNext('PUT /weddings/w1/sections/couple', { status: 500, message: 'Internal Server Error' })
    await wrapper.get('#welcome-groom-name').setValue('Rizky')
    await wrapper.get('[data-testid="welcome-names"]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('We couldn’t save this step.')
    expect(wrapper.text()).not.toContain('Internal Server Error')
    expect(router.currentRoute.value.query.step).toBeUndefined()
  })

  it('every step can be skipped and goes back; step 2 saves the theme via the selection store', async () => {
    const { wrapper, router, api } = await mountAt('/welcome')
    await wrapper.get('[data-testid="welcome-skip"]').trigger('click')
    await flushPromises()
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
    expect(router.currentRoute.value.query.step).toBe('2')

    await wrapper.get('[data-testid="welcome-back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.step).toBe('1')
    await router.push({ query: { step: '2' } })
    await flushPromises()

    await wrapper.get('[data-theme="international"] input').setValue(true)
    await wrapper.get('[data-testid="welcome-theme"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PATCH', '/weddings/w1')[0]!.body).toEqual({ themeId: 'international' })
    expect(router.currentRoute.value.query.step).toBe('3')
    expect(wrapper.get('[data-testid="welcome-see-site"]').attributes('href')).toBe('/wedding/preview?from=/dashboard')
    expect(wrapper.get('[data-testid="welcome-dashboard"]').attributes('href')).toBe('/dashboard')
  })

  it('"Skip setup" always leads to the dashboard, and the dashboard won’t send the user back', async () => {
    const { wrapper, router } = await mountAt('/welcome')
    await wrapper.get('[data-testid="welcome-skip-all"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('resumes where the couple left off', async () => {
    markWelcomeSeen('u1')
    const { wrapper } = await mountAt('/welcome', started)
    expect(wrapper.get('[data-testid="welcome-step-of"]').text()).toBe('Step 2 of 3')
  })
})

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
