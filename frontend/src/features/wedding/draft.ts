/**
 * The editable (draft) form of a wedding, exactly as the CMS API returns it
 * (docs/api/weddings.md). Unlike `WeddingContent`, almost everything is optional:
 * couples save as they go, and required-for-publishing values may be missing.
 *
 * `toPreviewContent` turns a draft into content every theme can render, filling
 * gaps with clearly labelled placeholders and reporting what it filled.
 */
import { eventTypeLabel, isSafeImageSrc } from './format'
import {
  WEDDING_SCHEMA_VERSION,
  type EventType,
  type ImageAsset,
  type WeddingContent,
  type WeddingEvent,
  type WeddingLocale,
} from './types'
import { isGuestCount, isInstagramUrl } from './validation'

export interface FocalPoint {
  x: number
  y: number
}

export interface PersonDraft {
  name?: string
  nickname?: string
  image?: ImageAsset
  description?: string
  parents?: string
  instagramUrl?: string
}

export interface OpeningDraft {
  weddingTitle?: string
  coupleNames?: string
  headline?: string
  introduction?: string
  coverImage?: ImageAsset
  weddingDate?: string
}

export interface CoupleDraft {
  groom: PersonDraft
  bride: PersonDraft
}

export interface StoryEntryDraft {
  id: string
  title?: string
  date?: string
  description?: string
  image?: ImageAsset
}

export interface StoryMetaDraft {
  title?: string
  introduction?: string
  /** "Show on website" — false hides the section but keeps its content. Default true. */
  enabled?: boolean
}

export interface StoryDraft extends StoryMetaDraft {
  timeline: StoryEntryDraft[]
}

export interface EventDraft {
  id: string
  type: EventType
  title?: string
  date?: string
  startTime?: string
  endTime?: string
  venueName?: string
  address?: string
  mapsUrl?: string
  description?: string
}

export interface GalleryItemDraft {
  id: string
  src: string
  alt: string
  caption?: string
  focalPoint?: FocalPoint
}

export interface GalleryMetaDraft {
  title?: string
  description?: string
  /** "Show on website" — false hides the section but keeps its content. Default true. */
  enabled?: boolean
}

export interface GalleryDraft extends GalleryMetaDraft {
  images: GalleryItemDraft[]
}

export interface RsvpDraft {
  title?: string
  introduction?: string
  enabled: boolean
  deadline?: string
  confirmationMessage?: string
  maxGuestsPerResponse?: number
}

export interface ClosingDraft {
  message?: string
  thankYou?: string
  image?: ImageAsset
}

export interface WeddingDraft {
  schemaVersion: typeof WEDDING_SCHEMA_VERSION
  locale: WeddingLocale
  opening: OpeningDraft
  couple: CoupleDraft
  story: StoryDraft
  events: EventDraft[]
  gallery: GalleryDraft
  rsvp: RsvpDraft
  closing: ClosingDraft
}

/** Section objects accepted by PUT /weddings/{id}/sections/{section}. */
export interface SectionPayloads {
  opening: OpeningDraft
  couple: CoupleDraft
  story: StoryMetaDraft
  gallery: GalleryMetaDraft
  rsvp: RsvpDraft
  closing: ClosingDraft
}
export type SectionName = keyof SectionPayloads

/** Collection items, keyed by API collection name. */
export interface CollectionItems {
  stories: StoryEntryDraft
  events: EventDraft
  gallery: GalleryItemDraft
}
export type CollectionName = keyof CollectionItems
export type NewItem<C extends CollectionName> = Omit<CollectionItems[C], 'id'>

export function emptyDraft(locale: WeddingLocale = 'en'): WeddingDraft {
  return {
    schemaVersion: WEDDING_SCHEMA_VERSION,
    locale,
    opening: {},
    couple: { groom: {}, bride: {} },
    story: { timeline: [] },
    events: [],
    gallery: { images: [] },
    rsvp: { enabled: true },
    closing: {},
  }
}

/**
 * Fill in collections and defaults the API may omit, so the rest of the app can
 * rely on the shape (e.g. `couple.groom` always exists).
 */
export function normalizeDraft(raw: Partial<WeddingDraft> | null | undefined): WeddingDraft {
  const base = emptyDraft(raw?.locale === 'id' ? 'id' : 'en')
  if (!raw) return base
  return {
    ...base,
    opening: { ...raw.opening },
    couple: { groom: { ...raw.couple?.groom }, bride: { ...raw.couple?.bride } },
    story: { ...raw.story, timeline: [...(raw.story?.timeline ?? [])] },
    events: [...(raw.events ?? [])],
    gallery: { ...raw.gallery, images: [...(raw.gallery?.images ?? [])] },
    rsvp: { ...raw.rsvp, enabled: raw.rsvp?.enabled ?? true },
    closing: { ...raw.closing },
  }
}

// --- Preview -----------------------------------------------------------------

/** A required value that was missing and replaced by a placeholder in the preview. */
export interface MissingItem {
  section: 'opening' | 'couple' | 'story' | 'events' | 'gallery' | 'rsvp' | 'closing'
  /** Dotted path within the section, e.g. "weddingDate", "groom.name", "0.venueName". */
  field: string
}

type PlaceholderKey =
  | 'weddingTitle'
  | 'yourNames'
  | 'groomName'
  | 'brideName'
  | 'eventDetails'
  | 'venue'
  | 'address'
  | 'rsvpTitle'
  | 'closingMessage'

const PLACEHOLDERS: Record<WeddingLocale, Record<PlaceholderKey, string>> = {
  en: {
    weddingTitle: 'Your wedding title',
    yourNames: 'Your names',
    groomName: 'Groom’s name',
    brideName: 'Bride’s name',
    eventDetails: 'Event details coming soon',
    venue: 'Venue to be announced',
    address: 'Address coming soon',
    rsvpTitle: 'RSVP',
    closingMessage: 'Your closing message will appear here.',
  },
  id: {
    weddingTitle: 'Judul pernikahan Anda',
    yourNames: 'Nama Anda berdua',
    groomName: 'Nama mempelai pria',
    brideName: 'Nama mempelai wanita',
    eventDetails: 'Detail acara segera hadir',
    venue: 'Lokasi akan diumumkan',
    address: 'Alamat segera hadir',
    rsvpTitle: 'Konfirmasi Kehadiran',
    closingMessage: 'Pesan penutup Anda akan tampil di sini.',
  },
}

export function placeholderText(key: PlaceholderKey, locale: WeddingLocale): string {
  return PLACEHOLDERS[locale][key]
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const text = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
export const isIsoDate = (value: string | undefined): value is string => !!value && ISO_DATE.test(value)
export const isTime = (value: string | undefined): value is string => !!value && TIME.test(value)

function firstWord(value: string | undefined): string | undefined {
  return text(value)?.split(/\s+/)[0]
}

/** "Alex & Sarah" from nicknames or first names; undefined unless both are known. */
export function deriveCoupleNames(couple: CoupleDraft, joiner = '&'): string | undefined {
  const groom = text(couple.groom.nickname) ?? firstWord(couple.groom.name)
  const bride = text(couple.bride.nickname) ?? firstWord(couple.bride.name)
  return groom && bride ? `${groom} ${joiner} ${bride}` : undefined
}

function safeImage(image: ImageAsset | undefined): ImageAsset | undefined {
  if (!image || !isSafeImageSrc(image.src) || !text(image.alt)) return undefined
  return image.focalPoint ? { src: image.src, alt: image.alt, focalPoint: image.focalPoint } : { src: image.src, alt: image.alt }
}

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A stand-in wedding date ~6 months from `today`, used only when no date is set. */
export function standInDate(today: Date = new Date()): string {
  const d = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())
  return toLocalIso(d)
}

/** Drop undefined keys so themes never see `key: undefined`. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

/**
 * Turn a (possibly incomplete) draft into content that ALWAYS passes
 * `validateWeddingContent`, plus a list of the required values that were filled
 * with placeholders. Placeholder text is in `uiLocale` (the editor's language)
 * so couples can recognise it; dates, built-in theme labels and default section
 * titles ("Our Story", "Gallery") use the draft's (website) locale.
 */
export function toPreviewContent(
  draft: WeddingDraft,
  uiLocale: WeddingLocale = 'en',
  today: Date = new Date(),
): { content: WeddingContent; missing: MissingItem[] } {
  const missing: MissingItem[] = []
  const ph = (key: PlaceholderKey) => placeholderText(key, uiLocale)
  const locale: WeddingLocale = draft.locale === 'id' ? 'id' : 'en'
  const o = draft.opening ?? {}
  const couple: CoupleDraft = { groom: draft.couple?.groom ?? {}, bride: draft.couple?.bride ?? {} }

  // Couple
  const person = (p: PersonDraft, role: 'groom' | 'bride') => {
    let name = text(p.name)
    if (!name) {
      missing.push({ section: 'couple', field: `${role}.name` })
      name = ph(role === 'groom' ? 'groomName' : 'brideName')
    }
    return compact({
      name,
      nickname: text(p.nickname),
      image: safeImage(p.image),
      description: text(p.description),
      parents: text(p.parents),
      instagramUrl: p.instagramUrl && isInstagramUrl(p.instagramUrl) ? p.instagramUrl : undefined,
    })
  }
  const groom = person(couple.groom, 'groom')
  const bride = person(couple.bride, 'bride')

  // Opening
  let weddingTitle = text(o.weddingTitle)
  if (!weddingTitle) {
    missing.push({ section: 'opening', field: 'weddingTitle' })
    weddingTitle = ph('weddingTitle')
  }
  let coupleNames = text(o.coupleNames) ?? deriveCoupleNames(couple)
  if (!coupleNames) coupleNames = ph('yourNames') // the missing names are already reported under couple
  const firstEventDate = (draft.events ?? []).map((e) => e.date).find(isIsoDate)
  let weddingDate = isIsoDate(o.weddingDate) ? o.weddingDate : undefined
  if (!weddingDate) {
    missing.push({ section: 'opening', field: 'weddingDate' })
    weddingDate = firstEventDate ?? standInDate(today)
  }

  // Events (at least one)
  const events: WeddingEvent[] = (draft.events ?? []).map((e, i) => {
    const need = <T>(value: T | undefined, field: string, fallback: T): T => {
      if (value === undefined) {
        missing.push({ section: 'events', field: `${i}.${field}` })
        return fallback
      }
      return value
    }
    const startTime = need(isTime(e.startTime) ? e.startTime : undefined, 'startTime', '10:00')
    const endTime = isTime(e.endTime) && e.endTime > startTime ? e.endTime : undefined
    return compact({
      id: e.id || `event-${i}`,
      type: e.type ?? 'other',
      title: need(text(e.title), 'title', eventTypeLabel(e.type ?? 'other', uiLocale)),
      date: need(isIsoDate(e.date) ? e.date : undefined, 'date', weddingDate!),
      startTime,
      endTime,
      venueName: need(text(e.venueName), 'venueName', ph('venue')),
      address: need(text(e.address), 'address', ph('address')),
      mapsUrl: text(e.mapsUrl),
      description: text(e.description),
    }) as WeddingEvent
  })
  // Unique ids (defensive; the API guarantees this).
  const seen = new Set<string>()
  events.forEach((e, i) => {
    if (seen.has(e.id)) e.id = `${e.id}-${i}`
    seen.add(e.id)
  })
  if (events.length === 0) {
    missing.push({ section: 'events', field: 'events' })
    events.push({
      id: 'placeholder-event',
      type: 'other',
      title: ph('eventDetails'),
      date: weddingDate,
      startTime: '10:00',
      venueName: ph('venue'),
      address: ph('address'),
    })
  }

  // Story: only entries with a title and description are shown.
  const timeline = (draft.story?.timeline ?? []).flatMap((entry) => {
    const title = text(entry.title)
    const description = text(entry.description)
    if (!title || !description) return []
    return [compact({ id: entry.id, title, date: text(entry.date), description, image: safeImage(entry.image) })]
  })

  const gallery = (draft.gallery?.images ?? []).flatMap((img) => {
    const image = safeImage(img)
    return image ? [compact({ ...image, id: img.id, caption: text(img.caption) })] : []
  })

  const r = draft.rsvp ?? { enabled: true }
  let rsvpTitle = text(r.title)
  if (!rsvpTitle) {
    missing.push({ section: 'rsvp', field: 'title' })
    rsvpTitle = ph('rsvpTitle')
  }

  const c = draft.closing ?? {}
  let message = text(c.message)
  if (!message) {
    missing.push({ section: 'closing', field: 'message' })
    message = ph('closingMessage')
  }

  const content: WeddingContent = {
    schemaVersion: WEDDING_SCHEMA_VERSION,
    locale,
    opening: compact({
      weddingTitle,
      coupleNames,
      headline: text(o.headline),
      introduction: text(o.introduction),
      coverImage: safeImage(o.coverImage),
      weddingDate,
    }),
    couple: { groom, bride },
    story: draft.story?.enabled === false ? undefined : compact({ title: text(draft.story?.title) ?? (locale === 'id' ? 'Kisah Kami' : 'Our Story'), introduction: text(draft.story?.introduction), timeline }),
    events,
    gallery: draft.gallery?.enabled === false ? undefined : compact({ title: text(draft.gallery?.title) ?? (locale === 'id' ? 'Galeri' : 'Gallery'), description: text(draft.gallery?.description), images: gallery }),
    rsvp: compact({
      title: rsvpTitle,
      introduction: text(r.introduction),
      enabled: r.enabled !== false,
      deadline: isIsoDate(r.deadline) ? r.deadline : undefined,
      confirmationMessage: text(r.confirmationMessage),
      maxGuestsPerResponse: isGuestCount(r.maxGuestsPerResponse) ? r.maxGuestsPerResponse : undefined,
    }),
    closing: compact({ message, thankYou: text(c.thankYou), image: safeImage(c.image) }),
  }
  return { content, missing }
}
