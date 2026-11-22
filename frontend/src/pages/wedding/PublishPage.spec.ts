import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mountApp } from '@/test/mountApp'
import { publishableDraft, QRIS_SRC } from '@/test/publishFixture'

enableAutoUnmount(afterEach)

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as never
  Element.prototype.scrollIntoView = vi.fn() as never
})
afterEach(() => {
  useToast().clear()
  vi.restoreAllMocks()
})

async function open(content = publishableDraft()) {
  const api = installFakeInvitationApi({ themeId: 'ethnic', content })
  const app = await mountApp('/wedding/publish')
  await flushPromises()
  return { api, ...app, page: () => app.wrapper.get('[data-testid="publish-page"]') }
}

describe('Preview & Publish page', () => {
  it('shows the draft status, privacy note and publishes; then offers the link', async () => {
    const draft = publishableDraft()
    draft.amplopDigital = {
      enabled: true, bankAccountsEnabled: true, bankAccounts: [{ bankName: 'BCA', accountHolder: 'Alex', accountNumber: '123' }],
      qrisEnabled: true, qrisImage: { src: QRIS_SRC, alt: 'QRIS' }, physicalGifts: { enabled: false },
    }
    const { api, wrapper, page } = await open(draft)
    expect(page().get('h1').text()).toBe('Preview & Publish')
    expect(page().get('[data-testid="publish-status"]').attributes('data-state')).toBe('draft')
    expect(page().get('[data-testid="publish-status-text"]').text()).toBe('Draft saved — not published yet')
    expect(page().get('[data-privacy="bank"]').text()).toContain('1 bank account')
    expect(page().find('[data-privacy="qris"]').exists()).toBe(true)
    expect(page().find('[data-privacy="physical"]').exists()).toBe(false)
    expect(page().find('[data-testid="publish-errors"]').exists()).toBe(false)
    expect(page().find('[data-testid="public-url-pending"]').exists()).toBe(true)
    expect(page().get('[data-action="preview-draft"]').attributes('href')).toBe('/invitations/w1/preview?from=/invitations/w1/edit/publish')

    const button = page().get('[data-action="publish"]')
    expect(button.text()).toBe('Publish')
    expect(button.attributes('aria-disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/publish')).toHaveLength(1)
    expect(page().get('[data-testid="publish-status"]').attributes('data-state')).toBe('published')
    expect(page().get('[data-testid="publish-status-text"]').text()).toMatch(/^Published · /)
    expect(wrapper.get('[data-testid="publish-live"]').text()).toBe('Your invitation is published.')
    expect((page().get('[data-testid="public-url"]').element as HTMLInputElement).value).toBe(`${location.origin}/i/alex-sarah-abc123`)
    const view = page().get('[data-action="view-published"]')
    expect(view.attributes()).toMatchObject({ target: '_blank', rel: 'noopener noreferrer', href: `${location.origin}/i/alex-sarah-abc123` })
    expect(view.get('.sr-only').text()).toBe('(opens in a new tab)')
    // Up to date: the button explains why it is disabled.
    expect(page().get('[data-action="publish"]').text()).toBe('Publish update')
    expect(page().get('[data-action="publish"]').attributes('aria-disabled')).toBe('true')
    expect(page().get('[data-testid="publish-disabled-reason"]').text()).toBe('Your live invitation is up to date.')
    // Header chip follows.
    expect(wrapper.get('[data-testid="publish-chip"]').attributes('data-state')).toBe('published')

    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await page().get('[data-action="copy-link"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/i/alex-sarah-abc123`)
    expect(page().get('[data-testid="copy-status"]').text()).toBe('Link copied')
  })

  it('lists blocking errors with links to the field, and disables Publish with a reason', async () => {
    const draft = publishableDraft()
    draft.closing = {}
    draft.events[0]!.date = '2020-01-01'
    const { api, page, router } = await open(draft)
    const errors = page().get('[data-testid="publish-errors"]')
    expect(errors.text()).toContain('Add a closing message.')
    expect(page().get('[data-testid="publish-warnings"]').text()).toContain('is dated in the past')
    const button = page().get('[data-action="publish"]')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('aria-describedby')).toBe('publish-disabled-reason')
    expect(page().get('#publish-disabled-reason').text()).toBe('Fix the items below to publish.')
    await button.trigger('click')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/publish')).toHaveLength(0)

    const link = errors.get('[data-issue="closing.message"] a')
    expect(link.attributes('href')).toBe('/invitations/w1/edit/closing#f-message')
    await link.trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('f-message'))
    expect(router.currentRoute.value.name).toBe('editor-closing')
  })

  it('shows server issues from a 422 and announces the failure of a 500', async () => {
    const { api, wrapper, page } = await open()
    api.blockNextPublish([{ section: 'events', field: 'events.0.venueName', code: 'required', message: 'Event venue is required' }])
    await page().get('[data-action="publish"]').trigger('click')
    await flushPromises()
    expect(page().get('[data-issue="events.0.venueName"]').text()).toContain('Event venue is required')
    expect(wrapper.get('[data-testid="publish-live"]').text()).toBe('Couldn’t publish yet: 1 items need attention.')

    // Server issues drop once a write lands; then a 500.
    api.failNext('POST /invitations/w1/publish', { status: 500 })
    const store = (await import('@/stores/invitation')).useInvitationStore()
    await store.saveSection('closing', { message: 'Thanks!' })
    await flushPromises()
    await page().get('[data-action="publish"]').trigger('click')
    await flushPromises()
    expect(page().get('[data-testid="publish-status"]').attributes('data-state')).toBe('failed')
    expect(page().get('[data-testid="publish-status-text"]').text()).toBe('Couldn’t publish. Your live invitation is unchanged. Try again.')
    expect(wrapper.get('[data-testid="publish-live"]').text()).toBe('Couldn’t publish. Your live invitation is unchanged.')
  })

  it('unpublishes after confirming', async () => {
    const { api, wrapper, page } = await open()
    await page().get('[data-action="publish"]').trigger('click')
    await flushPromises()
    await page().get('[data-action="unpublish"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').text()).toContain('Unpublish your invitation?')
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/unpublish')).toHaveLength(1)
    expect(page().get('[data-testid="publish-status"]').attributes('data-state')).toBe('draft')
    expect(wrapper.get('[data-testid="publish-live"]').text()).toBe('Your invitation is no longer public.')
  })
})
