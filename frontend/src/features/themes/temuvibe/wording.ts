/**
 * Variant-aware wording for the Temuvibe renderer, in the INVITATION's language.
 * Owner-entered titles always win; these are only the defaults.
 */
import { isVariantId, variantOf, type VariantId } from '@/features/invitation/registry'
import type { ProfileRole } from '@/features/invitation/types'
import type { WeddingContent, WeddingLocale } from '@/features/wedding/types'
import { templatesEn, type TemplatesMessageKey } from '@/locales/en/templates'
import { templatesId } from '@/locales/id/templates'

export type TvKey = TemplatesMessageKey
const DICT: Record<WeddingLocale, Record<TvKey, string>> = { en: templatesEn, id: templatesId }

/** A translator bound to an invitation language. `{name}` placeholders are replaced. */
export function tvTranslator(locale: WeddingLocale | undefined) {
  const dict = DICT[locale === 'id' ? 'id' : 'en']
  return (key: TvKey, vars: Record<string, string | number> = {}) => {
    let message = dict[key]
    for (const [name, value] of Object.entries(vars)) message = message.split(`{${name}}`).join(String(value))
    return message
  }
}
export type Translate = ReturnType<typeof tvTranslator>

/**
 * The variant to word the invitation for: the host page's explicit variant, else a
 * best guess from the content (legacy content without `sections` is a wedding).
 */
export function resolveVariant(explicit: VariantId | undefined, content: WeddingContent): VariantId {
  if (explicit && isVariantId(explicit)) return explicit
  const offered = content.sections
  if (!offered) return 'wedding_ceremony'
  if (offered.includes('organization') || offered.includes('speakers')) return 'corporate_event'
  if (offered.includes('agenda')) return 'family_gathering'
  const role = content.profiles?.people[0]?.role
  if (role === 'celebrant') return 'birthday'
  if (role === 'child') return 'khitanan'
  if (role === 'graduate') return 'graduation'
  if (offered.includes('milestone') && offered.includes('couple')) return 'anniversary'
  if (offered.includes('couple')) return offered.includes('amplopDigital') ? 'wedding_ceremony' : 'engagement'
  return 'religious_celebration'
}

const KICKER: Record<VariantId, TvKey> = {
  wedding_ceremony: 'tvKickerWedding',
  wedding_reception: 'tvKickerWedding',
  engagement: 'tvKickerEngagement',
  anniversary: 'tvKickerAnniversary',
  birthday: 'tvKickerBirthday',
  sweet_17: 'tvKickerSweet17',
  khitanan: 'tvKickerKhitanan',
  aqiqah: 'tvKickerAqiqah',
  graduation: 'tvKickerGraduation',
  religious_celebration: 'tvKickerReligious',
  family_reunion: 'tvKickerFamilyReunion',
  family_gathering: 'tvKickerFamilyGathering',
  community_gathering: 'tvKickerCommunity',
  corporate_event: 'tvKickerCorporate',
  company_celebration: 'tvKickerCompany',
  seminar: 'tvKickerSeminar',
  workshop: 'tvKickerWorkshop',
}

export const kickerKey = (variant: VariantId): TvKey => KICKER[variant]
export const isCorporate = (variant: VariantId) => variantOf(variant).category === 'corporate'
export const isWedding = (variant: VariantId) => variantOf(variant).category === 'wedding'

export function dateHeadingKey(variant: VariantId): TvKey {
  return isWedding(variant) ? 'tvDateWedding' : isCorporate(variant) ? 'tvDateCorporate' : 'tvDateEvent'
}

export function eventsHeadingKey(variant: VariantId, count: number): TvKey {
  if (isCorporate(variant)) return 'tvEventsCorporate'
  if (count === 1) return 'tvEventsSingle'
  return isWedding(variant) ? 'tvEventsWedding' : 'tvEventsGeneric'
}

/** Default heading of a profiles group (one role). */
export function profileRoleKey(role: ProfileRole, variant: VariantId): TvKey {
  switch (role) {
    case 'celebrant':
      return 'tvProfilesCelebrant'
    case 'child':
      return variant === 'aqiqah' ? 'tvProfilesAqiqah' : 'tvProfilesKhitanan'
    case 'graduate':
      return 'tvProfilesGraduate'
    case 'host':
      return 'tvProfilesHost'
    case 'organizer':
      return 'tvProfilesOrganizer'
    case 'partner':
      return 'tvProfilesPartner'
  }
}

/** "A, B and C" / "A, B dan C". */
export function joinNames(names: readonly string[], locale: WeddingLocale | undefined): string {
  if (names.length <= 1) return names[0] ?? ''
  const and = locale === 'id' ? 'dan' : 'and'
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`
}
