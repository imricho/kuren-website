/**
 * How complete each part of the wedding website is. Pure rules over the SAVED
 * draft; they return status and missing-field codes, never display text.
 *
 * Six things are required before publishing: the theme plus the five mandatory
 * sections (opening, couple, wedding date, events, closing). Every other section
 * (incl. RSVP) is optional and never counts toward the total. An optional section
 * that is switched off reads 'optional'; switched on, it is 'complete' once it
 * has what it needs to render, otherwise 'in_progress'.
 */
import { isThemeId } from '@/features/themes/core/registry'

import { deriveCoupleNames, isIsoDate, isTime, type EventDraft, type WeddingDraft } from './draft'

export type SectionStatus = 'not_started' | 'in_progress' | 'complete' | 'optional'

/** Editor order: the theme, then the canonical public section order (WEDDING_SECTION_ORDER). */
export const SECTION_KEYS = [
  'theme', 'opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate', 'events',
  'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const REQUIRED_SECTIONS = ['theme', 'opening', 'couple', 'weddingDate', 'events', 'closing'] as const satisfies readonly SectionKey[]

export interface SectionCompleteness {
  status: SectionStatus
  /** Codes of required values still missing, e.g. "weddingTitle", "groom.name", "events.0.address". */
  missing: string[]
  required: boolean
}

export interface Completeness {
  sections: Record<SectionKey, SectionCompleteness>
  done: number
  total: number
  percent: number
}

const has = (value: unknown) => (typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null)
const anySet = (obj: object | undefined, ignore: string[] = []): boolean =>
  !!obj &&
  Object.entries(obj).some(([k, v]) => !ignore.includes(k) && (typeof v === 'object' && v !== null ? anySet(v) : has(v)))

function status(missing: string[], started: boolean): SectionStatus {
  if (missing.length === 0) return 'complete'
  return started ? 'in_progress' : 'not_started'
}

export const EVENT_REQUIRED_FIELDS = ['title', 'date', 'startTime', 'venueName', 'address'] as const

export function eventMissing(event: EventDraft): string[] {
  return EVENT_REQUIRED_FIELDS.filter((f) => {
    if (f === 'date') return !isIsoDate(event.date)
    if (f === 'startTime') return !isTime(event.startTime)
    return !has(event[f])
  })
}

export function computeCompleteness(draft: WeddingDraft | null | undefined, themeId: string | null | undefined): Completeness {
  const d = draft
  const sections = {} as Record<SectionKey, SectionCompleteness>
  const req = (key: SectionKey, missing: string[], started: boolean) =>
    (sections[key] = { status: status(missing, started), missing, required: true })

  req('theme', isThemeId(themeId) ? [] : ['themeId'], false)

  const o = d?.opening ?? {}
  const couple = d?.couple ?? { groom: {}, bride: {} }
  const openingMissing: string[] = []
  if (!has(o.weddingTitle)) openingMissing.push('weddingTitle')
  if (!isIsoDate(o.weddingDate)) openingMissing.push('weddingDate')
  if (!has(o.coupleNames) && !deriveCoupleNames(couple)) openingMissing.push('coupleNames')
  req('opening', openingMissing, anySet(o) || has(couple.groom.name) || has(couple.bride.name))

  const coupleMissing: string[] = []
  if (!has(couple.groom.name)) coupleMissing.push('groom.name')
  if (!has(couple.bride.name)) coupleMissing.push('bride.name')
  req('couple', coupleMissing, anySet(couple))

  const events = d?.events ?? []
  const eventsMissing = events.length === 0 ? ['events'] : events.flatMap((e, i) => eventMissing(e).map((f) => `${i}.${f}`))
  req('events', eventsMissing, events.length > 0)

  const c = d?.closing ?? {}
  req('closing', has(c.message) ? [] : ['message'], anySet(c))

  req('weddingDate', isIsoDate(o.weddingDate) ? [] : ['weddingDate'], has(o.weddingDate))

  // Optional sections.
  const optional = (key: SectionKey, enabled: boolean, missing: string[]) =>
    (sections[key] = { status: enabled ? (missing.length ? 'in_progress' : 'complete') : 'optional', missing: enabled ? missing : [], required: false })

  const r = d?.rsvp ?? { enabled: true }
  const rsvpStarted = anySet(r, ['enabled'])
  sections.rsvp = {
    status: r.enabled === false || !rsvpStarted ? 'optional' : has(r.title) ? 'complete' : 'in_progress',
    missing: r.enabled !== false && rsvpStarted && !has(r.title) ? ['title'] : [],
    required: false,
  }

  for (const key of ['holyRecite1', 'holyRecite2'] as const) {
    const h = d?.[key]
    optional(key, h?.enabled === true, has(h?.passage) || has(h?.originalScript) || has(h?.translation) ? [] : ['passage'])
  }
  const g = d?.greeting
  optional('greeting', g?.enabled === true, has(g?.title) || has(g?.message) || has(g?.prayer) ? [] : ['message'])
  optional('wishes', d?.wishes?.enabled === true, [])

  const a = d?.amplopDigital
  const giftsMissing: string[] = []
  if (a?.enabled) {
    const physical = a.physicalGifts?.enabled === true
    if (!a.bankAccountsEnabled && !a.qrisEnabled && !physical) giftsMissing.push('methods')
    if (a.bankAccountsEnabled) {
      if (!a.bankAccounts?.length) giftsMissing.push('bankAccounts')
      a.bankAccounts?.forEach((b, i) =>
        (['bankName', 'accountHolder', 'accountNumber'] as const).forEach((f) => !has(b[f]) && giftsMissing.push(`bankAccounts.${i}.${f}`)),
      )
    }
    if (a.qrisEnabled && !has(a.qrisImage?.src)) giftsMissing.push('qrisImage')
    if (physical && !has(a.physicalGifts?.address)) giftsMissing.push('physicalGifts.address')
  }
  optional('amplopDigital', a?.enabled === true, giftsMissing)

  const timeline = d?.story?.timeline ?? []
  const storyMissing = timeline.flatMap((e, i) =>
    [!has(e.title) && `${i}.title`, !has(e.description) && `${i}.description`].filter((x): x is string => !!x),
  )
  sections.story = {
    status: storyMissing.length ? 'in_progress' : timeline.length ? 'complete' : 'optional',
    missing: storyMissing,
    required: false,
  }
  const images = d?.gallery?.images ?? []
  const galleryMissing = images.flatMap((img, i) => (has(img.src) && has(img.alt) ? [] : [`${i}.image`]))
  sections.gallery = {
    status: galleryMissing.length ? 'in_progress' : images.length ? 'complete' : 'optional',
    missing: galleryMissing,
    required: false,
  }

  const total = REQUIRED_SECTIONS.length
  const done = REQUIRED_SECTIONS.filter((k) => sections[k].status === 'complete').length
  const ordered = Object.fromEntries(SECTION_KEYS.map((k) => [k, sections[k]])) as Record<SectionKey, SectionCompleteness>
  return { sections: ordered, done, total, percent: Math.round((done / total) * 100) }
}

/** First required section that isn't complete (in editor order), else undefined. */
export function firstIncompleteSection(c: Completeness): SectionKey | undefined {
  return SECTION_KEYS.find((k) => c.sections[k].required && c.sections[k].status !== 'complete')
}
