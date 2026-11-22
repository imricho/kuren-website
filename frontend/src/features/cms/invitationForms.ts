/**
 * Form state, payloads and client checks for the v2.0 sections (profiles,
 * milestone, organization, agenda, speakers). Same conventions as forms.ts /
 * universalForms.ts: inputs bind to strings ('' = not set), each payload is the
 * COMPLETE section for `PUT /sections/{id}` (values kept while a switch is off),
 * fully empty repeater rows are dropped on save, half-filled rows hold autosave
 * until fixed. Limits mirror the backend (features/invitation/validation).
 */
import { INVITATION_LIMITS as L } from '@/features/invitation/validation'
import {
  MILESTONE_FIELDS,
  PROFILE_ROLES,
  sectionConfig,
  type MilestoneField,
  type ProfileRole,
  type VariantId,
} from '@/features/invitation/registry'
import type {
  AgendaSection,
  MilestoneSection,
  OrganizationSection,
  ProfilesSection,
  SpeakersSection,
} from '@/features/wedding/types'

import { clean, imageForm, imagePayload, opt, s, type ImageForm } from './forms'
import { newRowId } from './universalForms'
import { Checker, LIMITS, type FieldIssue } from './validation'

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const rowId = (id: string | undefined) => (id && SAFE_ID.test(id) ? id : newRowId())
const emptyImage = (i: ImageForm) => i.src.trim() === ''

// --- Variant hints --------------------------------------------------------------------

/** Person fields a variant's profiles show (registry `fields`); every field without a variant. */
export const PROFILE_FIELDS = ['nickname', 'image', 'description', 'parents', 'birthDate'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]
export function profileFieldsFor(variant: VariantId | null | undefined): readonly ProfileField[] {
  const fields = variant ? sectionConfig(variant, 'profiles')?.fields : undefined
  return (fields as readonly ProfileField[] | undefined) ?? PROFILE_FIELDS
}
export function profileRolesFor(variant: VariantId | null | undefined): readonly ProfileRole[] {
  return (variant && sectionConfig(variant, 'profiles')?.roles) || PROFILE_ROLES
}
export function milestoneFieldsFor(variant: VariantId | null | undefined): readonly MilestoneField[] {
  const fields = variant ? sectionConfig(variant, 'milestone')?.fields : undefined
  return (fields as readonly MilestoneField[] | undefined) ?? MILESTONE_FIELDS
}

// --- Profiles ---------------------------------------------------------------------------
export interface ProfilePersonForm {
  id: string
  role: ProfileRole
  name: string
  nickname: string
  description: string
  parents: string
  birthDate: string
  image: ImageForm
}
export interface ProfilesForm {
  enabled: boolean
  title: string
  people: ProfilePersonForm[]
}
export const newProfilePerson = (role: ProfileRole): ProfilePersonForm => ({
  id: newRowId(), role, name: '', nickname: '', description: '', parents: '', birthDate: '', image: imageForm(undefined),
})
export const profilesForm = (p: ProfilesSection | undefined): ProfilesForm => ({
  enabled: p?.enabled === true,
  title: s(p?.title),
  people: (p?.people ?? []).map((x) => ({
    id: rowId(x.id),
    role: x.role,
    name: s(x.name),
    nickname: s(x.nickname),
    description: s(x.description),
    parents: s(x.parents),
    birthDate: s(x.birthDate),
    image: imageForm(x.image),
  })),
})
export const isEmptyProfile = (p: ProfilePersonForm) =>
  !p.name.trim() && !p.nickname.trim() && !p.description.trim() && !p.parents.trim() && !p.birthDate.trim() && emptyImage(p.image)
export const profilesPayload = (f: ProfilesForm): ProfilesSection =>
  clean({
    enabled: f.enabled,
    title: opt(f.title),
    people: f.people.filter((p) => !isEmptyProfile(p)).map((p) =>
      clean({
        id: p.id,
        role: p.role,
        name: p.name.trim(),
        nickname: opt(p.nickname),
        image: imagePayload(p.image),
        description: opt(p.description),
        parents: opt(p.parents),
        birthDate: opt(p.birthDate),
      }),
    ),
  })
export function validateProfiles(f: ProfilesForm, roles: readonly ProfileRole[] = PROFILE_ROLES): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  if (f.people.length > L.profiles) c.issues.push({ field: 'people', code: 'tooMany', max: L.profiles })
  f.people.forEach((p, i) => {
    if (isEmptyProfile(p)) return
    const at = `people.${i}`
    c.required(`${at}.name`, p.name)
    if (!roles.includes(p.role)) c.issues.push({ field: `${at}.role`, code: 'required' })
    c.max(`${at}.name`, p.name, L.name)
    c.max(`${at}.nickname`, p.nickname, L.nickname)
    c.max(`${at}.description`, p.description, L.long)
    c.max(`${at}.parents`, p.parents, L.short)
    c.date(`${at}.birthDate`, p.birthDate)
    c.image(`${at}.image`, p.image)
  })
  return c.issues
}

// --- Milestone ----------------------------------------------------------------------------
export interface MilestoneForm {
  enabled: boolean
  title: string
  age: string
  years: string
  occasion: string
  institution: string
  program: string
  degree: string
  partyTheme: string
  description: string
}
const num = (n: number | undefined) => (n === undefined ? '' : String(n))
export const milestoneForm = (m: MilestoneSection | undefined): MilestoneForm => ({
  enabled: m?.enabled === true,
  title: s(m?.title),
  age: num(m?.age),
  years: num(m?.years),
  occasion: s(m?.occasion),
  institution: s(m?.institution),
  program: s(m?.program),
  degree: s(m?.degree),
  partyTheme: s(m?.partyTheme),
  description: s(m?.description),
})
const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v.trim()))
export const milestonePayload = (f: MilestoneForm): MilestoneSection =>
  clean({
    enabled: f.enabled,
    title: opt(f.title),
    age: toNum(f.age),
    years: toNum(f.years),
    occasion: opt(f.occasion),
    institution: opt(f.institution),
    program: opt(f.program),
    degree: opt(f.degree),
    partyTheme: opt(f.partyTheme),
    description: opt(f.description),
  })
export function validateMilestone(f: MilestoneForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.wholeNumber('age', f.age, L.ageMin, L.ageMax)
  c.wholeNumber('years', f.years, L.yearsMin, L.yearsMax)
  c.max('occasion', f.occasion, L.occasion)
  c.max('institution', f.institution, L.education)
  c.max('program', f.program, L.education)
  c.max('degree', f.degree, L.education)
  c.max('partyTheme', f.partyTheme, L.partyTheme)
  c.max('description', f.description, L.long)
  return c.issues
}

// --- Organization ---------------------------------------------------------------------------
export interface OrganizationForm {
  enabled: boolean
  name: string
  tagline: string
  description: string
  websiteUrl: string
  logo: ImageForm
}
export const organizationForm = (o: OrganizationSection | undefined): OrganizationForm => ({
  enabled: o?.enabled === true,
  name: s(o?.name),
  tagline: s(o?.tagline),
  description: s(o?.description),
  websiteUrl: s(o?.websiteUrl),
  logo: imageForm(o?.logo),
})
export const organizationPayload = (f: OrganizationForm): OrganizationSection =>
  clean({
    enabled: f.enabled,
    name: opt(f.name),
    tagline: opt(f.tagline),
    description: opt(f.description),
    logo: imagePayload(f.logo),
    websiteUrl: opt(f.websiteUrl),
  })
export function validateOrganization(f: OrganizationForm): FieldIssue[] {
  const c = new Checker()
  c.max('name', f.name, L.organization)
  c.max('tagline', f.tagline, L.short)
  c.max('description', f.description, L.long)
  c.https('websiteUrl', f.websiteUrl)
  c.image('logo', f.logo)
  return c.issues
}

// --- Agenda ----------------------------------------------------------------------------------
export interface AgendaItemForm {
  id: string
  time: string
  endTime: string
  title: string
  description: string
  /** '' = not linked to a session. */
  sessionId: string
  speakerIds: string[]
}
export interface AgendaForm {
  enabled: boolean
  title: string
  items: AgendaItemForm[]
}
export const newAgendaItem = (): AgendaItemForm => ({ id: newRowId(), time: '', endTime: '', title: '', description: '', sessionId: '', speakerIds: [] })
export const agendaForm = (a: AgendaSection | undefined): AgendaForm => ({
  enabled: a?.enabled === true,
  title: s(a?.title),
  items: (a?.items ?? []).map((i) => ({
    id: rowId(i.id),
    time: s(i.time),
    endTime: s(i.endTime),
    title: s(i.title),
    description: s(i.description),
    sessionId: s(i.sessionId),
    speakerIds: [...(i.speakerIds ?? [])],
  })),
})
export const isEmptyAgendaItem = (i: AgendaItemForm) =>
  !i.time.trim() && !i.endTime.trim() && !i.title.trim() && !i.description.trim() && !i.sessionId && i.speakerIds.length === 0
export const agendaPayload = (f: AgendaForm): AgendaSection =>
  clean({
    enabled: f.enabled,
    title: opt(f.title),
    items: f.items.filter((i) => !isEmptyAgendaItem(i)).map((i) =>
      clean({
        id: i.id,
        time: opt(i.time),
        endTime: opt(i.endTime),
        title: i.title.trim(),
        description: opt(i.description),
        sessionId: i.sessionId || undefined,
        speakerIds: i.speakerIds.length ? [...i.speakerIds] : undefined,
      }),
    ),
  })
export function validateAgenda(f: AgendaForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  if (f.items.length > L.agendaItems) c.issues.push({ field: 'items', code: 'tooMany', max: L.agendaItems })
  f.items.forEach((i, n) => {
    if (isEmptyAgendaItem(i)) return
    const at = `items.${n}`
    c.required(`${at}.title`, i.title)
    c.max(`${at}.title`, i.title, L.title)
    c.max(`${at}.description`, i.description, L.long)
    c.time(`${at}.time`, i.time)
    c.time(`${at}.endTime`, i.endTime)
    const [start, end] = [i.time.trim(), i.endTime.trim()]
    if (/^\d\d:\d\d$/.test(start) && /^\d\d:\d\d$/.test(end) && end <= start) c.issues.push({ field: `${at}.endTime`, code: 'endBeforeStart' })
  })
  return c.issues
}

// --- Speakers --------------------------------------------------------------------------------
export interface SpeakerForm {
  id: string
  name: string
  role: string
  organization: string
  bio: string
  image: ImageForm
}
export interface SpeakersForm {
  enabled: boolean
  title: string
  people: SpeakerForm[]
}
export const newSpeaker = (): SpeakerForm => ({ id: newRowId(), name: '', role: '', organization: '', bio: '', image: imageForm(undefined) })
export const speakersForm = (sp: SpeakersSection | undefined): SpeakersForm => ({
  enabled: sp?.enabled === true,
  title: s(sp?.title),
  people: (sp?.people ?? []).map((p) => ({
    id: rowId(p.id),
    name: s(p.name),
    role: s(p.role),
    organization: s(p.organization),
    bio: s(p.bio),
    image: imageForm(p.image),
  })),
})
export const isEmptySpeaker = (p: SpeakerForm) => !p.name.trim() && !p.role.trim() && !p.organization.trim() && !p.bio.trim() && emptyImage(p.image)
export const speakersPayload = (f: SpeakersForm): SpeakersSection =>
  clean({
    enabled: f.enabled,
    title: opt(f.title),
    people: f.people.filter((p) => !isEmptySpeaker(p)).map((p) =>
      clean({ id: p.id, name: p.name.trim(), role: opt(p.role), organization: opt(p.organization), image: imagePayload(p.image), bio: opt(p.bio) }),
    ),
  })
export function validateSpeakers(f: SpeakersForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  if (f.people.length > L.speakers) c.issues.push({ field: 'people', code: 'tooMany', max: L.speakers })
  f.people.forEach((p, i) => {
    if (isEmptySpeaker(p)) return
    const at = `people.${i}`
    c.required(`${at}.name`, p.name)
    c.max(`${at}.name`, p.name, L.name)
    c.max(`${at}.role`, p.role, L.name)
    c.max(`${at}.organization`, p.organization, L.organization)
    c.max(`${at}.bio`, p.bio, L.long)
    c.image(`${at}.image`, p.image)
  })
  return c.issues
}

/**
 * Server 422 paths count only the rows that were sent (empty rows are dropped):
 * map `people.<n>.…` / `items.<n>.…` back to the form row index.
 */
export function mapRowField<T>(field: string, list: string, rows: readonly T[], isEmpty: (row: T) => boolean): string {
  const m = field.match(new RegExp(`^${list}\\.(\\d+)\\.(.+)$`))
  if (!m) return field
  const sent = rows.map((row, i) => [row, i] as const).filter(([row]) => !isEmpty(row))
  const index = sent[Number(m[1])]?.[1]
  return index === undefined ? field : `${list}.${index}.${m[2]}`
}
