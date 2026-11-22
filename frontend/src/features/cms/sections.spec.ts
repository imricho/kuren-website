import { describe, expect, it } from 'vitest'

import { editorSectionsFor, isMandatorySection, NAV_GROUPS, navGroupsFor } from './sections'

const chips = (variant?: Parameters<typeof navGroupsFor>[0]) =>
  navGroupsFor(variant).map((g) => [g.key, g.label, g.entries.map((e) => (e.kind === 'section' ? e.section.key : e.key))])

describe('variant-driven editor navigation', () => {
  it('gives wedding variants the original five groups and chips (plus Settings)', () => {
    const original = [
      ['wedding', 'navGroupWedding', ['opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate']],
      ['events', 'navGroupEvents', ['events']],
      ['moments', 'navGroupMoments', ['story', 'gallery', 'music']],
      ['guests', 'navGroupGuests', ['rsvp', 'wishes']],
      ['finishing', 'navGroupFinishing', ['amplopDigital', 'holyRecite2', 'closing', 'settings', 'publish']],
    ]
    expect(chips()).toEqual(original)
    expect(chips('wedding_ceremony')).toEqual(original)
    expect(chips('wedding_reception')).toEqual(original)
    expect(navGroupsFor('wedding_reception')).toEqual(NAV_GROUPS)
  })

  it('shows only the sections a variant offers, dropping empty groups', () => {
    expect(chips('seminar')).toEqual([
      ['wedding', 'navGroupInvitation', ['opening', 'organization', 'weddingDate']],
      ['events', 'navGroupEvents', ['events', 'agenda', 'speakers']],
      ['guests', 'navGroupGuests', ['rsvp']],
      ['finishing', 'navGroupFinishing', ['closing', 'settings', 'publish']],
    ])
    expect(chips('birthday')[0]).toEqual(['wedding', 'navGroupInvitation', ['opening', 'profiles', 'milestone', 'weddingDate']])
    expect(chips('birthday')[2]).toEqual(['moments', 'navGroupMoments', ['gallery', 'music']])
  })

  it('labels the event date generically outside weddings and uses registry `required`', () => {
    expect(editorSectionsFor('seminar').find((s) => s.key === 'weddingDate')?.label).toBe('sectionEventDate')
    expect(editorSectionsFor('wedding_ceremony').find((s) => s.key === 'weddingDate')?.label).toBe('sectionWeddingDate')
    expect(isMandatorySection('couple', 'anniversary')).toBe(false)
    expect(isMandatorySection('couple', 'engagement')).toBe(true)
    expect(isMandatorySection('weddingDate', 'seminar')).toBe(true)
    expect(isMandatorySection('couple')).toBe(true)
  })


})
