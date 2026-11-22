/**
 * The v2.0 sections (profiles, milestone, organization, agenda, speakers) and the
 * RSVP/session extensions through toPreviewContent, in draft and public mode,
 * honouring `enabled` and the variant's section offering.
 */
import { describe, expect, it } from 'vitest'

import { allPlaceholderTexts, emptyDraft, toPreviewContent, type WeddingDraft } from '@/features/wedding/draft'
import { validateWeddingContent } from '@/features/wedding/validation'
import { publishableDraft } from '@/test/publishFixture'

import { PLACEHOLDER_ID_PREFIX } from './draft'
import type { VariantId } from './registry'

const today = new Date(2026, 10, 22)
const pub = (d: WeddingDraft, variant?: VariantId) => toPreviewContent(d, 'en', today, { mode: 'public', ...(variant ? { variant } : {}) })
const draftMode = (d: WeddingDraft, variant?: VariantId, ui: 'en' | 'id' = 'en') => toPreviewContent(d, ui, today, { ...(variant ? { variant } : {}) })

const IMG = { src: 'https://cdn.example.com/p.jpg', alt: 'Portrait' }

function birthday(): WeddingDraft {
  const d = publishableDraft()
  d.couple = { groom: {}, bride: {} }
  d.opening = { weddingTitle: 'Nadia turns 30', coupleNames: 'Nadia', weddingDate: '2027-02-14' }
  d.events = [{ id: 'party', type: 'party', title: 'Party', date: '2027-02-14', startTime: '19:00', venueName: 'Rooftop', address: 'Jl. Sudirman 1', optional: true }]
  d.story = { enabled: true, title: 'Story', timeline: [{ id: 's1', title: 'Born', description: 'In Bandung' }] }
  d.greeting = { enabled: true, message: 'Hello' }
  d.profiles = {
    enabled: true,
    title: '  The celebrant  ',
    people: [
      { id: 'p1', role: 'celebrant', name: '  Nadia Putri ', image: IMG, birthDate: '1997-02-14' },
      { id: 'p2', role: 'graduate', name: 'Wrong role' },
      { id: 'p3', role: 'celebrant', name: '   ' },
    ],
  }
  d.milestone = { enabled: true, age: 30, years: 5, partyTheme: ' Retro ', occasion: 'Not for birthdays' }
  return d
}

describe('v2.0 sections — public mode', () => {
  it('renders offered, enabled sections with only valid values, and drops what the variant does not offer', () => {
    const { content } = pub(birthday(), 'birthday')
    expect(content.sections).toEqual(['opening', 'profiles', 'milestone', 'countdown', 'events', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'closing'])
    expect(content.profiles).toEqual({ enabled: true, title: 'The celebrant', people: [{ id: 'p1', role: 'celebrant', name: 'Nadia Putri', image: IMG, birthDate: '1997-02-14' }] })
    // Only the fields the variant shows (birthday: age, partyTheme).
    expect(content.milestone).toEqual({ enabled: true, age: 30, partyTheme: 'Retro' })
    expect(content.story).toBeUndefined()
    expect(content.greeting).toEqual({ enabled: false })
    expect(content.couple).toEqual({ groom: { name: '' }, bride: { name: '' } })
    expect(content.opening.coupleNames).toBe('Nadia')
    expect(content.events[0]!.optional).toBe(true)
  })

  it('never inserts placeholders, and drops disabled or empty v2.0 sections', () => {
    const d = emptyDraft('en')
    d.profiles = { enabled: true, people: [] }
    d.agenda = { enabled: true, items: [{ id: 'a1', title: '  ' }] }
    d.speakers = { enabled: false, people: [{ id: 's1', name: 'Hidden speaker' }] }
    d.organization = { enabled: true }
    d.milestone = { enabled: true, title: 'Only a title' }
    for (const variant of ['seminar', 'family_reunion', 'birthday'] as const) {
      const { content } = pub(d, variant)
      const json = JSON.stringify(content)
      for (const placeholder of allPlaceholderTexts()) expect(json, `${variant}: ${placeholder}`).not.toContain(placeholder)
      expect(json).not.toContain(PLACEHOLDER_ID_PREFIX)
      expect(content.profiles).toBeUndefined()
      expect(content.agenda).toBeUndefined()
      expect(content.speakers).toBeUndefined()
      expect(content.organization).toBeUndefined()
      expect(content.milestone).toBeUndefined()
    }
  })

  it('keeps agenda references only to rendered sessions and speakers', () => {
    const d = publishableDraft()
    d.organization = { enabled: true, name: ' Acme ', websiteUrl: 'http://acme.example', logo: IMG }
    d.speakers = { enabled: true, people: [{ id: 'sp1', name: 'Dr. Rina', role: 'Keynote' }, { id: 'sp2', name: '' }] }
    d.agenda = {
      enabled: true,
      items: [
        { id: 'a1', time: '09:00', endTime: '08:00', title: 'Opening', sessionId: 'e1', speakerIds: ['sp1', 'sp2', 'ghost'] },
        { id: 'a2', time: '9am', title: 'Coffee', sessionId: 'missing' },
      ],
    }
    const { content } = pub(d, 'seminar')
    expect(content.organization).toEqual({ enabled: true, name: 'Acme', logo: IMG }) // http URL dropped
    expect(content.speakers?.people).toEqual([{ id: 'sp1', name: 'Dr. Rina', role: 'Keynote' }])
    expect(content.agenda?.items).toEqual([
      { id: 'a1', time: '09:00', title: 'Opening', sessionId: 'e1', speakerIds: ['sp1'] },
      { id: 'a2', title: 'Coffee' },
    ])
    expect(content.couple).toEqual({ groom: { name: '' }, bride: { name: '' } })
    expect(content.sections).not.toContain('couple')
  })

  it('never renders v2.0 sections for wedding variants; wedding output is otherwise unchanged', () => {
    const d = publishableDraft()
    d.profiles = { enabled: true, people: [{ id: 'p1', role: 'host', name: 'Host' }] }
    d.agenda = { enabled: true, items: [{ id: 'a1', title: 'Dinner' }] }
    const withVariant = pub(d, 'wedding_ceremony').content
    const legacy = pub({ ...d, profiles: undefined, agenda: undefined }).content
    expect(withVariant.profiles).toBeUndefined()
    expect(withVariant.agenda).toBeUndefined()
    const { sections, ...rest } = withVariant
    expect(sections).toHaveLength(13)
    expect(rest).toEqual(legacy)
  })

  it('publishes valid RSVP extensions only; `full` only from a public snapshot', () => {
    const d = publishableDraft()
    d.rsvp = {
      ...d.rsvp,
      capacity: 0,
      collectContact: 'email',
      allowSessionChoice: true,
      registrationFields: [
        { id: 'company', label: ' Company ', type: 'text', required: false },
        { id: 'meal', label: 'Meal', type: 'select', required: true, options: [' Veg ', ''] },
        { id: 'empty', label: 'Pick', type: 'select', required: false, options: [] },
        { id: 'nolabel', label: ' ', type: 'text', required: true },
      ],
    }
    ;(d.rsvp as { full?: boolean }).full = true
    const rsvp = pub(d, 'seminar').content.rsvp
    expect(rsvp).toMatchObject({
      collectContact: 'email',
      allowSessionChoice: true,
      full: true,
      registrationFields: [
        { id: 'company', label: 'Company', type: 'text', required: false },
        { id: 'meal', label: 'Meal', type: 'select', required: true, options: ['Veg'] },
      ],
    })
    expect(rsvp.capacity).toBeUndefined()
    expect(draftMode(d, 'seminar').content.rsvp.full).toBeUndefined()
  })
})

describe('v2.0 sections — draft mode', () => {
  it('fills an enabled empty list section with ONE labelled sample and reports it missing', () => {
    const d = emptyDraft('en')
    d.profiles = { enabled: true, people: [] }
    d.agenda = { enabled: true, items: [] }
    d.speakers = { enabled: true, people: [] }
    const { content, missing } = draftMode(d, 'seminar', 'id')
    expect(content.profiles).toBeUndefined() // seminar doesn't offer profiles
    expect(content.agenda?.items).toEqual([{ id: `${PLACEHOLDER_ID_PREFIX}agenda`, title: 'Susunan acara belum diisi' }])
    expect(content.speakers?.people).toEqual([{ id: `${PLACEHOLDER_ID_PREFIX}speaker`, name: 'Pembicara belum diisi' }])
    expect(missing).toEqual(expect.arrayContaining([{ section: 'agenda', field: 'items' }, { section: 'speakers', field: 'people' }]))
    expect(missing).not.toContainEqual(expect.objectContaining({ section: 'couple' }))

    const family = draftMode(d, 'family_reunion').content
    expect(family.profiles?.people).toEqual([{ id: `${PLACEHOLDER_ID_PREFIX}profile`, role: 'host', name: 'Name to be added' }])
  })

  it('keeps disabled sections as enabled:false (values kept) and stays renderable', () => {
    const d = birthday()
    d.profiles!.enabled = false
    const { content } = draftMode(d, 'birthday')
    expect(content.profiles).toMatchObject({ enabled: false, people: [{ id: 'p1', name: 'Nadia Putri' }] })
    expect(validateWeddingContent(content)).toEqual([])
  })

  it('draft content for every variant passes the content model check', () => {
    for (const variant of ['birthday', 'khitanan', 'anniversary', 'seminar', 'community_gathering', 'wedding_reception'] as const) {
      const d = emptyDraft('en')
      d.profiles = { enabled: true, people: [] }
      d.milestone = { enabled: true }
      expect(validateWeddingContent(draftMode(d, variant).content), variant).toEqual([])
    }
  })
})

describe('variant-aware draft placeholders', () => {
  it('uses event wording outside weddings and never shows couple wording without a couple', () => {
    const d = emptyDraft('en')
    const seminar = draftMode(d, 'seminar').content
    expect(seminar.opening.weddingTitle).toBe('Your event title')
    expect(seminar.opening.coupleNames).toBe('Name to display')
    const anniversary = draftMode(d, 'anniversary').content
    expect(anniversary.opening.weddingTitle).toBe('Your event title')
    expect(anniversary.opening.coupleNames).toBe('Your names')
    const wedding = draftMode(d, 'wedding_ceremony', 'id').content
    expect(wedding.opening.weddingTitle).toBe('Judul pernikahan Anda')
    // Public mode still never shows any of them.
    const json = JSON.stringify(pub(d, 'seminar').content)
    for (const placeholder of allPlaceholderTexts()) expect(json).not.toContain(placeholder)
  })
})
