import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { allPlaceholderTexts } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mountApp } from '@/test/mountApp'
import { publishableDraft } from '@/test/publishFixture'

enableAutoUnmount(afterEach)

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as never
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove())
})
afterEach(() => vi.restoreAllMocks())

async function publishThenVisit(path: string, edit?: Parameters<ReturnType<typeof installFakeInvitationApi>['editElsewhere']>[0]) {
  const draft = publishableDraft()
  draft.opening.guestGreeting = { enabled: true, label: 'Kepada Yth.' }
  draft.amplopDigital = { enabled: true, bankAccountsEnabled: false, bankAccounts: [{ bankName: 'BCA', accountHolder: 'A', accountNumber: '5550001' }], qrisEnabled: false, physicalGifts: { enabled: true, recipient: 'Alex', address: 'Jl. Mawar 2' } }
  const api = installFakeInvitationApi({ themeId: 'ethnic', content: draft })
  const owner = await mountApp('/wedding/publish')
  await useInvitationStore().publish()
  owner.wrapper.unmount()
  if (edit) api.editElsewhere(edit) // a later draft edit must NOT reach guests
  const app = await mountApp(path)
  await vi.waitFor(() => expect(app.wrapper.find('[data-testid="public-invitation"] .wedding-site > article').exists()).toBe(true))
  return { api, ...app }
}

describe('public invitation page', () => {
  it('renders the published snapshot only, in public mode, with noindex and the couple as title', async () => {
    const { api, wrapper } = await publishThenVisit('/i/alex-sarah-abc123?to=Budi%20Santoso%E2%80%AE', (c) => {
      c.closing.message = 'DRAFT ONLY MESSAGE'
    })
    const page = wrapper.get('[data-testid="public-invitation"]')
    expect(page.get('.wedding-site').attributes('data-render-mode')).toBe('public')
    expect(page.text()).toContain('Thank you for celebrating with us.')
    expect(page.text()).not.toContain('DRAFT ONLY MESSAGE')
    for (const p of allPlaceholderTexts().filter((x) => x !== 'RSVP')) expect(page.text()).not.toContain(p)
    // Disabled bank transfers never show account numbers.
    expect(page.text()).not.toContain('5550001')
    expect(page.text()).toContain('Jl. Mawar 2')
    // No editor UI; the only form is the live guest RSVP form (prefilled from ?to=).
    expect(page.find('[data-editor-only]').exists()).toBe(false)
    expect(page.find('fieldset[disabled]').exists()).toBe(false)
    const rsvp = page.get('[data-section="rsvp"]')
    expect(page.findAll('form, input, textarea').every((el) => rsvp.element.contains(el.element))).toBe(true)
    expect(rsvp.get<HTMLInputElement>('[data-testid="rsvp-form"] input[name="name"]').element.value).toBe('Budi Santoso')
    expect(wrapper.find('[data-testid="editor-layout"]').exists()).toBe(false)
    // Guest name from ?to=, sanitised.
    expect(page.get('[data-testid="guest-greeting"]').text()).toBe('Kepada Yth. Budi Santoso')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    await vi.waitFor(() => expect(document.title).toBe('Alex & Sarah'))
    const get = api.callsTo('GET', '/public/invitations/alex-sarah-abc123')
    expect(get).toHaveLength(1)
    // The hero heading is the page's h1 (not embedded).
    expect(page.find('h1:not([aria-level])').exists()).toBe(true)
  })

  it('shows a friendly 404 for unknown or unpublished invitations', async () => {
    installFakeInvitationApi({ themeId: 'ethnic', content: publishableDraft() })
    const { wrapper } = await mountApp('/i/nope-000000')
    await flushPromises()
    const nf = wrapper.get('[data-testid="public-not-found"]')
    expect(nf.get('h1').text()).toBe('This invitation isn’t available')
    expect(wrapper.find('.wedding-site').exists()).toBe(false)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
  })

  it('offers a retry when loading fails (e.g. rate limited)', async () => {
    const api = installFakeInvitationApi({ themeId: 'ethnic', content: publishableDraft() })
    api.failNext('GET /public/invitations/x-1', { status: 429, code: 'too_many_requests' })
    const { wrapper } = await mountApp('/i/x-1')
    await flushPromises()
    expect(wrapper.get('[data-testid="public-error"]').text()).toContain('couldn’t load this invitation')
    await wrapper.get('[data-action="public-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="public-not-found"]').exists()).toBe(true)
  })
})
