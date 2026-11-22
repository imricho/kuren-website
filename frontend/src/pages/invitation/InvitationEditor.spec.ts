/**
 * The editor under /invitations/:id/edit/:section: loads by id, follows the
 * variant's section offering, and switches invitations in place.
 */
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mountApp } from '@/test/mountApp'

enableAutoUnmount(afterEach)

const invitations = () => [
  { id: 'w1', themeId: 'ethnic', content: { opening: { weddingTitle: 'Our wedding' } } },
  { id: 'b1', variant: 'birthday' as const, themeId: 'temuvibe-festive', content: { opening: { weddingTitle: 'Nadia turns 30', weddingDate: '2027-02-14' } } },
]

describe('invitation editor routes', () => {
  beforeEach(() => {
    localStorage.clear()
    window.scrollTo = vi.fn() as never
  })
  afterEach(() => vi.restoreAllMocks())

  it('drives the section nav from the variant and opens the new section pages', async () => {
    installFakeInvitationApi({ invitations: invitations() })
    const { wrapper, router } = await mountApp('/invitations/b1/edit/profiles')
    expect(router.currentRoute.value.name).toBe('editor-profiles')
    expect(wrapper.find('[data-testid="profiles-form"]').exists()).toBe(true)
    const nav = wrapper.get('[data-testid="section-nav"]')
    expect(nav.findAll('[role="tab"]').map((t) => t.attributes('data-group'))).toEqual(['wedding', 'events', 'moments', 'guests', 'finishing'])
    expect(nav.get('[role="tab"][data-group="wedding"]').text()).toBe('Invitation')
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['opening', 'profiles', 'milestone', 'weddingDate'])
    expect(nav.get('a[data-section="profiles"]').attributes('href')).toBe('/invitations/b1/edit/profiles')
  })

  it('redirects a section the variant does not offer to the first section to complete', async () => {
    installFakeInvitationApi({ invitations: invitations() })
    const { router } = await mountApp('/invitations/b1/edit/couple')
    // Opening still needs the display name.
    expect(router.currentRoute.value.name).toBe('editor-opening')
    expect(router.currentRoute.value.params.id).toBe('b1')
  })

  it('switches to another invitation in place and edits it', async () => {
    const api = installFakeInvitationApi({ invitations: invitations() })
    const { wrapper, router } = await mountApp('/invitations/w1/edit/opening')
    expect((wrapper.get('#f-weddingTitle').element as HTMLInputElement).value).toBe('Our wedding')
    await router.push('/invitations/b1/edit/opening')
    await flushPromises()
    expect(useInvitationStore().record?.id).toBe('b1')
    expect((wrapper.get('#f-weddingTitle').element as HTMLInputElement).value).toBe('Nadia turns 30')
    expect(api.callsTo('GET', '/invitations/b1/content')).toHaveLength(1)
  })

  it('shows the load error for an unknown invitation', async () => {
    installFakeInvitationApi({ invitations: invitations() })
    const { wrapper } = await mountApp('/invitations/nope/edit/opening')
    expect(wrapper.find('[data-action="retry"]').exists()).toBe(true)
    expect(useInvitationStore().notFound).toBe(true)
  })

  it('legacy /wedding/* lands on the latest wedding invitation', async () => {
    installFakeInvitationApi({ invitations: invitations() })
    const { router } = await mountApp('/wedding/closing#f-message')
    expect(router.currentRoute.value.fullPath).toBe('/invitations/w1/edit/closing#f-message')
  })
})
