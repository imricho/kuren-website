/**
 * The creation wizard's "which sessions do you start with?" choices, per variant.
 *
 * Only variants where the right sessions genuinely differ between families get choices;
 * everything else starts with the registry presets. Nothing here changes existing
 * invitations: the result is sent once, as `sessions` on `POST /invitations`.
 */
import type { WeddingLocale } from '@/features/wedding/types'

import type { VariantId } from './registry'

export type CeremonyType = 'akad' | 'holy_matrimony' | 'ceremony'

interface Titled {
  type: string
  title: Record<WeddingLocale, string>
}

export const CEREMONY_TYPES: readonly (Titled & { type: CeremonyType; hint: Record<WeddingLocale, string> })[] = [
  { type: 'akad', title: { en: 'Akad Nikah', id: 'Akad Nikah' }, hint: { en: 'Islamic marriage contract', id: 'Ijab kabul secara Islam' } },
  { type: 'holy_matrimony', title: { en: 'Holy Matrimony', id: 'Pemberkatan Nikah' }, hint: { en: 'Church blessing', id: 'Pemberkatan di gereja' } },
  { type: 'ceremony', title: { en: 'Wedding Ceremony', id: 'Upacara Pernikahan' }, hint: { en: 'Any other tradition, or civil', id: 'Tradisi lain atau catatan sipil' } },
]

const RECEPTION: Titled = { type: 'reception', title: { en: 'Wedding Reception', id: 'Resepsi' } }

/** An optional extra session the organizer can add up front (off by default). */
export interface ExtraSession extends Titled {
  /** Where it goes relative to the main session. */
  position: 'before' | 'after'
  label: Record<WeddingLocale, string>
}

const EXTRAS: Partial<Record<VariantId, ExtraSession>> = {
  wedding_ceremony: { ...RECEPTION, position: 'after', label: { en: 'Also add a reception', id: 'Tambahkan juga resepsi' } },
  khitanan: {
    type: 'ceremony', title: { en: 'Khitanan Procession', id: 'Prosesi Khitanan' }, position: 'before',
    label: { en: 'Also add the procession (separate from the celebration)', id: 'Tambahkan juga prosesi (terpisah dari syukuran)' },
  },
  aqiqah: {
    type: 'ceremony', title: { en: 'Aqiqah Procession', id: 'Prosesi Aqiqah' }, position: 'before',
    label: { en: 'Also add the procession (separate from the celebration)', id: 'Tambahkan juga prosesi (terpisah dari syukuran)' },
  },
  graduation: {
    type: 'celebration', title: { en: 'Graduation Celebration', id: 'Syukuran Wisuda' }, position: 'after',
    label: { en: 'Also add a private celebration after the ceremony', id: 'Tambahkan juga syukuran setelah wisuda' },
  },
}

export interface SessionChoice {
  /** wedding_ceremony: the ceremony type. wedding_reception: the optional ceremony's type. */
  ceremony?: CeremonyType
  /** The variant's extra session (or, for a reception, a ceremony before it). */
  extra: boolean
}

/** Whether the wizard shows session choices for this variant. */
export function hasSessionChoices(variant: VariantId | undefined): boolean {
  return variant === 'wedding_ceremony' || variant === 'wedding_reception' || (!!variant && variant in EXTRAS)
}

export function extraSessionFor(variant: VariantId | undefined): ExtraSession | undefined {
  if (variant === 'wedding_reception') {
    return { type: 'ceremony', title: CEREMONY_TYPES[2]!.title, position: 'before', label: { en: 'Also add the ceremony before the reception', id: 'Tambahkan juga akad / pemberkatan sebelum resepsi' } }
  }
  return variant ? EXTRAS[variant] : undefined
}

/**
 * The `sessions` to create, or `undefined` to use the registry presets (variants without
 * choices). Titles are in the invitation's language.
 */
export function sessionsFor(variant: VariantId, choice: SessionChoice, locale: WeddingLocale): { type: string; title: string }[] | undefined {
  if (!hasSessionChoices(variant)) return undefined
  const ceremony = CEREMONY_TYPES.find((c) => c.type === (choice.ceremony ?? 'ceremony')) ?? CEREMONY_TYPES[2]!
  const own = (s: Titled) => ({ type: s.type, title: s.title[locale] })
  if (variant === 'wedding_ceremony') return choice.extra ? [own(ceremony), own(RECEPTION)] : [own(ceremony)]
  if (variant === 'wedding_reception') return choice.extra ? [own(ceremony), own(RECEPTION)] : [own(RECEPTION)]
  const extra = EXTRAS[variant]!
  const main = MAIN[variant]
  if (!main) return undefined
  if (!choice.extra) return [own(main)]
  return extra.position === 'before' ? [own(extra), own(main)] : [own(main), own(extra)]
}

/** The registry preset each "extra" variant starts with (mirrors invitation_registry.json). */
const MAIN: Partial<Record<VariantId, Titled>> = {
  khitanan: { type: 'celebration', title: { en: 'Khitanan Celebration', id: 'Syukuran Khitanan' } },
  aqiqah: { type: 'celebration', title: { en: 'Aqiqah Celebration', id: 'Syukuran Aqiqah' } },
  graduation: { type: 'ceremony', title: { en: 'Graduation Ceremony', id: 'Upacara Wisuda' } },
}
