import { describe, expect, it } from 'vitest'

import { computeCompleteness } from '@/features/wedding/completeness'
import { emptyDraft, normalizeDraft, type WeddingDraft } from '@/features/wedding/draft'

import { nextStep } from './nextStep'

const THEME = 'international'
const complete = (): WeddingDraft =>
  normalizeDraft({
    ...emptyDraft(),
    opening: { weddingTitle: 'Pernikahan Rizky & Ayu', weddingDate: '2027-06-12' },
    couple: { groom: { name: 'Rizky Pratama' }, bride: { name: 'Ayu Lestari' } },
    events: [{ id: 'e1', type: 'akad', title: 'Akad', date: '2027-06-12', startTime: '08:00', venueName: 'Masjid', address: 'Jl. Merdeka 1' }],
    rsvp: { enabled: true, title: 'RSVP' },
    closing: { message: 'Terima kasih' },
  })

describe('nextStep', () => {
  it('starts with the theme on a brand-new wedding', () => {
    const step = nextStep(computeCompleteness(emptyDraft(), null))
    expect(step).toMatchObject({ key: 'theme', action: 'nextThemeAction', to: { name: 'themes' } })
  })

  it('points at the first incomplete required section in editor order', () => {
    const d = complete()
    d.events = []
    d.closing = {}
    expect(nextStep(computeCompleteness(d, THEME))).toMatchObject({ key: 'events', to: { name: 'wedding-events' } })
  })

  it('skips optional sections (story, gallery, RSVP)', () => {
    const d = complete()
    d.rsvp = { enabled: true }
    // RSVP is optional in the universal 13-section model, so it never blocks.
    expect(nextStep(computeCompleteness(d, THEME)).key).toBe('preview')
  })

  it('offers the preview once every required section is complete', () => {
    const step = nextStep(computeCompleteness(complete(), THEME))
    expect(step).toMatchObject({ key: 'preview', action: 'nextDoneAction', to: { name: 'wedding-preview' } })
  })
})
