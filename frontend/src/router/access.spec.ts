import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ isAuthenticated: false, ensureLoaded: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => session }))

import router from './index'

// Exercise the real route records and global guard without mounting CMS pages.
for (const record of router.getRoutes()) {
  if (record.components) record.components.default = { render: () => null }
}

describe('public and authenticated route access', () => {
  beforeEach(async () => {
    session.isAuthenticated = false
    await router.push('/')
  })

  it('allows signed-out visitors to reach the public home and existing login', async () => {
    expect(router.currentRoute.value.name).toBe('home')
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('guards dashboard and preserves its return destination', async () => {
    await router.push('/dashboard')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/dashboard')
  })

  it('preserves nested CMS deep links including query and hash', async () => {
    await router.push('/wedding/events?edit=1#details')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/wedding/events?edit=1#details')
  })

  it('keeps the marketing page available to signed-in users', async () => {
    session.isAuthenticated = true
    await router.push('/dashboard')
    expect(router.currentRoute.value.name).toBe('dashboard')
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('uses safe guest-form return destinations without redirect loops', async () => {
    session.isAuthenticated = true
    await router.push('/login?redirect=%2Fwedding%2Fevents%3Fedit%3D1')
    expect(router.currentRoute.value.fullPath).toBe('/wedding/events?edit=1')
    await router.push('/login?redirect=https://evil.example')
    expect(router.currentRoute.value.name).toBe('dashboard')
    await router.push('/login?redirect=%2Flogin')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('retains the existing guest-only login behavior and CMS child route', async () => {
    session.isAuthenticated = true
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('dashboard')
    await router.push('/wedding/couple')
    expect(router.currentRoute.value.name).toBe('wedding-couple')
    expect(router.currentRoute.value.meta.requiresAuth).toBe(true)
  })
})


describe('working-directory CMS route preservation', () => {
  it('retains public invitation access and every newer CMS section', () => {
    expect(router.resolve('/i/example').meta.publicPage).toBe(true)
    for (const section of ['opening', 'couple', 'story', 'events', 'gallery', 'rsvp', 'closing', 'holy-recite-1', 'greeting', 'date', 'wishes', 'gifts', 'holy-recite-2', 'publish']) {
      const route = router.resolve(`/wedding/${section}`)
      expect(route.meta.requiresAuth).toBe(true)
      expect(route.meta.layout).toBe('studio')
      expect(route.name).not.toBe('not-found')
    }
  })
})
