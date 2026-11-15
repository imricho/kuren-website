/**
 * Quick starts for a new event. A preset fills in the type and the title; the
 * Indonesian ceremony names are used in both UI languages.
 */
import type { AppLocale } from '@/composables/useAppLocale'
import type { EventType } from '@/features/wedding/types'

import { DEFAULT_EVENT_TYPE } from './forms'

export type EventPresetKey = 'akad' | 'holy_matrimony' | 'reception' | 'ngunduh_mantu' | 'custom'

export interface EventPreset {
  key: EventPresetKey
  type: EventType
  /** Title the preset fills in ('' for a custom event). */
  title: Record<AppLocale, string>
}

export const EVENT_PRESETS: readonly EventPreset[] = [
  { key: 'akad', type: 'akad', title: { en: 'Akad Nikah', id: 'Akad Nikah' } },
  { key: 'holy_matrimony', type: 'holy_matrimony', title: { en: 'Pemberkatan', id: 'Pemberkatan' } },
  { key: 'reception', type: 'reception', title: { en: 'Reception', id: 'Resepsi' } },
  { key: 'ngunduh_mantu', type: 'other', title: { en: 'Ngunduh Mantu', id: 'Ngunduh Mantu' } },
  { key: 'custom', type: DEFAULT_EVENT_TYPE, title: { en: '', id: '' } },
]

/** Titles a preset may have filled in (any language), so choosing another preset can replace them. */
export const PRESET_TITLES: ReadonlySet<string> = new Set(
  EVENT_PRESETS.flatMap((p) => Object.values(p.title)).filter((title) => title !== ''),
)

/**
 * Apply a preset to the current type/title. The title is only replaced when it
 * is empty or was filled in by a preset, so a title the couple typed is kept.
 */
export function applyPreset(
  current: { type: EventType; title: string },
  preset: EventPreset,
  locale: AppLocale,
): { type: EventType; title: string } {
  const title = current.title.trim()
  const replaceable = title === '' || PRESET_TITLES.has(title)
  return { type: preset.type, title: replaceable ? preset.title[locale] : current.title }
}
