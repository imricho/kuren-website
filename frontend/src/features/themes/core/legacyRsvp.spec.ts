/**
 * The live guest RSVP form in the 49 pre-engine themes: public + slug only, coloured
 * from each theme's manifest at WCAG AA; the editor preview keeps the disabled sample.
 */
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { publishingApi } from '@/api/publishing'
import { toPreviewContent } from '@/features/wedding/draft'

import { everythingDraft, FIXTURE_TODAY } from '../temuvibe/testFixtures'
import { renderTheme } from '../testUtils'
import { contrast } from './contrast'
import { legacyFormStyle } from './formTokens'
import { TEMPLATE_MANIFESTS } from './manifests'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 22, 12) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const LEGACY = TEMPLATE_MANIFESTS.filter((m) => m.family !== 'temuvibe').map((m) => m.id)
const content = (mode: 'public' | 'draft') => toPreviewContent(everythingDraft('wedding_ceremony'), 'en', FIXTURE_TODAY, { mode, variant: 'wedding_ceremony' }).content

describe('legacy form tokens', () => {
  it('cover the 49 legacy themes', () => expect(LEGACY).toHaveLength(49))

  it.each(LEGACY.map((id) => [id]))('%s: every form colour pair meets WCAG AA on the form card', (id) => {
    const s = legacyFormStyle(id)
    const surface = s['--tv-surface']!
    expect(contrast(s['--tv-ink']!, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(s['--tv-muted']!, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(s['--tv-accent-ink']!, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(s['--tv-danger']!, surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(s['--tv-on-primary']!, s['--tv-primary']!)).toBeGreaterThanOrEqual(4.5)
    // Button and input borders are non-text UI: 3:1.
    expect(contrast(s['--tv-primary']!, surface)).toBeGreaterThanOrEqual(3)
    expect(contrast(s['--tv-line']!, surface)).toBeGreaterThanOrEqual(3)
  })

  it('unknown themes get no overrides (RsvpForm keeps its fallbacks)', () => expect(legacyFormStyle('nope')).toEqual({}))
})

describe.each(LEGACY.map((id) => [id]))('%s RSVP', (themeId) => {
  it('public with a slug: the live form, in the RSVP section, coloured from the theme', async () => {
    const w = await renderTheme(content('public'), themeId, { mode: 'public', variant: 'wedding_ceremony', slug: 'alex-sarah-abc123', guestName: 'Budi' })
    const rsvp = w.get('[data-section="rsvp"]')
    const card = rsvp.get('.rsvp--live')
    expect(card.attributes('style')).toContain('--tv-surface:')
    expect(rsvp.get<HTMLInputElement>('input[name="name"]').element.value).toBe('Budi')
    expect(rsvp.get('[data-honeypot]').attributes('aria-hidden')).toBe('true')
    expect(w.find('[data-editor-only]').exists()).toBe(false)
    expect(w.find('fieldset[disabled]').exists()).toBe(false)
    // Forms only inside the RSVP section.
    expect(w.findAll('form').every((f) => rsvp.element.contains(f.element))).toBe(true)
  })

  it('draft keeps the disabled, editor-only sample', async () => {
    const w = await renderTheme(content('draft'), themeId, { variant: 'wedding_ceremony', slug: 'ignored-in-draft' })
    const rsvp = w.get('[data-section="rsvp"]')
    expect(rsvp.find('.rsvp--live').exists()).toBe(false)
    expect(rsvp.find('[data-editor-only]').exists()).toBe(true)
    for (const form of rsvp.findAll('form')) expect(form.find('fieldset[disabled]').exists()).toBe(true)
  })
})

describe('legacy live RSVP submits', () => {
  it('sends the reply for a wedding on a legacy theme', async () => {
    const spy = vi.spyOn(publishingApi, 'submitRsvp').mockResolvedValue({ id: 'r1', attendance: 'not_attending', partySize: 0, confirmationMessage: null })
    const c = content('public')
    c.rsvp = { enabled: true, title: 'RSVP', deadline: '2027-05-01' }
    const w = await renderTheme(c, 'ethnic', { mode: 'public', variant: 'wedding_ceremony', slug: 'alex-sarah-abc123' })
    await w.get('input[name="name"]').setValue('Sari')
    await w.get('input[value="not_attending"]').setValue(true)
    await w.get('[data-testid="rsvp-form"]').trigger('submit')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('alex-sarah-abc123', { name: 'Sari', attendance: 'not_attending', partySize: 0, website: '' })
    expect(w.find('[data-testid="rsvp-success"]').exists()).toBe(true)
  })

  it('a past deadline shows the closed state instead of the form', async () => {
    const c = content('public')
    c.rsvp = { ...c.rsvp, deadline: '2026-01-01' }
    const w = await renderTheme(c, 'still-form', { mode: 'public', slug: 'alex-sarah-abc123' })
    expect(w.get('[data-testid="rsvp-closed"]').attributes('data-state')).toBe('closed')
    expect(w.find('form').exists()).toBe(false)
  })
})
