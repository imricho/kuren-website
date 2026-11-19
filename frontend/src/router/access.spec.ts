import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ isAuthenticated: false, ensureLoaded: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => session }))

import router from './index'

// Navigation scroll is a browser concern; jsdom has no scrolling implementation.
vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

// Exercise the real route records and global guard without mounting CMS pages.
for (const record of router.getRoutes()) {
  if (record.components) record.components.default = { render: () => null }
}

describe('public and authenticated route access', () => {
  beforeEach(async () => {
    session.isAuthenticated = false
    session.ensureLoaded.mockClear()
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


describe('public sample preview and protected template handoff', () => {
  it('previews canonical and legacy samples without probing a session', async () => {
    session.isAuthenticated = false
    session.ensureLoaded.mockClear()
    await router.push('/themes/royal-maroon-v2/preview')
    expect(router.currentRoute.value.name).toBe('theme-preview')
    expect(router.currentRoute.value.meta.publicPage).toBe(true)
    expect(session.ensureLoaded).not.toHaveBeenCalled()
    await router.push('/templates')
    expect(router.currentRoute.value.name).toBe('public-templates')
    expect(session.ensureLoaded).not.toHaveBeenCalled()
  })

  it('preserves the chosen template through login and signed-in guest form redirects', async () => {
    session.isAuthenticated = false
    await router.push('/use-template/royal-maroon-v2')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/use-template/royal-maroon-v2')
    session.isAuthenticated = true
    await router.push('/register?redirect=%2Fuse-template%2Froyal-maroon-v2')
    expect(router.currentRoute.value.name).toBe('use-template')
    expect(router.currentRoute.value.params.templateId).toBe('royal-maroon-v2')
  })

  it('keeps saved wedding preview and CMS browsing private', async () => {
    session.isAuthenticated = false
    for (const path of ['/wedding/preview', '/themes', '/wedding/opening']) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe('login')
      expect(router.currentRoute.value.query.redirect).toBe(path)
    }
  })
})
