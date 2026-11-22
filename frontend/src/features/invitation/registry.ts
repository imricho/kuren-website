/**
 * Typed mirror of `backend/app/core/invitation_registry.json` (the single source of
 * truth, docs/architecture/invitation-engine.md §1–§2, §5): categories, variants,
 * per-variant section config, session presets, RSVP defaults and template
 * compatibility. `registry.parity.spec.ts` reads the backend JSON from disk and fails
 * on any drift — change the JSON (and the contract) first, then this file.
 *
 * Ids are stable: never rename them.
 */
import { EVENT_TYPES, WEDDING_EVENT_TYPES, type EventType } from '../wedding/types'

export type Locale = 'en' | 'id'
export interface Label {
  en: string
  id: string
}

// --- Ids ---------------------------------------------------------------------------

export const CATEGORY_IDS = ['wedding', 'celebration', 'gathering', 'corporate'] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

export const VARIANT_IDS = [
  'wedding_ceremony', 'wedding_reception',
  'birthday', 'sweet_17', 'khitanan', 'aqiqah', 'engagement', 'anniversary', 'graduation', 'religious_celebration',
  'family_reunion', 'family_gathering', 'community_gathering',
  'corporate_event', 'company_celebration', 'seminar', 'workshop',
] as const
export type VariantId = (typeof VARIANT_IDS)[number]

/** Canonical render order of every section (contract §5). */
export const SECTION_ORDER = [
  'opening', 'holyRecite1', 'greeting', 'couple', 'profiles', 'organization', 'milestone', 'countdown',
  'events', 'agenda', 'speakers', 'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
] as const
export type SectionId = (typeof SECTION_ORDER)[number]

/** Sections added by the invitation engine (v2.0); the rest already existed for weddings. */
export const NEW_SECTION_IDS = ['profiles', 'milestone', 'organization', 'agenda', 'speakers'] as const satisfies readonly SectionId[]
export type NewSectionId = (typeof NEW_SECTION_IDS)[number]

export const PROFILE_ROLES = ['celebrant', 'child', 'graduate', 'host', 'partner', 'organizer'] as const
export type ProfileRole = (typeof PROFILE_ROLES)[number]

export const MILESTONE_FIELDS = ['age', 'years', 'occasion', 'institution', 'program', 'degree', 'partyTheme'] as const
export type MilestoneField = (typeof MILESTONE_FIELDS)[number]

export const RSVP_CONTACT_MODES = ['none', 'email', 'phone', 'email_or_phone'] as const
export type RsvpContactMode = (typeof RSVP_CONTACT_MODES)[number]

export const REGISTRATION_FIELD_TYPES = ['text', 'textarea', 'email', 'phone', 'select', 'checkbox'] as const
export type RegistrationFieldType = (typeof REGISTRATION_FIELD_TYPES)[number]

// --- Shapes --------------------------------------------------------------------------

export interface SectionConfig {
  id: SectionId
  /** Always shown; no "Show on website" switch. */
  required: boolean
  /** Enabled flag seeded on create (required sections are always on). */
  defaultEnabled: boolean
  /** `profiles` only: roles the editor offers for `people[].role`. */
  roles?: readonly ProfileRole[]
  /** `milestone`: fields the editor shows; `profiles`: optional person fields shown (e.g. parents, birthDate). */
  fields?: readonly string[]
  /** Values seeded on create (e.g. sweet_17 → `{ age: 17 }`). */
  defaults?: Readonly<Record<string, unknown>>
}

export interface RegistrationFieldDefault {
  id: string
  label: Label
  type: RegistrationFieldType
  required: boolean
  options?: readonly string[]
}

/** RSVP values seeded on create; absent keys keep the editor defaults. */
export interface RsvpDefaults {
  maxGuestsPerResponse?: number
  collectContact?: RsvpContactMode
  allowSessionChoice?: boolean
  registrationFields?: readonly RegistrationFieldDefault[]
}

export interface SessionPreset {
  type: EventType
  title: Label
}

export interface CategoryDef {
  id: CategoryId
  label: Label
  /** Variants of the category, in wizard order. */
  variants: readonly VariantId[]
}

export interface VariantDef {
  id: VariantId
  category: CategoryId
  label: Label
  /** Offered sections, in canonical order. Sections not listed are never offered, rendered or published. */
  sections: readonly SectionConfig[]
  /** Sessions seeded on create, in order. */
  sessionPresets: readonly SessionPreset[]
  rsvpDefaults: RsvpDefaults
}

export interface TemplateCompatibility {
  id: string
  categories: readonly CategoryId[]
  /** Omitted = every variant of those categories. */
  variants?: readonly VariantId[]
}

// --- Data (mirror of backend/app/core/invitation_registry.json) ------------------------

export const DEFAULT_TIMEZONE = 'Asia/Jakarta'

export const CATEGORIES: readonly CategoryDef[] = [
  { id: 'wedding', label: { en: 'Wedding', id: 'Pernikahan' }, variants: ['wedding_ceremony', 'wedding_reception'] },
  {
    id: 'celebration',
    label: { en: 'Celebration', id: 'Perayaan' },
    variants: ['birthday', 'sweet_17', 'khitanan', 'aqiqah', 'engagement', 'anniversary', 'graduation', 'religious_celebration'],
  },
  { id: 'gathering', label: { en: 'Gathering', id: 'Kumpul & Komunitas' }, variants: ['family_reunion', 'family_gathering', 'community_gathering'] },
  { id: 'corporate', label: { en: 'Corporate', id: 'Perusahaan' }, variants: ['corporate_event', 'company_celebration', 'seminar', 'workshop'] },
]

const req = (id: SectionId): SectionConfig => ({ id, required: true, defaultEnabled: true })
const on = (id: SectionId, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, required: false, defaultEnabled: true, ...extra })
const off = (id: SectionId, extra: Partial<SectionConfig> = {}): SectionConfig => ({ id, required: false, defaultEnabled: false, ...extra })
const preset = (type: EventType, en: string, id: string): SessionPreset => ({ type, title: { en, id } })

/** The 13 wedding sections (the original wedding editor). */
const WEDDING_SECTIONS: readonly SectionConfig[] = [
  req('opening'), off('holyRecite1'), off('greeting'), req('couple'), req('countdown'), req('events'),
  off('story'), off('gallery'), off('rsvp'), off('wishes'), off('amplopDigital'), off('holyRecite2'), req('closing'),
]

const birthdaySections = (milestoneDefaults?: Record<string, unknown>): readonly SectionConfig[] => [
  req('opening'),
  on('profiles', { roles: ['celebrant'], fields: ['nickname', 'image', 'description', 'birthDate'] }),
  on('milestone', { fields: ['age', 'partyTheme'], ...(milestoneDefaults ? { defaults: milestoneDefaults } : {}) }),
  req('countdown'), req('events'), off('gallery'), on('rsvp'), off('wishes'), off('amplopDigital'), req('closing'),
]

const childSections = (fields: readonly string[]): readonly SectionConfig[] => [
  req('opening'), off('holyRecite1'), off('greeting'),
  on('profiles', { roles: ['child'], fields }),
  req('countdown'), req('events'), off('gallery'), on('rsvp'), off('wishes'), off('amplopDigital'), req('closing'),
]

const GATHERING_SECTIONS: readonly SectionConfig[] = [
  req('opening'), off('greeting'), on('profiles', { roles: ['host', 'organizer'], fields: ['image', 'description'] }),
  req('countdown'), req('events'), on('agenda'), off('gallery'), on('rsvp'), req('closing'),
]

const CORPORATE_SECTIONS: readonly SectionConfig[] = [
  req('opening'), on('organization'), req('countdown'), req('events'), on('agenda'), off('speakers'), off('gallery'), on('rsvp'), req('closing'),
]

const SEMINAR_SECTIONS: readonly SectionConfig[] = [
  req('opening'), on('organization'), req('countdown'), req('events'), on('agenda'), on('speakers'), on('rsvp'), req('closing'),
]

const v = (
  id: VariantId,
  category: CategoryId,
  label: Label,
  sections: readonly SectionConfig[],
  sessionPresets: readonly SessionPreset[],
  rsvpDefaults: RsvpDefaults = {},
): VariantDef => ({ id, category, label, sections, sessionPresets, rsvpDefaults })

const RECEPTION = preset('reception', 'Wedding Reception', 'Resepsi')
const SYUKURAN = preset('celebration', 'Celebration', 'Syukuran')
const MAIN_SESSION = preset('session', 'Main Session', 'Sesi Utama')
const GATHERING_RSVP: RsvpDefaults = { maxGuestsPerResponse: 10 }
const SEMINAR_RSVP: RsvpDefaults = {
  collectContact: 'email',
  registrationFields: [{ id: 'company', label: { en: 'Company', id: 'Perusahaan / Instansi' }, type: 'text', required: false }],
}

export const VARIANTS: readonly VariantDef[] = [
  v('wedding_ceremony', 'wedding', { en: 'Wedding Ceremony', id: 'Akad / Pemberkatan' }, WEDDING_SECTIONS, [preset('akad', 'Akad Nikah', 'Akad Nikah'), RECEPTION]),
  v('wedding_reception', 'wedding', { en: 'Wedding Reception', id: 'Resepsi Pernikahan' }, WEDDING_SECTIONS, [RECEPTION]),
  v('birthday', 'celebration', { en: 'Birthday', id: 'Ulang Tahun' }, birthdaySections(), [preset('party', 'Birthday Party', 'Pesta Ulang Tahun')]),
  v('sweet_17', 'celebration', { en: 'Sweet 17', id: 'Sweet Seventeen' }, birthdaySections({ age: 17 }), [preset('party', 'Sweet Seventeen Party', 'Pesta Sweet Seventeen')]),
  v('khitanan', 'celebration', { en: 'Khitanan', id: 'Khitanan' }, childSections(['nickname', 'image', 'description', 'parents']), [
    preset('ceremony', 'Khitanan Ceremony', 'Prosesi Khitanan'), SYUKURAN,
  ]),
  v('aqiqah', 'celebration', { en: 'Aqiqah', id: 'Aqiqah' }, childSections(['nickname', 'image', 'description', 'parents', 'birthDate']), [
    preset('ceremony', 'Aqiqah Ceremony', 'Prosesi Aqiqah'), SYUKURAN,
  ]),
  v('engagement', 'celebration', { en: 'Engagement', id: 'Lamaran / Tunangan' }, [
    req('opening'), off('greeting'), req('couple'), req('countdown'), req('events'), off('story'), off('gallery'), on('rsvp'), off('wishes'), req('closing'),
  ], [preset('engagement', 'Engagement', 'Lamaran')]),
  v('anniversary', 'celebration', { en: 'Anniversary', id: 'Anniversary' }, [
    req('opening'), on('couple'), off('profiles', { roles: ['partner', 'host'], fields: ['image', 'description'] }), on('milestone', { fields: ['years'] }),
    req('countdown'), req('events'), off('story'), off('gallery'), on('rsvp'), off('wishes'), req('closing'),
  ], [preset('celebration', 'Anniversary Celebration', 'Perayaan Anniversary')]),
  v('graduation', 'celebration', { en: 'Graduation', id: 'Wisuda' }, [
    req('opening'), on('profiles', { roles: ['graduate'], fields: ['nickname', 'image', 'description'] }), on('milestone', { fields: ['institution', 'program', 'degree'] }),
    req('countdown'), req('events'), off('gallery'), on('rsvp'), off('wishes'), req('closing'),
  ], [preset('ceremony', 'Graduation Ceremony', 'Upacara Wisuda')]),
  v('religious_celebration', 'celebration', { en: 'Religious Celebration', id: 'Perayaan Keagamaan' }, [
    req('opening'), off('holyRecite1'), off('greeting'), on('profiles', { roles: ['host'], fields: ['image', 'description'] }), on('milestone', { fields: ['occasion'] }),
    req('countdown'), req('events'), on('rsvp'), off('wishes'), req('closing'),
  ], [preset('celebration', 'Celebration', 'Perayaan')]),
  v('family_reunion', 'gathering', { en: 'Family Reunion', id: 'Reuni Keluarga' }, GATHERING_SECTIONS, [preset('gathering', 'Family Reunion', 'Reuni Keluarga')], GATHERING_RSVP),
  v('family_gathering', 'gathering', { en: 'Family Gathering', id: 'Kumpul Keluarga' }, GATHERING_SECTIONS, [preset('gathering', 'Family Gathering', 'Kumpul Keluarga')], GATHERING_RSVP),
  v('community_gathering', 'gathering', { en: 'Community Gathering', id: 'Acara Komunitas' }, GATHERING_SECTIONS, [preset('gathering', 'Community Gathering', 'Acara Komunitas')], GATHERING_RSVP),
  v('corporate_event', 'corporate', { en: 'Corporate Event', id: 'Acara Perusahaan' }, CORPORATE_SECTIONS, [MAIN_SESSION]),
  v('company_celebration', 'corporate', { en: 'Company Celebration', id: 'Perayaan Perusahaan' }, CORPORATE_SECTIONS, [MAIN_SESSION]),
  v('seminar', 'corporate', { en: 'Seminar', id: 'Seminar' }, SEMINAR_SECTIONS, [MAIN_SESSION], SEMINAR_RSVP),
  v('workshop', 'corporate', { en: 'Workshop', id: 'Workshop' }, SEMINAR_SECTIONS, [preset('session', 'Workshop Session', 'Sesi Workshop')], SEMINAR_RSVP),
]

/** The `temuvibe` family (schema-driven renderer, contract §5). */
export const TEMPLATES: readonly TemplateCompatibility[] = [
  { id: 'temuvibe-elegant', categories: ['wedding', 'celebration', 'gathering', 'corporate'] },
  { id: 'temuvibe-minimal', categories: ['wedding', 'celebration', 'gathering', 'corporate'] },
  { id: 'temuvibe-festive', categories: ['celebration', 'gathering'] },
  { id: 'temuvibe-corporate', categories: ['corporate', 'gathering'] },
]

/** Every other (pre-engine) theme in the selectable list: wedding-style variants only (contract decision 3). */
export const LEGACY_TEMPLATE_COMPATIBILITY: Omit<TemplateCompatibility, 'id'> = {
  categories: ['wedding', 'celebration'],
  variants: ['wedding_ceremony', 'wedding_reception', 'engagement', 'anniversary'],
}

export const DEFAULT_VARIANT: VariantId = 'wedding_ceremony'

// --- Helpers -------------------------------------------------------------------------

const VARIANT_BY_ID = new Map<VariantId, VariantDef>(VARIANTS.map((d) => [d.id, d]))
const TEMPLATE_BY_ID = new Map<string, TemplateCompatibility>(TEMPLATES.map((t) => [t.id, t]))

export const isCategoryId = (value: unknown): value is CategoryId => (CATEGORY_IDS as readonly unknown[]).includes(value)
export const isVariantId = (value: unknown): value is VariantId => (VARIANT_IDS as readonly unknown[]).includes(value)
export const isSectionId = (value: unknown): value is SectionId => (SECTION_ORDER as readonly unknown[]).includes(value)

export function categoryOf(id: CategoryId): CategoryDef {
  return CATEGORIES.find((c) => c.id === id)!
}

/** The variant definition; unknown/absent ids fall back to `wedding_ceremony` (legacy records). */
export function variantOf(id: VariantId | string | null | undefined): VariantDef {
  return VARIANT_BY_ID.get(id as VariantId) ?? VARIANT_BY_ID.get(DEFAULT_VARIANT)!
}

export function variantsOf(category: CategoryId): readonly VariantDef[] {
  return VARIANTS.filter((d) => d.category === category)
}

/** Offered sections of a variant, in canonical order. */
export function sectionsFor(variant: VariantId | string | null | undefined): readonly SectionConfig[] {
  return variantOf(variant).sections
}

export function sectionConfig(variant: VariantId | string | null | undefined, section: SectionId): SectionConfig | undefined {
  return sectionsFor(variant).find((s) => s.id === section)
}

export function isSectionOffered(variant: VariantId | string | null | undefined, section: SectionId): boolean {
  return sectionConfig(variant, section) !== undefined
}

export function isSectionRequired(variant: VariantId | string | null | undefined, section: SectionId): boolean {
  return sectionConfig(variant, section)?.required === true
}

export function isWeddingVariant(variant: VariantId | string | null | undefined): boolean {
  return variantOf(variant).category === 'wedding'
}

/** Template compatibility entry (pre-engine themes get the legacy rule). */
export function templateCompatibility(templateId: string): TemplateCompatibility {
  return TEMPLATE_BY_ID.get(templateId) ?? { id: templateId, ...LEGACY_TEMPLATE_COMPATIBILITY }
}

export function isTemplateCompatible(templateId: string, variant: VariantId): boolean {
  const compat = templateCompatibility(templateId)
  const def = variantOf(variant)
  if (!compat.categories.includes(def.category)) return false
  return compat.variants ? compat.variants.includes(variant) : true
}

/** Sort section ids into the canonical render order (unknown ids are dropped, duplicates removed). */
export function canonicalSectionOrder<T extends SectionId>(ids: Iterable<T>): T[] {
  const set = new Set<SectionId>(ids)
  return SECTION_ORDER.filter((id) => set.has(id)) as T[]
}

export function variantLabel(variant: VariantId | string | null | undefined, locale: Locale): string {
  return variantOf(variant).label[locale]
}

/** Session types the editor offers for a variant (wedding variants keep the original six). */
export function sessionTypesFor(variant: VariantId | string | null | undefined): readonly EventType[] {
  return isWeddingVariant(variant) ? WEDDING_EVENT_TYPES : EVENT_TYPES
}
