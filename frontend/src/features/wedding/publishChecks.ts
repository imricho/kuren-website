/**
 * Client-side publish checklist. Mirrors the server's blocking rules for
 * POST /weddings/{id}/publish (docs/api/weddings.md, CMS v2.0 "Publishing"), so
 * couples see what to fix before trying, plus non-blocking warnings.
 *
 * The server stays the authority: its dry run (`GET …/publish-check`) and its 422
 * `publish_blocked` details are mapped to the same `PublishIssue` shape
 * (`issueFromServer`) and re-worded in the editor's language from their stable codes
 * (`localizeServerIssue`). Shown-but-empty optional sections BLOCK, as on the server.
 */
import type { RouteLocationRaw } from 'vue-router'

import { EDITOR_ROUTE_NAME, editorRouteName } from '@/features/cms/editorRoutes'
import { isSectionOffered, isSectionRequired, isWeddingVariant, NEW_SECTION_IDS, type NewSectionId, type SectionId, type VariantId } from '../invitation/registry'
import { getTheme } from '@/features/themes/core/registry'
import { isSelectable } from '@/features/themes/core/types'
import { publishEn, type PublishMessageKey } from '@/locales/en/publish'
import { publishId } from '@/locales/id/publish'

import {
  isCompleteBankAccount,
  isHttpsUrl,
  isIsoDate,
  isTime,
  isUploadedImageSrc,
  type WeddingDraft,
} from './draft'
import { eventFormat } from './completeness'
import { SAMPLE_IMAGE_PREFIX } from './format'
import { WEDDING_SECTION_ORDER, type HolyReciteSection, type ImageAsset, type WeddingLocale, type WeddingSectionId } from './types'

export type PublishIssueSeverity = 'error' | 'warning'
export type PublishSection = WeddingSectionId | NewSectionId | 'theme'

export interface PublishIssue {
  severity: PublishIssueSeverity
  section: PublishSection
  /** Dotted path within the section, e.g. "weddingDate", "bankAccounts.0.accountNumber". */
  field: string
  /** Stable code, e.g. "required", "incomplete", "invalid", "past_date". */
  code: string
  message: string
  /** Editor page for the section, with `#<field id>` so the field is focused. */
  to: RouteLocationRaw
}

/** Editor route of each section (router names; theme lives in the studio). */
export const SECTION_ROUTE: Record<PublishSection, string> = {
  theme: 'themes',
  ...(Object.fromEntries(WEDDING_SECTION_ORDER.map((key) => [key, editorRouteName(key)])) as Record<WeddingSectionId, string>),
  ...(Object.fromEntries(NEW_SECTION_IDS.map((key) => [key, editorRouteName(key)])) as Record<NewSectionId, string>),
}

/** DOM id of an editor field; same scheme as features/cms/validation `fieldId(path)`. */
export function fieldDomId(path: string): string {
  return `f-${path.replace(/[^A-Za-z0-9]+/g, '-')}`
}

export function issueLocation(section: PublishSection, field: string): RouteLocationRaw {
  // Names are edited on the Opening page (ids `couple.groom.name` / `couple.bride.name`).
  const name = section === 'couple' && /^couple\.(groom|bride)\.name$/.test(field) ? SECTION_ROUTE.opening : (SECTION_ROUTE[section] ?? EDITOR_ROUTE_NAME)
  return field && section !== 'theme' ? { name, hash: `#${fieldDomId(field)}` } : { name }
}

const EVENT_FIELD_LABEL = {
  title: 'eventFieldTitle',
  date: 'eventFieldDate',
  startTime: 'eventFieldStartTime',
  venueName: 'eventFieldVenue',
  address: 'eventFieldAddress',
} as const satisfies Record<string, PublishMessageKey>

const DICT: Record<WeddingLocale, Record<PublishMessageKey, string>> = { en: publishEn, id: publishId }
function message(locale: WeddingLocale, key: PublishMessageKey, vars: Record<string, string | number> = {}): string {
  return DICT[locale][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

const has = (value: string | undefined): value is string => !!value && value.trim() !== ''
/** Milestone values may be numbers (age, years) as well as text. */
const present = (value: unknown): boolean =>
  typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim() !== ''

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export interface PublishCheckOptions {
  themeId: string | null | undefined
  /** Language of the messages (the editor UI language). */
  locale?: WeddingLocale
  today?: Date
  /** The invitation's variant: only offered sections are checked; non-wedding wording. */
  variant?: VariantId | null
}

/**
 * Run every check over the SAVED draft. Errors block publishing; warnings don't.
 * Order follows the website's section order.
 */
export function publishChecks(draft: WeddingDraft, options: PublishCheckOptions): PublishIssue[] {
  const locale = options.locale ?? 'en'
  const today = toLocalIso(options.today ?? new Date())
  const issues: PublishIssue[] = []
  const variant = options.variant ?? undefined
  const offers = (id: SectionId) => !variant || isSectionOffered(variant, id)
  const wedding = !variant || isWeddingVariant(variant)
  const coupleShown = offers('couple') && !(variant && !isSectionRequired(variant, 'couple') && draft.couple?.enabled === false)
  const add = (severity: PublishIssueSeverity, section: PublishSection, field: string, code: string, key: PublishMessageKey, vars?: Record<string, string | number>) =>
    issues.push({ severity, section, field, code, message: message(locale, key, vars), to: issueLocation(section, field) })
  const error = (section: PublishSection, field: string, code: string, key: PublishMessageKey, vars?: Record<string, string | number>) =>
    add('error', section, field, code, key, vars)
  const warn = (section: PublishSection, field: string, code: string, key: PublishMessageKey, vars?: Record<string, string | number>) =>
    add('warning', section, field, code, key, vars)

  // Theme
  const theme = getTheme(options.themeId)
  if (!theme || !isSelectable(theme)) error('theme', 'themeId', 'required', 'checkTheme')

  // Opening & couple (names are edited on the Opening page)
  const o = draft.opening ?? {}
  if (!isIsoDate(o.weddingDate)) error('opening', 'weddingDate', 'required', wedding ? 'checkWeddingDate' : 'checkEventDate')
  if (coupleShown && !has(draft.couple?.groom?.name)) error('couple', 'couple.groom.name', 'required', 'checkGroomName')
  if (coupleShown && !has(draft.couple?.bride?.name)) error('couple', 'couple.bride.name', 'required', 'checkBrideName')
  if (!o.coverImage) warn('opening', 'coverImage', 'recommended', 'warnCover')

  // Holy Recite 1, Greeting
  if (offers('holyRecite1')) holyRecite('holyRecite1', draft.holyRecite1)
  const g = draft.greeting
  // Server rule: title or message (a prayer alone does not count).
  if (offers('greeting') && g?.enabled && !has(g.title) && !has(g.message)) error('greeting', 'message', 'incomplete', 'checkGreeting')

  // Events: at least one, and EVERY event complete (server checks each, in display order).
  const events = draft.events ?? []
  if (events.length === 0) error('events', 'events', 'required', 'checkEvent')
  const EVENT_FIELDS = [
    ['title', (e: (typeof events)[number]) => has(e.title)],
    ['date', (e: (typeof events)[number]) => isIsoDate(e.date)],
    ['startTime', (e: (typeof events)[number]) => isTime(e.startTime)],
    ['venueName', (e: (typeof events)[number]) => has(e.venueName)],
    ['address', (e: (typeof events)[number]) => has(e.address)],
  ] as const
  events.forEach((e, i) => {
    const name = e.title?.trim() || message(locale, 'eventNumber', { n: i + 1 })
    const format = eventFormat(e)
    for (const [field, ok] of EVENT_FIELDS) {
      if ((field === 'venueName' || field === 'address') && format === 'online') continue
      if (!ok(e)) error('events', `${i}.${field}`, 'required', 'checkEventField', { event: name, field: message(locale, EVENT_FIELD_LABEL[field]) })
    }
    if (format !== 'in_person' && !has(e.onlineUrl) && !has(e.onlineInstructions)) error('events', `${i}.onlineUrl`, 'required', 'checkEventOnline', { event: name })
    if (e.livestream?.enabled && !has(e.livestream.url)) error('events', `${i}.livestream.url`, 'required', 'checkLivestream', { event: name })
    else if (e.livestream?.enabled && !isHttpsUrl(e.livestream.url?.trim())) error('events', `${i}.livestream.url`, 'invalid', 'checkLivestream', { event: name })
    if (e.dressCode?.enabled && !has(e.dressCode.text)) warn('events', `${i}.dressCode.text`, 'empty', 'warnDressCode', { event: name })
    if (isIsoDate(e.date) && e.date < today) warn('events', `${i}.date`, 'past_date', 'warnEventPast', { event: name })
  })

  // Story & gallery: when shown they need content (server blocks; turning them off is the fix).
  if (offers('story') && draft.story?.enabled !== false && !(draft.story?.timeline ?? []).some((s) => has(s.title) && has(s.description)))
    error('story', 'timeline', 'incomplete', 'warnStoryEmpty')
  if (offers('gallery') && draft.gallery?.enabled !== false && (draft.gallery?.images?.length ?? 0) === 0) error('gallery', 'images', 'incomplete', 'warnGalleryEmpty')

  // RSVP
  const r = draft.rsvp
  if (r?.enabled !== false) {
    // RSVP never blocks; without a title guests see the default heading.
    if (!has(r?.title)) warn('rsvp', 'title', 'missing_title', 'checkRsvpTitle')
    if (isIsoDate(r?.deadline) && isIsoDate(o.weddingDate) && r!.deadline! > o.weddingDate!)
      warn('rsvp', 'deadline', 'after_wedding', wedding ? 'warnRsvpDeadline' : 'warnRsvpDeadlineEvent')
    if (r?.allowSessionChoice && !events.some((e) => e.optional)) warn('rsvp', 'allowSessionChoice', 'no_optional_sessions', 'warnSessionChoiceNoOptional')
  }

  // v2.0 sections (only where offered and shown)
  const p2 = draft.profiles
  if (offers('profiles') && p2?.enabled && !(p2.people ?? []).some((x) => has(x.name))) error('profiles', 'people', 'incomplete', 'checkProfiles')
  // Shown but empty BLOCKS publishing (same rule and fields as the server): add content or hide it.
  const m = draft.milestone
  if (offers('milestone') && m?.enabled && !Object.entries(m).some(([k, v]) => k !== 'enabled' && k !== 'title' && present(v)))
    error('milestone', '', 'incomplete', 'checkMilestone')
  if (offers('organization') && draft.organization?.enabled && !has(draft.organization.name)) error('organization', 'name', 'required', 'checkOrganization')
  if (offers('agenda') && draft.agenda?.enabled && !(draft.agenda.items ?? []).some((i) => has(i.title))) error('agenda', 'items', 'incomplete', 'checkAgenda')
  if (offers('speakers') && draft.speakers?.enabled && !(draft.speakers.people ?? []).some((x) => has(x.name))) error('speakers', 'people', 'incomplete', 'checkSpeakers')

  // Amplop Digital
  // Every method that is ON needs complete content, and at least one method must be on.
  const a = offers('amplopDigital') ? draft.amplopDigital : undefined
  if (a?.enabled) {
    if (!a.bankAccountsEnabled && !a.qrisEnabled && !a.physicalGifts?.enabled) error('amplopDigital', '', 'incomplete', 'checkAmplopMethod')
    if (a.bankAccountsEnabled) {
      const rows = a.bankAccounts ?? []
      if (rows.length === 0) error('amplopDigital', 'bankAccounts', 'incomplete', 'checkBankAccounts')
      rows.forEach((row, i) => {
        if (!isCompleteBankAccount(row)) error('amplopDigital', `bankAccounts.${i}.accountNumber`, 'invalid', 'checkBankRow', { n: i + 1 })
      })
    }
    if (a.qrisEnabled) {
      if (!has(a.qrisImage?.src)) error('amplopDigital', 'qrisImage', 'required', 'checkQrisUpload')
      else if (!isUploadedImageSrc(a.qrisImage?.src)) error('amplopDigital', 'qrisImage', 'invalid', 'checkQrisUpload')
      else if (!has(a.qrisImage?.alt)) error('amplopDigital', 'qrisImage.alt', 'required', 'checkQrisAlt')
    }
    const p = a.physicalGifts
    if (p?.enabled) {
      if (!has(p.recipient)) error('amplopDigital', 'physicalGifts.recipient', 'required', 'checkPhysical')
      if (!has(p.address)) error('amplopDigital', 'physicalGifts.address', 'required', 'checkPhysical')
      if (has(p.recipient) && has(p.address)) warn('amplopDigital', 'physicalGifts.address', 'public_address', 'warnPhysicalAddress')
    }
  }

  // Holy Recite 2, Closing
  if (offers('holyRecite2')) holyRecite('holyRecite2', draft.holyRecite2)
  if (!has(draft.closing?.message)) error('closing', 'message', 'required', 'checkClosing')

  // Images: alt text and leftover sample photos (one warning each kind)
  const images: [PublishSection, string, ImageAsset | undefined][] = [
    ['opening', 'coverImage', o.coverImage],
    ['couple', 'groom.image', draft.couple?.groom?.image],
    ['couple', 'bride.image', draft.couple?.bride?.image],
    ...(draft.story?.timeline ?? []).map((s): [PublishSection, string, ImageAsset | undefined] => ['story', `${s.id}.image`, s.image]),
    ...(draft.gallery?.images ?? []).map((img): [PublishSection, string, ImageAsset | undefined] => ['gallery', `${img.id}.alt`, img]),
    ['closing', 'image', draft.closing?.image],
  ]
  const missingAlt = images.find(([, , img]) => img && has(img.src) && !has(img.alt))
  if (missingAlt) warn(missingAlt[0], missingAlt[1], 'missing_alt', 'checkImageAlt')
  const sample = images.find(([, , img]) => img?.src?.startsWith(SAMPLE_IMAGE_PREFIX))
  if (sample) warn(sample[0], sample[1], 'sample_image', 'warnSampleImage')

  return issues

  function holyRecite(section: 'holyRecite1' | 'holyRecite2', s: HolyReciteSection | undefined) {
    if (!s?.enabled) return
    if (!has(s.passage) && !has(s.originalScript) && !has(s.translation)) error(section, 'passage', 'incomplete', 'checkHolyRecite')
    else if (!has(s.reference) && !has(s.book) && !has(s.attribution)) warn(section, 'reference', 'missing_reference', 'warnScriptureReference')
  }
}

export const blockingIssues = (issues: readonly PublishIssue[]) => issues.filter((i) => i.severity === 'error')
export const warningIssues = (issues: readonly PublishIssue[]) => issues.filter((i) => i.severity === 'warning')

/** Server 422 `publish_blocked` detail. */
export interface ServerPublishDetail {
  section?: string
  field?: string
  code?: string
  message?: string
}

const KNOWN_SECTIONS = new Set<string>(Object.keys(SECTION_ROUTE))

export interface ServerIssueContext {
  /** Editor UI language: server messages are English, so they are re-worded here. */
  locale?: WeddingLocale
  variant?: VariantId | null
  /** The saved draft, to name sessions ("Main Session: add the venue"). */
  draft?: WeddingDraft | null
  /** Localized section names, for issues this client has no specific wording for. */
  sectionName?: (section: PublishSection) => string
}

/**
 * Localized wording for a server publish issue, keyed by its stable `section` / `field` /
 * `code` (never by the English message). Unknown combinations get a generic localized line.
 */
export function localizeServerIssue(detail: ServerPublishDetail, ctx: ServerIssueContext = {}): string {
  const locale = ctx.locale ?? 'en'
  const t = (key: PublishMessageKey, vars?: Record<string, string | number>) => message(locale, key, vars)
  const section = detail.section ?? ''
  const field = detail.field ?? ''
  const code = detail.code ?? ''
  const wedding = !ctx.variant || isWeddingVariant(ctx.variant)
  const eventMatch = /^events\.(\d+)\.(.+)$/.exec(field)
  if (eventMatch) {
    const i = Number(eventMatch[1])
    const name = ctx.draft?.events?.[i]?.title?.trim() || t('eventNumber', { n: i + 1 })
    const key = eventMatch[2]!
    if (key in EVENT_FIELD_LABEL) return t('checkEventField', { event: name, field: t(EVENT_FIELD_LABEL[key as keyof typeof EVENT_FIELD_LABEL]) })
    if (key === 'onlineUrl') return t('checkEventOnline', { event: name })
    if (key === 'livestream.url') return t('checkLivestream', { event: name })
  }
  const table: Record<string, PublishMessageKey> = {
    'theme:required': 'checkTheme',
    'theme:invalid': 'checkThemeInvalid',
    'theme:incompatible': 'checkThemeIncompatible',
    'opening:required': wedding ? 'checkWeddingDate' : 'checkEventDate',
    'profiles:incomplete': 'checkProfiles',
    'organization:required': 'checkOrganization',
    'milestone:incomplete': 'checkMilestone',
    'events:required': 'checkEvent',
    'closing:required': 'checkClosing',
    'agenda:incomplete': 'checkAgenda',
    'speakers:incomplete': 'checkSpeakers',
    'story:incomplete': 'warnStoryEmpty',
    'gallery:incomplete': 'warnGalleryEmpty',
    'holyRecite1:incomplete': 'checkHolyRecite',
    'holyRecite2:incomplete': 'checkHolyRecite',
    'greeting:incomplete': 'checkGreeting',
  }
  if (section === 'couple') return t(field.includes('bride') ? 'checkBrideName' : 'checkGroomName')
  if (section === 'amplopDigital') {
    if (field.endsWith('bankAccounts')) return t('checkBankAccounts')
    if (field.endsWith('qrisImage')) return t('checkQrisUpload')
    if (field.includes('physicalGifts')) return t('checkPhysical')
    return t('checkAmplopMethod')
  }
  const key = table[`${section}:${code}`]
  if (key) return t(key)
  const name = ctx.sectionName?.(section as PublishSection) ?? section
  return t('checkServerGeneric', { section: name })
}

/** Map one server detail to an issue (unknown sections link to the editor home). */
export function issueFromServer(detail: ServerPublishDetail, ctx: ServerIssueContext = {}): PublishIssue {
  const section = (detail.section && KNOWN_SECTIONS.has(detail.section) ? detail.section : 'opening') as PublishSection
  // Server fields are full paths ("opening.weddingDate", "events.0.title"); issues use section-relative
  // paths, except the couple names, which keep their "couple." prefix (that's the Opening page field id).
  let field = typeof detail.field === 'string' ? detail.field : ''
  if (section !== 'couple') {
    if (field === section) field = ''
    else if (field.startsWith(`${section}.`)) field = field.slice(section.length + 1)
  }
  return {
    severity: 'error',
    section,
    field,
    code: detail.code ?? 'invalid',
    message: localizeServerIssue(detail, ctx),
    to: issueLocation(section, field),
  }
}

/** What will be public on the invitation: bank rows, QRIS, delivery details. */
export interface PublicDisclosure {
  bankAccounts: number
  qris: boolean
  physical: ('recipient' | 'address' | 'phone' | 'note')[]
}

export function publicDisclosure(draft: WeddingDraft): PublicDisclosure {
  const a = draft.amplopDigital
  if (!a?.enabled) return { bankAccounts: 0, qris: false, physical: [] }
  const p = a.physicalGifts
  const showsPhysical = !!p?.enabled && (has(p.recipient) || has(p.address))
  return {
    bankAccounts: a.bankAccountsEnabled ? (a.bankAccounts ?? []).filter(isCompleteBankAccount).length : 0,
    qris: !!a.qrisEnabled && isUploadedImageSrc(a.qrisImage?.src),
    physical: showsPhysical ? (['recipient', 'address', 'phone', 'note'] as const).filter((k) => has(p![k])) : [],
  }
}
