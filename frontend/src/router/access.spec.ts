import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installFakeInvitationApi } from '@/test/fakeInvitationApi'

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
    setActivePinia(createPinia())
    installFakeInvitationApi()
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
    expect(router.currentRoute.value.query.redirect).toBe('/invitations') // /dashboard redirects to the list
  })

  it('preserves nested CMS deep links including query and hash', async () => {
    await router.push('/wedding/events?edit=1#details')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/wedding/events?edit=1#details')
  })

  it('keeps the marketing page available to signed-in users', async () => {
    session.isAuthenticated = true
    await router.push('/dashboard')
    // /dashboard is the old address of the invitation list.
    expect(router.currentRoute.value.name).toBe('invitations')
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('home')
  })

  it('uses safe guest-form return destinations without redirect loops', async () => {
    session.isAuthenticated = true
    await router.push('/login?redirect=%2Fwedding%2Fevents%3Fedit%3D1')
    // …then the legacy URL redirects to the latest wedding invitation, keeping the query.
    expect(router.currentRoute.value.fullPath).toBe('/invitations/w1/edit/events?edit=1')
    await router.push('/login?redirect=https://evil.example')
    expect(router.currentRoute.value.name).toBe('invitations')
    await router.push('/login?redirect=%2Flogin')
    expect(router.currentRoute.value.name).toBe('invitations')
  })

  it('retains the existing guest-only login behavior and CMS child route', async () => {
    session.isAuthenticated = true
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('invitations')
    await router.push('/wedding/couple')
    expect(router.currentRoute.value.name).toBe('editor-couple')
    expect(router.currentRoute.value.params.id).toBe('w1')
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
      const edit = router.resolve(`/invitations/abc/edit/${section}`)
      expect(edit.name).toBe(`editor-${section}`)
      expect(edit.meta.requiresAuth).toBe(true)
      expect(edit.meta.layout).toBe('studio')
    }
    for (const section of ['profiles', 'milestone', 'organization', 'agenda', 'speakers']) {
      expect(router.resolve(`/invitations/abc/edit/${section}`).name).toBe(`editor-${section}`)
    }
    expect(router.resolve('/invitations').name).toBe('invitations')
    expect(router.resolve('/invitations/abc/preview').meta.requiresAuth).toBe(true)
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
    // "Use template" now opens the wizard with the template preselected (the redirect keeps it).
    expect(router.currentRoute.value.query.redirect).toBe('/invitations/new?template=royal-maroon-v2')
    session.isAuthenticated = true
    await router.push('/register?redirect=%2Fuse-template%2Froyal-maroon-v2')
    expect(router.currentRoute.value.name).toBe('invitation-new')
    expect(router.currentRoute.value.query.template).toBe('royal-maroon-v2')
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


describe('legacy /wedding/* redirects', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    session.isAuthenticated = true
    await router.push('/dashboard')
  })

  it('sends each legacy URL to the same page of the latest wedding invitation, keeping query and hash', async () => {
    installFakeInvitationApi({
      invitations: [
        { id: 'old', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'party', variant: 'birthday', updatedAt: '2026-03-01T00:00:00Z' },
        { id: 'latest', variant: 'wedding_reception', updatedAt: '2026-02-01T00:00:00Z' },
      ],
    })
    await router.push('/wedding/gifts?x=1#f-title')
    expect(router.currentRoute.value.fullPath).toBe('/invitations/latest/edit/gifts?x=1#f-title')
    await router.push('/wedding')
    expect(router.currentRoute.value.name).toBe('editor')
    expect(router.currentRoute.value.params.id).toBe('latest')
    await router.push('/wedding/preview?from=/dashboard')
    expect(router.currentRoute.value.fullPath).toBe('/invitations/latest/preview?from=/dashboard')
  })

  it('goes to /invitations when there is no wedding invitation (or the list fails)', async () => {
    const api = installFakeInvitationApi({ invitations: [{ id: 'party', variant: 'birthday' }] })
    await router.push('/wedding/opening')
    expect(router.currentRoute.value.name).toBe('invitations')
    await router.push('/dashboard')
    api.failNext('GET /invitations', { status: 500 })
    await router.push('/wedding/events')
    expect(router.currentRoute.value.name).toBe('invitations')
  })
})
