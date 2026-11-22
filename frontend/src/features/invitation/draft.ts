/**
 * Preview support for the v2.0 sections (profiles, milestone, organization, agenda,
 * speakers) and the RSVP / session extensions. Used by `toPreviewContent`
 * (features/wedding/draft) so new sections flow through the same draft/public
 * pipeline as the existing ones:
 *
 *  - Sections the variant does not offer are never rendered (dropped).
 *  - `public` mode: disabled or empty sections are dropped, NEVER placeholders.
 *  - `draft` mode: disabled sections keep `enabled: false` (themes hide them);
 *    an enabled list section with nothing to show gets ONE clearly labelled
 *    sample entry (id `placeholder-…`) and is reported as missing.
 *
 * Kept free of imports from features/wedding/draft (that module imports this one).
 */
import { isSafeImageSrc } from '../wedding/format'
import type { ImageAsset, WeddingLocale } from '../wedding/types'

import {
  MILESTONE_FIELDS,
  PROFILE_ROLES,
  REGISTRATION_FIELD_TYPES,
  RSVP_CONTACT_MODES,
  isSectionOffered,
  sectionConfig,
  type MilestoneField,
  type NewSectionId,
  type ProfileRole,
  type VariantId,
} from './registry'
import type {
  AgendaItem,
  AgendaSection,
  InvitationSections,
  MilestoneSection,
  OrganizationSection,
  ProfilePerson,
  ProfilesSection,
  RegistrationField,
  RsvpExtensions,
  Speaker,
  SpeakersSection,
} from './types'

/** Prefix of every sample entry draft mode inserts (never present in public mode). */
export const PLACEHOLDER_ID_PREFIX = 'placeholder-'

type PlaceholderKey = 'profileName' | 'agendaItem' | 'speakerName'
const PLACEHOLDERS: Record<WeddingLocale, Record<PlaceholderKey, string>> = {
  en: { profileName: 'Name to be added', agendaItem: 'Agenda item to be added', speakerName: 'Speaker to be added' },
  id: { profileName: 'Nama belum diisi', agendaItem: 'Susunan acara belum diisi', speakerName: 'Pembicara belum diisi' },
}

/** Every placeholder string this module can insert (tests: public content must contain none). */
export function invitationPlaceholderTexts(): string[] {
  return Object.values(PLACEHOLDERS).flatMap((dict) => Object.values(dict))
}

export interface InvitationPreviewContext {
  isPublic: boolean
  /** Editor language for draft placeholders. */
  uiLocale: WeddingLocale
  /** Offering filter; undefined = no variant known (legacy callers): every section is allowed. */
  variant?: VariantId
  /** Ids of the sessions being rendered (agenda `sessionId` references are kept only if they match). */
  sessionIds: readonly string[]
}

export interface InvitationMissing {
  section: NewSectionId
  field: string
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const text = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}
const isWhole = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}
function safeImage(image: ImageAsset | undefined): ImageAsset | undefined {
  if (!image || !isSafeImageSrc(image.src) || !text(image.alt)) return undefined
  return image.focalPoint ? { src: image.src, alt: image.alt, focalPoint: image.focalPoint } : { src: image.src, alt: image.alt }
}
function httpsUrl(value: unknown): string | undefined {
  const url = text(value)
  if (!url || url.length > 2048 || /[\x00-\x20\\]/.test(url)) return undefined
  try {
    return new URL(url).protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

const offered = (ctx: InvitationPreviewContext, id: NewSectionId) => !ctx.variant || isSectionOffered(ctx.variant, id)

/**
 * Finish a section: public drops disabled/empty ones; draft keeps disabled ones as
 * `{ ...value, enabled: false }` and fills an enabled empty list with a sample.
 */
function finish<T extends { enabled: boolean }>(
  ctx: InvitationPreviewContext,
  enabled: boolean,
  value: Omit<T, 'enabled'>,
  hasContent: boolean,
  sample?: () => Omit<T, 'enabled'>,
  onMissing?: () => void,
): T | undefined {
  if (ctx.isPublic) return enabled && hasContent ? ({ enabled: true, ...value } as T) : undefined
  if (enabled && !hasContent) {
    onMissing?.()
    if (sample) return { enabled: true, ...sample() } as T
  }
  return { enabled, ...value } as T
}

function profilesPreview(section: ProfilesSection, ctx: InvitationPreviewContext, missing: InvitationMissing[]): ProfilesSection | undefined {
  const roles: readonly ProfileRole[] = (ctx.variant && sectionConfig(ctx.variant, 'profiles')?.roles) || PROFILE_ROLES
  const people: ProfilePerson[] = (section.people ?? []).flatMap((p) => {
    const name = text(p.name)
    if (!name || !roles.includes(p.role)) return []
    return [
      compact({
        id: p.id,
        role: p.role,
        name,
        nickname: text(p.nickname),
        image: safeImage(p.image),
        description: text(p.description),
        parents: text(p.parents),
        birthDate: typeof p.birthDate === 'string' && ISO_DATE.test(p.birthDate) ? p.birthDate : undefined,
      }),
    ]
  })
  return finish<ProfilesSection>(
    ctx,
    section.enabled === true,
    compact({ title: text(section.title), people }),
    people.length > 0,
    () => compact({ title: text(section.title), people: [{ id: `${PLACEHOLDER_ID_PREFIX}profile`, role: roles[0]!, name: PLACEHOLDERS[ctx.uiLocale].profileName }] }),
    () => missing.push({ section: 'profiles', field: 'people' }),
  )
}

function milestonePreview(section: MilestoneSection, ctx: InvitationPreviewContext): MilestoneSection | undefined {
  const shown = new Set<MilestoneField>(
    ((ctx.variant && sectionConfig(ctx.variant, 'milestone')?.fields) as readonly MilestoneField[] | undefined) ?? MILESTONE_FIELDS,
  )
  const pick = <K extends MilestoneField>(key: K, value: MilestoneSection[K] | undefined) => (shown.has(key) ? value : undefined)
  const value = compact({
    title: text(section.title),
    age: pick('age', isWhole(section.age, 1, 150) ? section.age : undefined),
    years: pick('years', isWhole(section.years, 1, 100) ? section.years : undefined),
    occasion: pick('occasion', text(section.occasion)),
    institution: pick('institution', text(section.institution)),
    program: pick('program', text(section.program)),
    degree: pick('degree', text(section.degree)),
    partyTheme: pick('partyTheme', text(section.partyTheme)),
    description: text(section.description),
  })
  const hasContent = Object.keys(value).some((k) => k !== 'title')
  return finish<MilestoneSection>(ctx, section.enabled === true, value, hasContent)
}

function organizationPreview(section: OrganizationSection, ctx: InvitationPreviewContext): OrganizationSection | undefined {
  const value = compact({
    name: text(section.name),
    tagline: text(section.tagline),
    description: text(section.description),
    logo: safeImage(section.logo),
    websiteUrl: httpsUrl(section.websiteUrl),
  })
  return finish<OrganizationSection>(ctx, section.enabled === true, value, Object.keys(value).length > 0)
}

function speakersPreview(section: SpeakersSection, ctx: InvitationPreviewContext, missing: InvitationMissing[]): SpeakersSection | undefined {
  const people: Speaker[] = (section.people ?? []).flatMap((p) => {
    const name = text(p.name)
    if (!name) return []
    return [compact({ id: p.id, name, role: text(p.role), organization: text(p.organization), image: safeImage(p.image), bio: text(p.bio) })]
  })
  return finish<SpeakersSection>(
    ctx,
    section.enabled === true,
    compact({ title: text(section.title), people }),
    people.length > 0,
    () => compact({ title: text(section.title), people: [{ id: `${PLACEHOLDER_ID_PREFIX}speaker`, name: PLACEHOLDERS[ctx.uiLocale].speakerName }] }),
    () => missing.push({ section: 'speakers', field: 'people' }),
  )
}

function agendaPreview(
  section: AgendaSection,
  ctx: InvitationPreviewContext,
  speakerIds: ReadonlySet<string>,
  missing: InvitationMissing[],
): AgendaSection | undefined {
  const sessions = new Set(ctx.sessionIds)
  const items: AgendaItem[] = (section.items ?? []).flatMap((item) => {
    const title = text(item.title)
    if (!title) return []
    const time = typeof item.time === 'string' && TIME.test(item.time) ? item.time : undefined
    const endTime = typeof item.endTime === 'string' && TIME.test(item.endTime) && (!time || item.endTime > time) ? item.endTime : undefined
    const speakers = (item.speakerIds ?? []).filter((id) => speakerIds.has(id))
    return [
      compact({
        id: item.id,
        time,
        endTime,
        title,
        description: text(item.description),
        sessionId: item.sessionId && sessions.has(item.sessionId) ? item.sessionId : undefined,
        speakerIds: speakers.length ? speakers : undefined,
      }),
    ]
  })
  return finish<AgendaSection>(
    ctx,
    section.enabled === true,
    compact({ title: text(section.title), items }),
    items.length > 0,
    () => compact({ title: text(section.title), items: [{ id: `${PLACEHOLDER_ID_PREFIX}agenda`, title: PLACEHOLDERS[ctx.uiLocale].agendaItem }] }),
    () => missing.push({ section: 'agenda', field: 'items' }),
  )
}

/** The v2.0 sections of a draft, prepared for a theme. Absent keys = not rendered. */
export function invitationSectionsPreview(
  draft: InvitationSections,
  ctx: InvitationPreviewContext,
): { sections: InvitationSections; missing: InvitationMissing[] } {
  const missing: InvitationMissing[] = []
  const out: InvitationSections = {}
  if (draft.profiles && offered(ctx, 'profiles')) out.profiles = profilesPreview(draft.profiles, ctx, missing)
  if (draft.milestone && offered(ctx, 'milestone')) out.milestone = milestonePreview(draft.milestone, ctx)
  if (draft.organization && offered(ctx, 'organization')) out.organization = organizationPreview(draft.organization, ctx)
  if (draft.speakers && offered(ctx, 'speakers')) out.speakers = speakersPreview(draft.speakers, ctx, missing)
  if (draft.agenda && offered(ctx, 'agenda')) {
    // Agenda items may only point at speakers that are actually rendered.
    const speakerIds = new Set((out.speakers?.enabled ? out.speakers.people : []).map((p) => p.id))
    out.agenda = agendaPreview(draft.agenda, ctx, speakerIds, missing)
  }
  return { sections: compact(out), missing }
}

function registrationFieldPreview(field: RegistrationField): RegistrationField | undefined {
  const label = text(field.label)
  if (!label || !(REGISTRATION_FIELD_TYPES as readonly string[]).includes(field.type)) return undefined
  if (field.type !== 'select') return { id: field.id, label, type: field.type, required: field.required === true }
  const options = (field.options ?? []).map((o) => text(o)).filter((o): o is string => !!o)
  return options.length ? { id: field.id, label, type: 'select', required: field.required === true, options } : undefined
}

/** v2.0 RSVP settings, valid values only (`full` is a snapshot-only flag, public mode only). */
export function rsvpExtensionsPreview(rsvp: RsvpExtensions, isPublic: boolean): RsvpExtensions {
  const fields = (rsvp.registrationFields ?? []).map(registrationFieldPreview).filter((f): f is RegistrationField => !!f)
  return compact({
    capacity: isWhole(rsvp.capacity, 1, 100000) ? rsvp.capacity : undefined,
    collectContact: rsvp.collectContact && (RSVP_CONTACT_MODES as readonly string[]).includes(rsvp.collectContact) && rsvp.collectContact !== 'none' ? rsvp.collectContact : undefined,
    allowSessionChoice: rsvp.allowSessionChoice === true ? true : undefined,
    registrationFields: fields.length ? fields : undefined,
    full: isPublic && rsvp.full === true ? true : undefined,
  })
}

/** `events[].optional` for a theme: only `true` is meaningful. */
export function sessionOptionalPreview(optional: boolean | undefined): { optional?: true } {
  return optional === true ? { optional: true } : {}
}
