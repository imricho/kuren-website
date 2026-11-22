/**
 * The editable (draft) form of a wedding, exactly as the CMS API returns it
 * (docs/api/weddings.md). Unlike `WeddingContent`, almost everything is optional:
 * couples save as they go, and required-for-publishing values may be missing.
 *
 * `toPreviewContent` turns a draft into content every theme can render, filling
 * gaps with clearly labelled placeholders and reporting what it filled.
 */
import {
  invitationPlaceholderTexts,
  invitationSectionsPreview,
  rsvpExtensionsPreview,
  sessionOptionalPreview,
} from '../invitation/draft'
import { isSectionOffered, isSectionRequired, isWeddingVariant, sectionsFor, type NewSectionId, type SectionId, type VariantId } from '../invitation/registry'
import type {
  AgendaSection,
  MilestoneSection,
  OrganizationSection,
  ProfilesSection,
  RsvpExtensions,
  SpeakersSection,
} from '../invitation/types'

import { eventTypeLabel, isSafeImageSrc, MEDIA_IMAGE_PATH } from './format'
import {
  WEDDING_SCHEMA_VERSION,
  type EventType,
  type ImageAsset,
  type SessionFormat,
  type WeddingContent,
  type WeddingEvent,
  type WeddingLocale,
  type AmplopDigitalSection,
  type CountdownSection,
  type GreetingSection,
  type GuestGreeting,
  type HolyReciteSection,
  type WishesSection,
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
  guestGreeting?: GuestGreeting
}

export interface CoupleDraft {
  groom: PersonDraft
  bride: PersonDraft
  /** Only where the variant offers the couple as optional (anniversary); absent = shown. */
  enabled?: boolean
}

export interface StoryEntryDraft {
  id: string
  title?: string
  date?: string
  description?: string
  image?: ImageAsset
}

export interface StoryMetaDraft {
  enabled?: boolean
  title?: string
  introduction?: string
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
  dressCode?: { enabled: boolean; text?: string }
  livestream?: { enabled: boolean; url?: string; label?: string }
  /** v2.0: a session guests may pick (corporate). */
  optional?: boolean
  /** in_person when absent; online sessions need no venue, online/hybrid need access. */
  format?: SessionFormat
  onlineUrl?: string
  onlineLabel?: string
  onlineInstructions?: string
  /** Last day (inclusive) of a multi-day session. */
  endDate?: string
}

export interface GalleryItemDraft {
  id: string
  src: string
  alt: string
  caption?: string
  focalPoint?: FocalPoint
}

export interface GalleryMetaDraft {
  enabled?: boolean
  title?: string
  description?: string
}

export interface GalleryDraft extends GalleryMetaDraft {
  images: GalleryItemDraft[]
}

export interface RsvpDraft extends Omit<RsvpExtensions, 'full'> {
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
  familyAcknowledgments?: string
}

export type UniversalContent = Pick<
  WeddingContent,
  | 'contentVersion' | 'holyRecite1' | 'holyRecite2' | 'greeting' | 'countdown' | 'wishes' | 'amplopDigital'
  | 'profiles' | 'milestone' | 'organization' | 'agenda' | 'speakers'
>

export interface WeddingDraft extends UniversalContent {
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

/** Section objects accepted by PUT /invitations/{id}/sections/{section}. */
export interface SectionPayloads {
  opening: OpeningDraft
  couple: CoupleDraft
  story: StoryMetaDraft
  gallery: GalleryMetaDraft
  rsvp: RsvpDraft
  closing: ClosingDraft
  // Universal (v1.1+) sections: PUT /sections/{id} replaces the whole section.
  holyRecite1: HolyReciteSection
  holyRecite2: HolyReciteSection
  greeting: GreetingSection
  countdown: CountdownSection
  wishes: WishesSection
  amplopDigital: AmplopDigitalSection
  // v2.0 sections (contract §2); lists live inside the section object.
  profiles: ProfilesSection
  milestone: MilestoneSection
  organization: OrganizationSection
  agenda: AgendaSection
  speakers: SpeakersSection
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
    ...universalContent(raw),
    opening: { ...raw.opening },
    couple: { groom: { ...raw.couple?.groom }, bride: { ...raw.couple?.bride }, ...(typeof raw.couple?.enabled === 'boolean' ? { enabled: raw.couple.enabled } : {}) },
    story: { ...raw.story, timeline: [...(raw.story?.timeline ?? [])] },
    events: [...(raw.events ?? [])],
    gallery: { ...raw.gallery, images: [...(raw.gallery?.images ?? [])] },
    rsvp: { ...raw.rsvp, enabled: raw.rsvp?.enabled ?? true },
    closing: { ...raw.closing },
  }
}

const NEW_SECTION_KEYS = ['profiles', 'milestone', 'organization', 'agenda', 'speakers'] as const satisfies readonly NewSectionId[]
const UNIVERSAL_KEYS = ['contentVersion', 'holyRecite1', 'holyRecite2', 'greeting', 'countdown', 'wishes', 'amplopDigital', ...NEW_SECTION_KEYS] as const

/**
 * Copy the shared optional content without dropping disabled stored values.
 * Sections are copied one level deep (forms keep their own deep working copies,
 * and nothing downstream mutates content), so live preview stays cheap.
 */
export function universalContent(value: UniversalContent): UniversalContent {
  const out: UniversalContent = {}
  for (const key of UNIVERSAL_KEYS) {
    const section = value[key]
    if (section === undefined) continue
    ;(out as Record<string, unknown>)[key] = typeof section === 'object' && section !== null ? { ...section } : section
  }
  return out
}

// --- Preview -----------------------------------------------------------------

/** A required value that was missing and replaced by a placeholder in the preview. */
export interface MissingItem {
  section: 'opening' | 'couple' | 'story' | 'events' | 'gallery' | 'rsvp' | 'closing' | NewSectionId
  /** Dotted path within the section, e.g. "weddingDate", "groom.name", "0.venueName". */
  field: string
}

type PlaceholderKey =
  | 'weddingTitle'
  | 'eventTitle'
  | 'yourNames'
  | 'displayNames'
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
    eventTitle: 'Your event title',
    yourNames: 'Your names',
    displayNames: 'Name to display',
    groomName: 'Groom’s name',
    brideName: 'Bride’s name',
    eventDetails: 'Event details coming soon',
    venue: 'Venue to be announced',
    address: 'Address coming soon',
    rsvpTitle: 'Your RSVP heading',
    closingMessage: 'Your closing message will appear here.',
  },
  id: {
    weddingTitle: 'Judul pernikahan Anda',
    eventTitle: 'Judul acara Anda',
    yourNames: 'Nama Anda berdua',
    displayNames: 'Nama yang ditampilkan',
    groomName: 'Nama mempelai pria',
    brideName: 'Nama mempelai wanita',
    eventDetails: 'Detail acara segera hadir',
    venue: 'Lokasi akan diumumkan',
    address: 'Alamat segera hadir',
    rsvpTitle: 'Judul RSVP Anda',
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

/** Uploaded image path served by the API: `/media/<uuid>.(jpg|png|webp)` (docs/api/weddings.md, migration 0007). */
export function isUploadedImageSrc(value: string | undefined): value is string {
  return !!value && MEDIA_IMAGE_PATH.test(value)
}
/** Image sources themes may render (safe http(s), bundled samples, our own uploads). */
export const isDisplayableImageSrc = isSafeImageSrc

function safeImage(image: ImageAsset | undefined): ImageAsset | undefined {
  if (!image || !isDisplayableImageSrc(image.src) || !text(image.alt)) return undefined
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
 * How content is prepared for a theme:
 *  - `draft` (editor and full-screen preview): fills required gaps with labelled
 *    placeholders (in the editor's language) so the couple sees where content goes.
 *  - `public` (published invitation): NEVER inserts placeholder, sample or editor
 *    text; drops disabled or empty optional sections and disabled child features.
 */
export type PreviewMode = 'draft' | 'public'
export interface PreviewOptions {
  mode?: PreviewMode
  /**
   * The invitation's variant. Sections it does not offer are never rendered (and
   * never reported missing); `content.sections` lists the offered ones. Omitted =
   * legacy wedding behaviour (all wedding sections, v2.0 sections when enabled).
   */
  variant?: VariantId
}

/** Trim the ends of a free-text value only (inner line breaks/spaces are kept). */
const keep = text

const ACCOUNT_NUMBER = /^[0-9]+(?:[ -][0-9]+)*$/
/** Complete bank row: all three values present and a well-formed account number. */
export function isCompleteBankAccount(a: { bankName?: string; accountHolder?: string; accountNumber?: string } | undefined): boolean {
  if (!a) return false
  const number = text(a.accountNumber)
  return !!text(a.bankName) && !!text(a.accountHolder) && !!number && number.length <= 40 && ACCOUNT_NUMBER.test(number)
}

/** https URL (≤2048) for livestream links. */
export function isHttpsUrl(value: string | undefined): value is string {
  if (!value || value.length > 2048 || /[\x00-\x20\\]/.test(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function holyRecitePublic(section: HolyReciteSection | undefined): HolyReciteSection | undefined {
  if (!section?.enabled) return undefined
  const out = compact({
    enabled: true as const,
    title: keep(section.title),
    tradition: keep(section.tradition),
    book: keep(section.book),
    reference: keep(section.reference),
    passage: keep(section.passage),
    originalScript: keep(section.originalScript),
    originalLanguage: keep(section.originalLanguage),
    translation: keep(section.translation),
    translationLanguage: keep(section.translationLanguage),
    attribution: keep(section.attribution),
  })
  return out.passage || out.originalScript || out.translation ? out : undefined
}

function greetingPublic(section: GreetingSection | undefined): GreetingSection | undefined {
  // Never set → legacy fallback (opening headline/introduction), exactly as in the editor preview.
  if (!section) return undefined
  if (!section.enabled) return { enabled: false }
  const out = compact({ enabled: true, title: keep(section.title), message: keep(section.message), prayer: keep(section.prayer) })
  return out.title || out.message || out.prayer ? out : { enabled: false }
}

function wishesPublic(section: WishesSection | undefined): WishesSection | undefined {
  if (!section?.enabled) return undefined
  return compact({ enabled: true, title: keep(section.title), introduction: keep(section.introduction) })
}

function amplopPublic(section: AmplopDigitalSection | undefined): AmplopDigitalSection | undefined {
  if (!section?.enabled) return undefined
  const bankAccounts = section.bankAccountsEnabled
    ? (section.bankAccounts ?? []).filter(isCompleteBankAccount).map((a) =>
        compact({ id: a.id, bankName: text(a.bankName)!, accountHolder: text(a.accountHolder)!, accountNumber: text(a.accountNumber)! }),
      )
    : []
  const qrisImage = section.qrisEnabled ? safeImage(section.qrisImage) : undefined
  const gifts = section.physicalGifts
  const physicalGifts =
    gifts?.enabled && (text(gifts.recipient) || text(gifts.address))
      ? compact({ enabled: true, recipient: keep(gifts.recipient), address: keep(gifts.address), note: keep(gifts.note), phone: keep(gifts.phone) })
      : undefined
  if (!bankAccounts.length && !qrisImage && !physicalGifts) return undefined
  return compact({
    enabled: true,
    title: keep(section.title),
    message: keep(section.message),
    bankAccountsEnabled: bankAccounts.length > 0,
    bankAccounts,
    qrisEnabled: !!qrisImage,
    qrisImage,
    physicalGifts,
  })
}

/** Universal sections for a published invitation (absent = off, see `greeting`/`countdown`). */
function universalPublic(draft: UniversalContent): UniversalContent {
  const countdown = draft.countdown
  return compact({
    contentVersion: draft.contentVersion,
    holyRecite1: holyRecitePublic(draft.holyRecite1),
    holyRecite2: holyRecitePublic(draft.holyRecite2),
    // Never-set greeting/countdown keep the legacy v1.1 behaviour (same as the editor preview);
    // the published snapshot carries an explicit {enabled:false} marker when switched off.
    greeting: greetingPublic(draft.greeting),
    // Add to Calendar is its own option of the Wedding Date section (independent of the timer).
    countdown: countdown
      ? compact({ enabled: countdown.enabled === true, addToCalendar: countdown.addToCalendar === true ? true : undefined })
      : undefined,
    wishes: wishesPublic(draft.wishes),
    amplopDigital: amplopPublic(draft.amplopDigital),
  }) as UniversalContent
}

function eventExtras(e: EventDraft, isPublic: boolean): Pick<WeddingEvent, 'dressCode' | 'livestream'> {
  const dressText = keep(e.dressCode?.text)
  const liveUrl = isHttpsUrl(text(e.livestream?.url)) ? text(e.livestream?.url) : undefined
  if (isPublic) {
    return compact({
      dressCode: e.dressCode?.enabled && dressText ? { enabled: true, text: dressText } : undefined,
      livestream: e.livestream?.enabled && liveUrl ? compact({ enabled: true, url: liveUrl, label: keep(e.livestream.label) }) : undefined,
    })
  }
  return compact({
    dressCode: e.dressCode ? compact({ enabled: e.dressCode.enabled === true, text: dressText }) : undefined,
    livestream: e.livestream ? compact({ enabled: e.livestream.enabled === true, url: liveUrl, label: keep(e.livestream.label) }) : undefined,
  })
}

/**
 * Turn a (possibly incomplete) draft into content every theme can render, plus
 * a list of the required values that were missing.
 *
 * Draft mode (default) ALWAYS passes `validateWeddingContent`: gaps are filled
 * with placeholders in `uiLocale` (the editor's language) so couples can
 * recognise them; dates, built-in theme labels and default section titles
 * ("Our Story", "Gallery") use the draft's (website) locale.
 *
 * Public mode renders a published snapshot for guests: no placeholders, ever.
 * Incomplete events are dropped and disabled/empty optional content removed.
 */
export function toPreviewContent(
  draft: WeddingDraft,
  uiLocale: WeddingLocale = 'en',
  today: Date = new Date(),
  options: PreviewOptions = {},
): { content: WeddingContent; missing: MissingItem[] } {
  const isPublic = options.mode === 'public'
  const missing: MissingItem[] = []
  const ph = (key: PlaceholderKey) => (isPublic ? '' : placeholderText(key, uiLocale))
  const locale: WeddingLocale = draft.locale === 'id' ? 'id' : 'en'
  const o = draft.opening ?? {}
  const couple: CoupleDraft = { groom: draft.couple?.groom ?? {}, bride: draft.couple?.bride ?? {} }

  // Couple
  const variant = options.variant
  const offers = (id: SectionId) => !variant || isSectionOffered(variant, id)
  // An optional couple (anniversary) switched off is not rendered, like any hidden section.
  const hasCouple = offers('couple') && !(variant && !isSectionRequired(variant, 'couple') && draft.couple?.enabled === false)
  const person = (p: PersonDraft, role: 'groom' | 'bride') => {
    if (!hasCouple) return { name: '' }
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
  let coupleNames = text(o.coupleNames) ?? (hasCouple ? deriveCoupleNames(couple) : undefined)
  // Outside the wedding category the placeholders use event wording.
  const genericCopy = !!variant && !isWeddingVariant(variant)
  if (!coupleNames) coupleNames = isPublic ? [groom.name, bride.name].filter(Boolean).join(' & ') : ph(hasCouple ? 'yourNames' : 'displayNames') // missing names are reported under couple
  let weddingTitle = text(o.weddingTitle)
  if (!weddingTitle) {
    missing.push({ section: 'opening', field: 'weddingTitle' })
    weddingTitle = isPublic ? coupleNames : ph(genericCopy ? 'eventTitle' : 'weddingTitle')
  }
  const firstEventDate = (draft.events ?? []).map((e) => e.date).find(isIsoDate)
  let weddingDate = isIsoDate(o.weddingDate) ? o.weddingDate : undefined
  if (!weddingDate) {
    missing.push({ section: 'opening', field: 'weddingDate' })
    // Publishing requires a date; a snapshot without one still needs a renderable date.
    weddingDate = firstEventDate ?? standInDate(today)
  }

  // Events (draft: at least one, gaps filled; public: complete events only)
  const events: WeddingEvent[] = (draft.events ?? []).flatMap((e, i) => {
    const format = e.format === 'online' || e.format === 'hybrid' ? e.format : 'in_person'
    const onlineUrl = format !== 'in_person' && isHttpsUrl(text(e.onlineUrl)) ? text(e.onlineUrl) : undefined
    const onlineInstructions = format !== 'in_person' ? text(e.onlineInstructions) : undefined
    const venueOk = format === 'online' || (!!text(e.venueName) && !!text(e.address))
    const accessOk = format === 'in_person' || !!onlineUrl || !!onlineInstructions
    if (isPublic && !(isIsoDate(e.date) && isTime(e.startTime) && venueOk && accessOk)) {
      missing.push({ section: 'events', field: `${i}` })
      return []
    }
    const need = <T>(value: T | undefined, field: string, fallback: T): T => {
      if (value === undefined) {
        missing.push({ section: 'events', field: `${i}.${field}` })
        return fallback
      }
      return value
    }
    const startTime = need(isTime(e.startTime) ? e.startTime : undefined, 'startTime', '10:00')
    const multiDay = isIsoDate(e.endDate) && isIsoDate(e.date) && e.endDate > e.date
    const endTime = isTime(e.endTime) && (multiDay || e.endTime > startTime) ? e.endTime : undefined
    return [
      compact({
        id: e.id || `event-${i}`,
        type: e.type ?? 'other',
        title: need(text(e.title), 'title', eventTypeLabel(e.type ?? 'other', isPublic ? locale : uiLocale)),
        date: need(isIsoDate(e.date) ? e.date : undefined, 'date', weddingDate!),
        startTime,
        endTime,
        // An online session has no venue: empty (themes then show no venue or map).
        venueName: format === 'online' ? (text(e.venueName) ?? '') : need(text(e.venueName), 'venueName', ph('venue')),
        address: format === 'online' ? (text(e.address) ?? '') : need(text(e.address), 'address', ph('address')),
        mapsUrl: format === 'online' ? undefined : text(e.mapsUrl),
        description: text(e.description),
        endDate: isIsoDate(e.endDate) && isIsoDate(e.date) && e.endDate > e.date ? e.endDate : undefined,
        ...(format !== 'in_person' ? { format, onlineUrl, onlineLabel: text(e.onlineLabel), onlineInstructions } : {}),
        ...eventExtras(e, isPublic),
        ...sessionOptionalPreview(e.optional),
      }) as WeddingEvent,
    ]
  })
  // Unique ids (defensive; the API guarantees this).
  const seen = new Set<string>()
  events.forEach((e, i) => {
    if (seen.has(e.id)) e.id = `${e.id}-${i}`
    seen.add(e.id)
  })
  if (events.length === 0) {
    missing.push({ section: 'events', field: 'events' })
    if (!isPublic)
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
  const rsvpEnabled = r.enabled !== false
  if (!rsvpTitle) {
    missing.push({ section: 'rsvp', field: 'title' })
    // Guests get the default heading in the invitation's language (RSVP is on by
    // default for most variants, and hiding it silently would drop the form).
    rsvpTitle = isPublic ? (locale === 'id' ? 'RSVP Kehadiran' : 'RSVP') : ph('rsvpTitle')
  }

  const c = draft.closing ?? {}
  let message = text(c.message)
  if (!message) {
    missing.push({ section: 'closing', field: 'message' })
    message = ph('closingMessage')
  }

  const guestGreeting = o.guestGreeting
    ? isPublic
      ? o.guestGreeting.enabled
        ? compact({ enabled: true, label: keep(o.guestGreeting.label) })
        : undefined
      : compact({ enabled: o.guestGreeting.enabled === true, label: keep(o.guestGreeting.label) })
    : undefined

  const universal: UniversalContent = isPublic ? universalPublic(draft) : universalContent(draft)
  for (const key of NEW_SECTION_KEYS) delete universal[key]
  const v2 = invitationSectionsPreview(draft, { isPublic, uiLocale, variant, sessionIds: events.map((e) => e.id) })
  missing.push(...v2.missing)

  const content: WeddingContent = {
    ...universal,
    ...v2.sections,
    schemaVersion: WEDDING_SCHEMA_VERSION,
    locale,
    opening: compact({
      weddingTitle,
      coupleNames,
      headline: text(o.headline),
      introduction: text(o.introduction),
      coverImage: safeImage(o.coverImage),
      weddingDate,
      guestGreeting,
    }),
    couple: { groom, bride },
    story: compact({ enabled: draft.story?.enabled, title: text(draft.story?.title) ?? (locale === 'id' ? 'Kisah Kami' : 'Our Story'), introduction: text(draft.story?.introduction), timeline }),
    events,
    gallery: compact({ enabled: draft.gallery?.enabled, title: text(draft.gallery?.title) ?? (locale === 'id' ? 'Galeri' : 'Gallery'), description: text(draft.gallery?.description), images: gallery }),
    rsvp: compact({
      title: rsvpTitle,
      introduction: text(r.introduction),
      enabled: rsvpEnabled,
      deadline: isIsoDate(r.deadline) ? r.deadline : undefined,
      confirmationMessage: text(r.confirmationMessage),
      maxGuestsPerResponse: isGuestCount(r.maxGuestsPerResponse) ? r.maxGuestsPerResponse : undefined,
      ...rsvpExtensionsPreview(r as RsvpExtensions, isPublic),
    }),
    closing: compact({ message, thankYou: text(c.thankYou), image: safeImage(c.image), familyAcknowledgments: keep(c.familyAcknowledgments) }),
  }
  if (variant) restrictToVariant(content, variant, hasCouple)
  return { content, missing }
}

/** Drop what a variant does not offer and record the offered sections (`content.sections`). */
function restrictToVariant(content: WeddingContent, variant: VariantId, coupleShown: boolean) {
  const offered = sectionsFor(variant).map((s) => s.id).filter((id) => id !== 'couple' || coupleShown)
  const has = (id: SectionId) => offered.includes(id)
  for (const key of ['holyRecite1', 'holyRecite2', 'wishes', 'amplopDigital', 'story', 'gallery', 'countdown'] as const) {
    if (!has(key)) delete content[key]
  }
  // An absent greeting means the legacy opening-text fallback; mark it explicitly off instead.
  if (!has('greeting')) content.greeting = { enabled: false }
  if (!has('rsvp')) content.rsvp = { ...content.rsvp, enabled: false }
  content.sections = offered
}

/** Every placeholder string in both editor languages (tests: public content must contain none). */
export function allPlaceholderTexts(): string[] {
  return [...Object.values(PLACEHOLDERS).flatMap((dict) => Object.values(dict)), ...invitationPlaceholderTexts()]
}
