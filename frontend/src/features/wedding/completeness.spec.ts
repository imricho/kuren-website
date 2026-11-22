import { describe, expect, it } from 'vitest'

import { computeCompleteness, firstIncompleteSection, type SectionStatus } from './completeness'
import { emptyDraft, type WeddingDraft } from './draft'

const completeEvent = { id: 'e1', type: 'ceremony' as const, title: 'Ceremony', date: '2027-06-12', startTime: '10:00', venueName: 'Hall', address: 'Jl. 1' }

function complete(): WeddingDraft {
  const d = emptyDraft()
  d.opening = { weddingTitle: 'Our wedding', weddingDate: '2027-06-12' }
  d.couple = { groom: { name: 'Alex' }, bride: { name: 'Sarah' } }
  d.events = [completeEvent]
  d.rsvp = { enabled: true, title: 'RSVP' }
  d.closing = { message: 'Thank you' }
  return d
}

type Case = [string, (d: WeddingDraft) => void, string | null, Partial<Record<string, SectionStatus>>]

describe('completeness rules', () => {
  it('starts with everything not started and optional sections optional', () => {
    const c = computeCompleteness(emptyDraft(), null)
    expect(c.total).toBe(6)
    expect(c.done).toBe(0)
    expect(c.percent).toBe(0)
    expect(Object.fromEntries(Object.entries(c.sections).map(([k, v]) => [k, v.status]))).toEqual({
      theme: 'not_started',
      opening: 'not_started',
      holyRecite1: 'optional',
      greeting: 'optional',
      couple: 'not_started',
      // v2.0 sections are not offered to (legacy) weddings.
      profiles: 'optional',
      organization: 'optional',
      milestone: 'optional',
      weddingDate: 'not_started',
      events: 'not_started',
      agenda: 'optional',
      speakers: 'optional',
      story: 'optional',
      gallery: 'optional',
      rsvp: 'optional',
      wishes: 'optional',
      amplopDigital: 'optional',
      holyRecite2: 'optional',
      closing: 'not_started',
    })
    expect(Object.entries(c.sections).filter(([, v]) => v.required).map(([k]) => k)).toEqual([
      'theme', 'opening', 'couple', 'weddingDate', 'events', 'closing',
    ])
    expect(c.sections.opening.missing).toEqual(['weddingTitle', 'weddingDate', 'coupleNames'])
  })

  it('a complete draft with a theme is 6 of 6', () => {
    const c = computeCompleteness(complete(), 'ethnic')
    expect(c.done).toBe(6)
    expect(c.percent).toBe(100)
    expect(firstIncompleteSection(c)).toBeUndefined()
  })

  const cases: Case[] = [
    ['theme: unknown id', () => {}, 'removed-theme', { theme: 'not_started' }],
    ['theme: alias of a selectable template counts', () => {}, 'woven-indigo', { theme: 'complete' }],
    ['opening: title only', (d) => (d.opening = { weddingTitle: 'X' }), 'ethnic', { opening: 'in_progress' }],
    ['opening: coupleNames derivable from names', (d) => (d.opening.coupleNames = undefined), 'ethnic', { opening: 'complete' }],
    [
      'opening: no names and no override',
      (d) => {
        d.couple = { groom: {}, bride: {} }
      },
      'ethnic',
      { opening: 'in_progress', couple: 'not_started' },
    ],
    ['opening: override without names', (d) => {
      d.couple = { groom: {}, bride: {} }
      d.opening.coupleNames = 'A & B'
    }, 'ethnic', { opening: 'complete' }],
    ['couple: one name', (d) => (d.couple = { groom: { name: 'Alex' }, bride: {} }), 'ethnic', { couple: 'in_progress' }],
    ['couple: only a photo started', (d) => (d.couple = { groom: { description: 'Hi' }, bride: {} }), 'ethnic', { couple: 'in_progress' }],
    ['events: none', (d) => (d.events = []), 'ethnic', { events: 'not_started' }],
    ['events: one incomplete', (d) => d.events.push({ id: 'e2', type: 'other', title: 'Party' }), 'ethnic', { events: 'in_progress' }],
    ['events: bad time is not complete', (d) => (d.events = [{ ...completeEvent, startTime: '25:00' }]), 'ethnic', { events: 'in_progress' }],
    ['rsvp: disabled without title', (d) => (d.rsvp = { enabled: false }), 'ethnic', { rsvp: 'optional' }],
    ['rsvp: default only', (d) => (d.rsvp = { enabled: true }), 'ethnic', { rsvp: 'optional' }],
    ['rsvp: started without title', (d) => (d.rsvp = { enabled: true, introduction: 'Hi' }), 'ethnic', { rsvp: 'in_progress' }],
    ['weddingDate: missing', (d) => (d.opening.weddingDate = undefined), 'ethnic', { weddingDate: 'not_started', opening: 'in_progress' }],
    ['holyRecite1: on, empty', (d) => (d.holyRecite1 = { enabled: true, reference: 'QS 30:21' }), 'ethnic', { holyRecite1: 'in_progress' }],
    ['holyRecite2: on, original script only', (d) => (d.holyRecite2 = { enabled: true, originalScript: 'نص' }), 'ethnic', { holyRecite2: 'complete' }],
    ['holyRecite1: off keeps optional', (d) => (d.holyRecite1 = { enabled: false, passage: 'x' }), 'ethnic', { holyRecite1: 'optional' }],
    ['greeting: on with message', (d) => (d.greeting = { enabled: true, message: 'Hi' }), 'ethnic', { greeting: 'complete' }],
    ['wishes: on', (d) => (d.wishes = { enabled: true }), 'ethnic', { wishes: 'complete' }],
    [
      'amplop: half-filled bank row',
      (d) => (d.amplopDigital = { enabled: true, bankAccountsEnabled: true, qrisEnabled: false, bankAccounts: [{ id: 'b', bankName: 'BCA', accountHolder: '', accountNumber: '0123' }] }),
      'ethnic',
      { amplopDigital: 'in_progress' },
    ],
    [
      'amplop: complete bank row',
      (d) => (d.amplopDigital = { enabled: true, bankAccountsEnabled: true, qrisEnabled: false, bankAccounts: [{ id: 'b', bankName: 'BCA', accountHolder: 'Ayu', accountNumber: '0123' }] }),
      'ethnic',
      { amplopDigital: 'complete' },
    ],
    ['amplop: no method on', (d) => (d.amplopDigital = { enabled: true, bankAccountsEnabled: false, qrisEnabled: false, bankAccounts: [] }), 'ethnic', { amplopDigital: 'in_progress' }],
    ['closing: thank-you only', (d) => (d.closing = { thankYou: 'Love' }), 'ethnic', { closing: 'in_progress' }],
    ['story: valid entry', (d) => (d.story.timeline = [{ id: 's', title: 'Met', description: 'Library' }]), 'ethnic', { story: 'complete' }],
    ['story: started but invalid', (d) => (d.story.timeline = [{ id: 's', title: 'Met' }]), 'ethnic', { story: 'in_progress' }],
    ['gallery: photos', (d) => (d.gallery.images = [{ id: 'g', src: '/a.jpg', alt: 'A' }]), 'ethnic', { gallery: 'complete' }],
  ]

  it.each(cases)('%s', (_name, mutate, themeId, expected) => {
    const d = complete()
    mutate(d)
    const c = computeCompleteness(d, themeId)
    for (const [key, status] of Object.entries(expected)) expect(c.sections[key as keyof typeof c.sections].status).toBe(status)
  })

  it('optional sections never count toward the total', () => {
    const d = complete()
    d.story.timeline = [{ id: 's', title: 'Met' }]
    d.rsvp = { enabled: true, introduction: 'x' }
    d.amplopDigital = { enabled: true, bankAccountsEnabled: true, qrisEnabled: false, bankAccounts: [] }
    const c = computeCompleteness(d, 'ethnic')
    expect(c.done).toBe(6)
    expect(c.total).toBe(6)
  })

  it('counts the 5 mandatory sections + theme (RSVP is not required)', () => {
    const d = complete()
    d.rsvp = { enabled: true }
    expect(computeCompleteness(d, 'ethnic')).toMatchObject({ done: 6, total: 6, percent: 100 })
    d.opening.weddingDate = undefined
    const c = computeCompleteness(d, 'ethnic')
    expect(c.done).toBe(4) // opening and weddingDate both need the (shared) date
    expect(c.sections.weddingDate.missing).toEqual(['weddingDate'])
  })

  it('reports missing codes, never English', () => {
    const d = complete()
    d.events = [{ id: 'e', type: 'other' }]
    expect(computeCompleteness(d, 'ethnic').sections.events.missing).toEqual([
      '0.title',
      '0.date',
      '0.startTime',
      '0.venueName',
      '0.address',
    ])
  })

  it('first incomplete section follows editor order', () => {
    const d = complete()
    d.closing = {}
    d.couple = { groom: {}, bride: { name: 'S' } }
    d.opening.coupleNames = 'A & S'
    expect(firstIncompleteSection(computeCompleteness(d, 'ethnic'))).toBe('couple')
  })
})
