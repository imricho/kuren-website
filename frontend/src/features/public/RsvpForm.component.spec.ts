/** The live guest RSVP form: validation, accessibility, every server outcome, honeypot, storage. */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/http'
import { publishingApi } from '@/api/publishing'
import { toPreviewContent } from '@/features/wedding/draft'
import type { WeddingContent } from '@/features/wedding/types'

import { everythingDraft, FIXTURE_TODAY } from '../themes/temuvibe/testFixtures'
import RsvpForm from './RsvpForm.vue'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 22, 12) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function seminar(edit?: (c: WeddingContent) => void, locale: 'en' | 'id' = 'en'): WeddingContent {
  const c = toPreviewContent(everythingDraft('seminar', locale), 'en', FIXTURE_TODAY, { mode: 'public', variant: 'seminar' }).content
  edit?.(c)
  return c
}
const mountForm = (content: WeddingContent, props: { guestName?: string; timezone?: string } = {}) =>
  mount(RsvpForm, { props: { content, slug: 'acme-abc123', timezone: 'Asia/Jakarta', ...props }, attachTo: document.body })

async function fillValid(w: ReturnType<typeof mountForm>) {
  await w.get('input[name="name"]').setValue('Budi Santoso')
  await w.get('input[value="attending"]').setValue(true)
  await w.get('select[name="partySize"]').setValue('2')
  await w.get('input[name="email"]').setValue('budi@example.com')
  const inputs = w.findAll('input[type="text"]').filter((i) => i.attributes('name') !== 'name' && i.attributes('name') !== 'website')
  await inputs[0]!.setValue('Acme') // Company (required)
  await w.findAll('input[type="checkbox"]').at(-1)!.setValue(true) // consent (required)
}
const submit = async (w: ReturnType<typeof mountForm>) => {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('RsvpForm', () => {
  it('prefills the name from ?to= (editable) and renders every configured field with labels', async () => {
    const w = mountForm(seminar(), { guestName: 'Pak Budi' })
    const name = w.get<HTMLInputElement>('input[name="name"]')
    expect(name.element.value).toBe('Pak Budi')
    await name.setValue('Budi S.')
    expect(name.element.value).toBe('Budi S.')
    for (const input of w.findAll('input:not([type="radio"]):not([type="checkbox"]):not([name="website"]), select, textarea')) {
      const id = input.attributes('id')!
      expect(w.find(`label[for="${id}"]`).exists(), id).toBe(true)
    }
    expect(w.text()).toContain('Company')
    expect(w.text()).toContain('Dietary needs')
    expect(w.get('input[name="email"]').attributes('aria-required')).toBe('true')
    // Party size only once attending; sessions only for optional ones.
    expect(w.find('select[name="partySize"]').exists()).toBe(false)
    await w.get('input[value="attending"]').setValue(true)
    expect(w.findAll('select[name="partySize"] option')).toHaveLength(4)
    expect(w.get('[data-testid="rsvp-sessions"]').text()).toContain('Breakout Workshop')
    expect(w.get('[data-testid="rsvp-sessions"]').text()).not.toContain('Main Session')
  })

  it('never shows the honeypot to people or assistive technology', () => {
    const w = mountForm(seminar())
    const hp = w.get('[data-honeypot]')
    expect(hp.attributes('aria-hidden')).toBe('true')
    expect(hp.classes()).toContain('tvf-hp')
    const input = hp.get('input[name="website"]')
    expect(input.attributes()).toMatchObject({ tabindex: '-1', autocomplete: 'off' })
  })

  it('validates on submit: error summary gets focus, fields are linked to their errors, nothing is sent', async () => {
    const spy = vi.spyOn(publishingApi, 'submitRsvp')
    const w = mountForm(seminar())
    await submit(w)
    expect(spy).not.toHaveBeenCalled()
    const summary = w.get('[data-testid="rsvp-error-summary"]')
    expect(document.activeElement).toBe(summary.element)
    expect(summary.findAll('li').length).toBeGreaterThanOrEqual(4)
    const name = w.get('input[name="name"]')
    expect(name.attributes('aria-invalid')).toBe('true')
    const errId = name.attributes('aria-describedby')!
    expect(w.get(`[id="${errId}"]`).text()).toBe('Please enter your name.')
    // Summary links move focus to the field.
    await summary.get('a').trigger('click')
    expect(document.activeElement).toBe(name.element)
  })

  it('submits a valid reply and shows the confirmation (focus moves to it); only a replied flag is stored', async () => {
    const spy = vi.spyOn(publishingApi, 'submitRsvp').mockResolvedValue({ id: 'r1', attendance: 'attending', partySize: 2, confirmationMessage: 'Thanks, see you!' })
    const w = mountForm(seminar(), { guestName: 'Pak Budi' })
    await fillValid(w)
    await w.get('[data-testid="rsvp-sessions"] input').setValue(true)
    await submit(w)
    expect(spy).toHaveBeenCalledWith('acme-abc123', {
      name: 'Budi Santoso', attendance: 'attending', partySize: 2, email: 'budi@example.com', sessionIds: ['e2'],
      answers: { company: 'Acme', agree: true }, guestLabel: 'Pak Budi', website: '',
    })
    const success = w.get('[data-testid="rsvp-success"]')
    expect(success.text()).toContain('Thanks, see you!')
    expect(document.activeElement).toBe(success.element)
    // Only the replied flag (no edit token in this mocked reply); nothing the guest typed.
    const stored = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
    expect(stored).toEqual(['temuvibe.rsvp.replied.acme-abc123'])
    expect(localStorage.getItem(stored[0]!)).toBe('1')
    // A later visit says so, but still lets the guest reply.
    w.unmount()
    const again = mountForm(seminar())
    expect(again.find('[data-testid="rsvp-already"]').exists()).toBe(true)
    expect(again.find('[data-testid="rsvp-form"]').exists()).toBe(true)
  })

  it('keeps the private edit token, offers the personal link, and a later visit shows "your reply"', async () => {
    const token = 'T'.repeat(43)
    vi.spyOn(publishingApi, 'submitRsvp').mockResolvedValue({ id: 'r1', attendance: 'attending', partySize: 2, confirmationMessage: null, editToken: token })
    const own = { id: 'r1', name: 'Budi Santoso', attendance: 'attending' as const, partySize: 2, email: 'budi@example.com', sessionIds: ['e2'], answers: { company: 'Acme', agree: true }, createdAt: '2026-11-22T05:00:00Z', updatedAt: null }
    const getOwn = vi.spyOn(publishingApi, 'getOwnRsvp').mockResolvedValue(own)
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    expect(localStorage.getItem('temuvibe.rsvp.token.acme-abc123')).toBe(token)
    const link = w.get<HTMLInputElement>('[data-testid="rsvp-edit-link"] input')
    expect(link.element.value).toBe(`${location.origin}/i/acme-abc123#rsvp=${token}`)
    expect(w.get(`label[for="${link.attributes('id')}"]`).text()).toContain('private link')
    w.unmount()

    const again = mountForm(seminar())
    await flushPromises()
    expect(getOwn).toHaveBeenCalledWith('acme-abc123', token)
    const card = again.get('[data-testid="rsvp-own"]')
    expect(card.text()).toContain('Budi Santoso')
    expect(card.text()).toContain('Attending · 2 people')
    expect(again.find('[data-testid="rsvp-form"]').exists()).toBe(false)
  })

  it('changing a reply PUTs over the same reply with the token (never a new POST)', async () => {
    const token = 'A'.repeat(43)
    localStorage.setItem('temuvibe.rsvp.token.acme-abc123', token)
    const own = { id: 'r1', name: 'Budi Santoso', attendance: 'attending' as const, partySize: 2, email: 'budi@example.com', sessionIds: [], answers: { company: 'Acme', agree: true }, createdAt: '2026-11-22T05:00:00Z', updatedAt: null }
    vi.spyOn(publishingApi, 'getOwnRsvp').mockResolvedValue(own)
    const post = vi.spyOn(publishingApi, 'submitRsvp')
    const put = vi.spyOn(publishingApi, 'updateOwnRsvp').mockResolvedValue({ id: 'r1', attendance: 'not_attending', partySize: 0, confirmationMessage: null, updatedAt: '2026-11-22T06:00:00Z' })
    const w = mountForm(seminar())
    await flushPromises()
    await w.get('[data-action="rsvp-change"]').trigger('click')
    await flushPromises()
    // Prefilled from the saved reply, with a clear note that saving replaces it.
    expect(w.get<HTMLInputElement>('input[name="name"]').element.value).toBe('Budi Santoso')
    expect(w.get('[data-testid="rsvp-editing"]').text()).toContain('replaces it')
    expect(document.activeElement).toBe(w.get('input[name="name"]').element)
    await w.get('input[value="not_attending"]').setValue(true)
    expect(w.get('[data-action="rsvp-submit"]').text()).toBe('Save changes')
    await submit(w)
    expect(post).not.toHaveBeenCalled()
    expect(put).toHaveBeenCalledWith('acme-abc123', token, expect.objectContaining({ name: 'Budi Santoso', attendance: 'not_attending', partySize: 0 }))
    expect(w.get('[data-testid="rsvp-success"]').text()).toContain('updated')
  })

  it('when the event is full the guest can still change (e.g. decline) their own reply; new replies stay blocked', async () => {
    localStorage.setItem('temuvibe.rsvp.token.acme-abc123', 'F'.repeat(43))
    const own = { id: 'r1', name: 'Budi', attendance: 'attending' as const, partySize: 2, sessionIds: [], answers: {}, createdAt: '2026-11-22T05:00:00Z', updatedAt: null }
    vi.spyOn(publishingApi, 'getOwnRsvp').mockResolvedValue(own)
    const w = mountForm(seminar((c) => (c.rsvp.full = true)))
    await flushPromises()
    expect(w.find('[data-action="rsvp-change"]').exists()).toBe(true)
    expect(w.find('[data-action="rsvp-again"]').exists()).toBe(false)
    await w.get('[data-action="rsvp-change"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="rsvp-form"]').exists()).toBe(true)
    expect(w.find('[data-testid="rsvp-closed"]').exists()).toBe(false)
  })

  it('after the deadline the own reply is shown read-only', async () => {
    localStorage.setItem('temuvibe.rsvp.token.acme-abc123', 'G'.repeat(43))
    vi.spyOn(publishingApi, 'getOwnRsvp').mockResolvedValue({ id: 'r1', name: 'Budi', attendance: 'not_attending', partySize: 0, sessionIds: [], answers: {}, createdAt: '2026-11-01T05:00:00Z', updatedAt: null })
    const w = mountForm(seminar((c) => (c.rsvp.deadline = '2026-11-01')))
    await flushPromises()
    expect(w.get('[data-testid="rsvp-own"]').text()).toContain('Not attending')
    expect(w.find('[data-testid="rsvp-own-closed"]').exists()).toBe(true)
    expect(w.find('[data-action="rsvp-change"]').exists()).toBe(false)
  })

  it('a lost or revoked link is forgotten and explained; the guest can still send a new reply', async () => {
    localStorage.setItem('temuvibe.rsvp.token.acme-abc123', 'B'.repeat(43))
    vi.spyOn(publishingApi, 'getOwnRsvp').mockRejectedValue(new ApiError(404, 'rsvp_link_invalid', 'nope'))
    const w = mountForm(seminar())
    await flushPromises()
    expect(localStorage.getItem('temuvibe.rsvp.token.acme-abc123')).toBeNull()
    expect(w.get('[data-testid="rsvp-link-lost"]').text()).toContain('no longer works')
    expect(w.find('[data-testid="rsvp-form"]').exists()).toBe(true)
  })

  it('takes a token from the #rsvp= personal link and removes it from the address bar', async () => {
    const token = 'C'.repeat(43)
    history.replaceState(null, '', `/i/acme-abc123#to=Budi&rsvp=${token}`)
    vi.spyOn(publishingApi, 'getOwnRsvp').mockRejectedValue(new ApiError(0, 'network_error', 'offline'))
    mountForm(seminar())
    await flushPromises()
    expect(location.hash).toBe('#to=Budi')
    expect(localStorage.getItem('temuvibe.rsvp.token.acme-abc123')).toBe(token)
    history.replaceState(null, '', '/')
  })

  it('a declining guest sends partySize 0', async () => {
    const spy = vi.spyOn(publishingApi, 'submitRsvp').mockResolvedValue({ id: 'r1', attendance: 'not_attending', partySize: 0, confirmationMessage: null })
    const w = mountForm(seminar((c) => { c.rsvp.registrationFields = []; c.rsvp.collectContact = undefined }))
    await w.get('input[name="name"]').setValue('Sari')
    await w.get('input[value="not_attending"]').setValue(true)
    await submit(w)
    expect(spy.mock.calls[0]![1]).toEqual({ name: 'Sari', attendance: 'not_attending', partySize: 0, website: '' })
    // Falls back to the snapshot's confirmation message.
    expect(w.get('[data-testid="rsvp-success"]').text()).toContain('See you there!')
  })

  it('shows the closed state when the deadline has passed in the invitation time zone', () => {
    vi.setSystemTime(new Date(Date.UTC(2027, 4, 1, 18))) // 2 May in Jakarta
    const w = mountForm(seminar())
    expect(w.get('[data-testid="rsvp-closed"]').attributes('data-state')).toBe('closed')
    expect(w.find('form').exists()).toBe(false)
  })

  it('shows the full state when the snapshot says rsvp.full', () => {
    const w = mountForm(seminar((c) => { c.rsvp.full = true }))
    expect(w.get('[data-testid="rsvp-closed"]').attributes('data-state')).toBe('full')
    expect(w.text()).toContain('Fully booked')
  })

  it.each([
    ['422 rsvp_closed → closed state', new ApiError(422, 'rsvp_closed', 'closed'), 'closed'],
    ['409 limit_reached → closed state', new ApiError(409, 'limit_reached', 'limit'), 'closed'],
  ])('%s', async (_label, err, state) => {
    vi.spyOn(publishingApi, 'submitRsvp').mockRejectedValue(err)
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    expect(w.get('[data-testid="rsvp-closed"]').attributes('data-state')).toBe(state)
  })

  it('409 capacity_reached keeps the form and explains', async () => {
    vi.spyOn(publishingApi, 'submitRsvp').mockRejectedValue(new ApiError(409, 'capacity_reached', 'full'))
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    const banner = w.get('[data-testid="rsvp-banner"]')
    expect(banner.attributes('data-error')).toBe('capacity')
    expect(banner.text()).toContain('enough places left for 2')
    expect(document.activeElement).toBe(banner.element)
    expect(w.find('form').exists()).toBe(true)
  })

  it('422 field errors are shown on their fields', async () => {
    vi.spyOn(publishingApi, 'submitRsvp').mockRejectedValue(
      new ApiError(422, 'validation_error', 'bad', [{ field: 'answers.company', message: 'Field required' }, { field: 'email', message: 'invalid' }]),
    )
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    expect(w.get('[data-testid="rsvp-error-summary"]').findAll('li')).toHaveLength(2)
    expect(w.get('input[name="email"]').attributes('aria-invalid')).toBe('true')
    const company = w.findAll('input[aria-invalid="true"]').map((i) => i.attributes('id'))
    expect(company.some((id) => id?.includes('answers-company'))).toBe(true)
  })

  it('429 asks to wait and offers a retry', async () => {
    vi.spyOn(publishingApi, 'submitRsvp').mockRejectedValue(new ApiError(429, 'too_many_requests', 'slow'))
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    expect(w.get('[data-testid="rsvp-banner"]').text()).toContain('Please wait a minute')
    expect(w.find('[data-action="rsvp-retry"]').exists()).toBe(true)
  })

  it('a network error keeps every value and retries successfully', async () => {
    const spy = vi
      .spyOn(publishingApi, 'submitRsvp')
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'offline'))
      .mockResolvedValueOnce({ id: 'r1', attendance: 'attending', partySize: 2, confirmationMessage: null })
    const w = mountForm(seminar())
    await fillValid(w)
    await submit(w)
    expect(w.get('[data-testid="rsvp-banner"]').attributes('data-error')).toBe('network')
    expect(w.get<HTMLInputElement>('input[name="name"]').element.value).toBe('Budi Santoso')
    // The retry button is the form's submit button: activating it re-sends the same values.
    await w.get('[data-action="rsvp-retry"]').trigger('click')
    await flushPromises()
    if (w.find('form').exists()) await submit(w)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="rsvp-success"]').exists()).toBe(true)
  })

  it('disables the button while submitting', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof publishingApi.submitRsvp>>) => void
    vi.spyOn(publishingApi, 'submitRsvp').mockReturnValue(new Promise((r) => (resolve = r)))
    const w = mountForm(seminar())
    await fillValid(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-action="rsvp-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('form').attributes('aria-busy')).toBe('true')
    expect(w.get('[data-action="rsvp-submit"]').text()).toBe('Sending…')
    resolve({ id: 'r', attendance: 'attending', partySize: 2, confirmationMessage: null })
    await flushPromises()
    expect(w.find('[data-testid="rsvp-success"]').exists()).toBe(true)
  })

  it('speaks the invitation language', () => {
    const w = mountForm(seminar(undefined, 'id'))
    expect(w.text()).toContain('Apakah Anda akan hadir?')
    expect(w.get('[data-action="rsvp-submit"]').text()).toBe('Kirim konfirmasi')
  })
})
