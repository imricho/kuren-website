/**
 * Client-side checks for the v2.0 sections and RSVP extensions, mirroring the
 * backend limits (contract v2.0 §2). Like the wedding format checks, empty values
 * are allowed (drafts may be incomplete): only values that ARE set must be valid.
 * The server stays authoritative. Rules return codes, never display text.
 */
import { isHttpsUrl, isIsoDate, isTime } from '../wedding/draft'

import {
  PROFILE_ROLES,
  REGISTRATION_FIELD_TYPES,
  RSVP_CONTACT_MODES,
  sectionConfig,
  type MilestoneField,
  type VariantId,
} from './registry'
import type {
  AgendaSection,
  MilestoneSection,
  OrganizationSection,
  ProfilesSection,
  RegistrationField,
  RsvpExtensions,
  SpeakersSection,
} from './types'

export const INVITATION_LIMITS = {
  title: 120,
  name: 120,
  nickname: 40,
  role: 80,
  short: 200,
  long: 2000,
  occasion: 120,
  education: 160,
  partyTheme: 200,
  organization: 160,
  url: 2048,
  profiles: 20,
  agendaItems: 50,
  speakers: 30,
  ageMin: 1,
  ageMax: 150,
  yearsMin: 1,
  yearsMax: 100,
  capacityMin: 1,
  capacityMax: 100000,
  registrationFields: 10,
  registrationLabel: 80,
  registrationOptions: 20,
  registrationOption: 80,
  /** Invitation record `title` (list name). */
  invitationTitle: 120,
} as const

export type InvitationIssueCode =
  | 'required'
  | 'tooLong'
  | 'tooMany'
  | 'outOfRange'
  | 'invalidDate'
  | 'invalidTime'
  | 'endBeforeStart'
  | 'httpsOnly'
  | 'invalidRole'
  | 'invalidType'
  | 'invalidOption'
  | 'unknownReference'
  | 'duplicateId'

export interface InvitationIssue {
  /** Dotted path within the section, e.g. "people.0.name". */
  field: string
  code: InvitationIssueCode
  max?: number
  min?: number
}

type Push = (field: string, code: InvitationIssueCode, extra?: { max?: number; min?: number }) => void

function collector(): { issues: InvitationIssue[]; push: Push } {
  const issues: InvitationIssue[] = []
  return { issues, push: (field, code, extra = {}) => issues.push({ field, code, ...extra }) }
}

function maxLen(push: Push, value: string | undefined, field: string, max: number) {
  if (value !== undefined && value.length > max) push(field, 'tooLong', { max })
}

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n)

function range(push: Push, value: number | undefined, field: string, min: number, max: number) {
  if (value === undefined) return
  if (!isWhole(value) || value < min || value > max) push(field, 'outOfRange', { min, max })
}

function uniqueIds(push: Push, items: { id: string }[], path: string) {
  const seen = new Set<string>()
  items.forEach((item, i) => {
    if (seen.has(item.id)) push(`${path}.${i}.id`, 'duplicateId')
    seen.add(item.id)
  })
}

const L = INVITATION_LIMITS

/** `variant` limits roles to the variant's `profiles.roles` (any role when omitted). */
export function checkProfiles(section: ProfilesSection, variant?: VariantId): InvitationIssue[] {
  const { issues, push } = collector()
  const allowed = (variant && sectionConfig(variant, 'profiles')?.roles) || PROFILE_ROLES
  maxLen(push, section.title, 'title', L.title)
  if (section.people.length > L.profiles) push('people', 'tooMany', { max: L.profiles })
  uniqueIds(push, section.people, 'people')
  section.people.forEach((p, i) => {
    const at = (f: string) => `people.${i}.${f}`
    if (!allowed.includes(p.role)) push(at('role'), 'invalidRole')
    maxLen(push, p.name, at('name'), L.name)
    maxLen(push, p.nickname, at('nickname'), L.nickname)
    maxLen(push, p.description, at('description'), L.long)
    maxLen(push, p.parents, at('parents'), L.short)
    if (p.birthDate !== undefined && p.birthDate !== '' && !isIsoDate(p.birthDate)) push(at('birthDate'), 'invalidDate')
  })
  return issues
}

const MILESTONE_TEXT: Partial<Record<MilestoneField, number>> = {
  occasion: L.occasion,
  institution: L.education,
  program: L.education,
  degree: L.education,
  partyTheme: L.partyTheme,
}

export function checkMilestone(section: MilestoneSection): InvitationIssue[] {
  const { issues, push } = collector()
  maxLen(push, section.title, 'title', L.title)
  range(push, section.age, 'age', L.ageMin, L.ageMax)
  range(push, section.years, 'years', L.yearsMin, L.yearsMax)
  for (const [field, max] of Object.entries(MILESTONE_TEXT) as [MilestoneField, number][])
    maxLen(push, section[field] as string | undefined, field, max)
  maxLen(push, section.description, 'description', L.long)
  return issues
}

export function checkOrganization(section: OrganizationSection): InvitationIssue[] {
  const { issues, push } = collector()
  maxLen(push, section.name, 'name', L.organization)
  maxLen(push, section.tagline, 'tagline', L.short)
  maxLen(push, section.description, 'description', L.long)
  if (section.websiteUrl) {
    if (section.websiteUrl.length > L.url) push('websiteUrl', 'tooLong', { max: L.url })
    else if (!isHttpsUrl(section.websiteUrl)) push('websiteUrl', 'httpsOnly')
  }
  return issues
}

/** `sessionIds` / `speakerIds` (when given) are the ids agenda items may reference. */
export function checkAgenda(section: AgendaSection, refs: { sessionIds?: string[]; speakerIds?: string[] } = {}): InvitationIssue[] {
  const { issues, push } = collector()
  maxLen(push, section.title, 'title', L.title)
  if (section.items.length > L.agendaItems) push('items', 'tooMany', { max: L.agendaItems })
  uniqueIds(push, section.items, 'items')
  section.items.forEach((item, i) => {
    const at = (f: string) => `items.${i}.${f}`
    maxLen(push, item.title, at('title'), L.title)
    maxLen(push, item.description, at('description'), L.long)
    if (item.time && !isTime(item.time)) push(at('time'), 'invalidTime')
    if (item.endTime && !isTime(item.endTime)) push(at('endTime'), 'invalidTime')
    if (isTime(item.time) && isTime(item.endTime) && item.endTime <= item.time) push(at('endTime'), 'endBeforeStart')
    if (item.sessionId && refs.sessionIds && !refs.sessionIds.includes(item.sessionId)) push(at('sessionId'), 'unknownReference')
    if (refs.speakerIds && item.speakerIds?.some((id) => !refs.speakerIds!.includes(id))) push(at('speakerIds'), 'unknownReference')
  })
  return issues
}

export function checkSpeakers(section: SpeakersSection): InvitationIssue[] {
  const { issues, push } = collector()
  maxLen(push, section.title, 'title', L.title)
  if (section.people.length > L.speakers) push('people', 'tooMany', { max: L.speakers })
  uniqueIds(push, section.people, 'people')
  section.people.forEach((p, i) => {
    const at = (f: string) => `people.${i}.${f}`
    maxLen(push, p.name, at('name'), L.name)
    maxLen(push, p.role, at('role'), L.role)
    maxLen(push, p.organization, at('organization'), L.organization)
    maxLen(push, p.bio, at('bio'), L.long)
  })
  return issues
}

export function checkRegistrationField(field: RegistrationField, path: string): InvitationIssue[] {
  const { issues, push } = collector()
  if (!field.label?.trim()) push(`${path}.label`, 'required')
  maxLen(push, field.label, `${path}.label`, L.registrationLabel)
  if (!(REGISTRATION_FIELD_TYPES as readonly string[]).includes(field.type)) push(`${path}.type`, 'invalidType')
  if (field.type === 'select') {
    const options = field.options ?? []
    if (options.length === 0) push(`${path}.options`, 'required')
    if (options.length > L.registrationOptions) push(`${path}.options`, 'tooMany', { max: L.registrationOptions })
    options.forEach((o, i) => {
      if (!o.trim()) push(`${path}.options.${i}`, 'required')
      maxLen(push, o, `${path}.options.${i}`, L.registrationOption)
    })
  } else if (field.options !== undefined && field.options.length) push(`${path}.options`, 'invalidOption')
  return issues
}

/** Checks the v2.0 RSVP settings (the v1 fields are checked by the existing RSVP form). */
export function checkRsvpExtensions(rsvp: RsvpExtensions): InvitationIssue[] {
  const { issues, push } = collector()
  range(push, rsvp.capacity, 'capacity', L.capacityMin, L.capacityMax)
  if (rsvp.collectContact !== undefined && !(RSVP_CONTACT_MODES as readonly string[]).includes(rsvp.collectContact)) push('collectContact', 'invalidOption')
  const fields = rsvp.registrationFields ?? []
  if (fields.length > L.registrationFields) push('registrationFields', 'tooMany', { max: L.registrationFields })
  uniqueIds(push, fields, 'registrationFields')
  fields.forEach((f, i) => issues.push(...checkRegistrationField(f, `registrationFields.${i}`)))
  return issues
}

/** Invitation record `title` (≤ 120; empty allowed). */
export function checkInvitationTitle(title: string | null | undefined): InvitationIssue[] {
  return title && title.length > L.invitationTitle ? [{ field: 'title', code: 'tooLong', max: L.invitationTitle }] : []
}
