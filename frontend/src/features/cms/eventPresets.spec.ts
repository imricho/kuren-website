import { describe, expect, it } from 'vitest'

import { applyPreset, EVENT_PRESETS } from './eventPresets'
import { eventForm } from './forms'

const preset = (key: string) => EVENT_PRESETS.find((p) => p.key === key)!

describe('event presets', () => {
  it('offers Akad Nikah, Pemberkatan, Resepsi, Ngunduh Mantu and Custom with the right types', () => {
    expect(EVENT_PRESETS.map((p) => [p.key, p.type])).toEqual([
      ['akad', 'akad'],
      ['holy_matrimony', 'holy_matrimony'],
      ['reception', 'reception'],
      ['ngunduh_mantu', 'other'],
      ['custom', 'reception'],
    ])
  })

  it('a new custom event defaults to a reception, not "Celebration"', () => {
    expect(eventForm().type).toBe('reception')
  })

  it('fills the localized title, replacing only empty or preset titles', () => {
    expect(applyPreset({ type: 'reception', title: '' }, preset('reception'), 'id')).toEqual({ type: 'reception', title: 'Resepsi' })
    expect(applyPreset({ type: 'reception', title: '' }, preset('reception'), 'en')).toEqual({ type: 'reception', title: 'Reception' })
    expect(applyPreset({ type: 'reception', title: 'Resepsi' }, preset('akad'), 'en')).toEqual({ type: 'akad', title: 'Akad Nikah' })
    expect(applyPreset({ type: 'akad', title: 'Akad Nikah' }, preset('ngunduh_mantu'), 'en')).toEqual({ type: 'other', title: 'Ngunduh Mantu' })
    // A title the couple typed is kept.
    expect(applyPreset({ type: 'reception', title: 'Resepsi Keluarga' }, preset('akad'), 'id')).toEqual({ type: 'akad', title: 'Resepsi Keluarga' })
    // Custom clears a preset title and goes back to the default type.
    expect(applyPreset({ type: 'akad', title: 'Akad Nikah' }, preset('custom'), 'id')).toEqual({ type: 'reception', title: '' })
  })
})
