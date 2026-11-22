import { describe, expect, it } from 'vitest'

import { hasSessionChoices, sessionsFor } from './sessionChoices'

describe('wizard session choices', () => {
  it('ceremony-only by default; the organizer picks the ceremony type (akad, blessing or neutral)', () => {
    expect(sessionsFor('wedding_ceremony', { extra: false }, 'id')).toEqual([{ type: 'ceremony', title: 'Upacara Pernikahan' }])
    expect(sessionsFor('wedding_ceremony', { ceremony: 'akad', extra: false }, 'id')).toEqual([{ type: 'akad', title: 'Akad Nikah' }])
    expect(sessionsFor('wedding_ceremony', { ceremony: 'holy_matrimony', extra: false }, 'en')).toEqual([{ type: 'holy_matrimony', title: 'Holy Matrimony' }])
  })

  it('a reception is only added when asked, after the ceremony', () => {
    expect(sessionsFor('wedding_ceremony', { ceremony: 'akad', extra: true }, 'id')).toEqual([
      { type: 'akad', title: 'Akad Nikah' }, { type: 'reception', title: 'Resepsi' },
    ])
  })

  it('reception-only by default; a ceremony before it is optional', () => {
    expect(sessionsFor('wedding_reception', { extra: false }, 'id')).toEqual([{ type: 'reception', title: 'Resepsi' }])
    expect(sessionsFor('wedding_reception', { ceremony: 'holy_matrimony', extra: true }, 'id')).toEqual([
      { type: 'holy_matrimony', title: 'Pemberkatan Nikah' }, { type: 'reception', title: 'Resepsi' },
    ])
  })

  it('khitanan / aqiqah procession and graduation celebration are optional extras', () => {
    expect(sessionsFor('khitanan', { extra: false }, 'id')).toEqual([{ type: 'celebration', title: 'Syukuran Khitanan' }])
    expect(sessionsFor('aqiqah', { extra: true }, 'id')).toEqual([
      { type: 'ceremony', title: 'Prosesi Aqiqah' }, { type: 'celebration', title: 'Syukuran Aqiqah' },
    ])
    expect(sessionsFor('graduation', { extra: true }, 'en')).toEqual([
      { type: 'ceremony', title: 'Graduation Ceremony' }, { type: 'celebration', title: 'Graduation Celebration' },
    ])
  })

  it('other variants keep their registry presets', () => {
    expect(hasSessionChoices('seminar')).toBe(false)
    expect(sessionsFor('seminar', { extra: true }, 'id')).toBeUndefined()
  })
})
