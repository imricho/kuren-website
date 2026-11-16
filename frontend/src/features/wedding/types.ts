/**
 * The shared wedding content model.
 *
 * This is the ONE content structure every theme consumes. Themes decide how
 * content looks; they never add their own fields. Future CMS forms, the
 * publishing pipeline and the backend schema should all derive from this.
 *
 * Conventions:
 *   - Dates are ISO calendar dates `YYYY-MM-DD`; times are 24h `HH:mm`.
 *     Both are venue-local (an invitation shows the time at the venue), so no
 *     timezone is stored.
 *   - Optional fields may be absent; every theme must render without them.
 */

export const WEDDING_SCHEMA_VERSION = 1 as const
export const WEDDING_CONTENT_VERSION = '1.1' as const
/** Fixed rendering order shared by themes, previews, and future editor controls. */
export const WEDDING_SECTION_ORDER = [
  'opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate', 'events',
  'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
] as const
export type WeddingSectionId = (typeof WEDDING_SECTION_ORDER)[number]
export const MANDATORY_WEDDING_SECTIONS: readonly WeddingSectionId[] = ['opening', 'couple', 'weddingDate', 'events', 'closing']

/** ISO calendar date, e.g. "2027-06-12". */
export type ISODate = string
/** 24-hour time, e.g. "08:30". */
export type TimeOfDay = string

export type WeddingLocale = 'en' | 'id'

export interface ImageAsset {
  src: string
  /** Required for accessibility; describe the image for screen readers. */
  alt: string
  /**
   * Point of interest in percent (0–100). Themes crop the same image to
   * different aspect ratios; this keeps faces in frame.
   */
  focalPoint?: { x: number; y: number }
}

export interface PersonProfile {
  name: string
  /** Short name used in greetings and derived couple names, e.g. "Alex". */
  nickname?: string
  image?: ImageAsset
  description?: string
  /** Parents line shown under the name, e.g. "Putra dari Bapak Hadi & Ibu Sri". */
  parents?: string
  /** https URL on instagram.com. Themes may ignore it. */
  instagramUrl?: string
}

// --- Sections -----------------------------------------------------------------

export interface OpeningSection {
  weddingTitle: string
  /** Display form, e.g. "Alex & Sarah". */
  coupleNames: string
  headline?: string
  introduction?: string
  coverImage?: ImageAsset
  weddingDate: ISODate
  /** "Kepada Yth." line; the public page adds the guest name from `?to=`. */
  guestGreeting?: GuestGreeting
}

export interface GuestGreeting {
  enabled: boolean
  label?: string
}

export interface CoupleSection {
  groom: PersonProfile
  bride: PersonProfile
}

export interface StoryEntry {
  id: string
  title: string
  /** Free-form display label, e.g. "March 2018" or "Spring 2022". */
  date?: string
  description: string
  image?: ImageAsset
}

export interface StorySection {
  enabled?: boolean
  title: string
  introduction?: string
  timeline: StoryEntry[]
}

export const EVENT_TYPES = [
  'engagement',
  'akad',
  'holy_matrimony',
  'ceremony',
  'reception',
  'other',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export interface WeddingEvent {
  id: string
  title: string
  type: EventType
  date: ISODate
  startTime: TimeOfDay
  endTime?: TimeOfDay
  venueName: string
  address: string
  mapsUrl?: string
  description?: string
  /** Optional extras, each with its own toggle (data kept when off). */
  dressCode?: { enabled: boolean; text?: string }
  livestream?: { enabled: boolean; url?: string; label?: string }
}

export interface GalleryImage extends ImageAsset {
  id: string
  caption?: string
}

export interface GallerySection {
  enabled?: boolean
  title: string
  description?: string
  images: GalleryImage[]
}

export interface RsvpSection {
  title: string
  introduction?: string
  enabled: boolean
  deadline?: ISODate
  /** Shown to a guest after they reply (when online RSVP exists). */
  confirmationMessage?: string
  /** Whole number 1–20. */
  maxGuestsPerResponse?: number
}

export interface ClosingSection {
  message: string
  thankYou?: string
  image?: ImageAsset
  /** "Turut mengundang" names; line breaks preserved. */
  familyAcknowledgments?: string
}

/** Sacred text exactly as entered by the couple — never rewritten, invented or auto-filled. */
export interface HolyReciteSection {
  enabled: boolean
  /** Optional heading. */
  title?: string
  /** Scripture/tradition name (free text; no religion selection is required). */
  tradition?: string
  book?: string
  /** Chapter/surah/verse reference. */
  reference?: string
  passage?: string
  /** Original-language passage (any script, incl. RTL). */
  originalScript?: string
  /** Language code of the original passage (e.g. "ar"), for screen readers and fonts. */
  originalLanguage?: string
  translation?: string
  translationLanguage?: string
  attribution?: string
}
export interface GreetingSection { enabled: boolean; title?: string; message?: string; prayer?: string }
/** Wedding Date & Countdown options (the date itself is `opening.weddingDate`). */
export interface CountdownSection { enabled: boolean; addToCalendar?: boolean }
export interface BankAccount { id?: string; bankName: string; accountHolder: string; accountNumber: string }
export interface PhysicalGifts { enabled: boolean; recipient?: string; address?: string; note?: string; phone?: string }
export interface WishesSection { enabled: boolean; title?: string; introduction?: string }
export interface AmplopDigitalSection {
  enabled: boolean
  title?: string
  message?: string
  bankAccountsEnabled: boolean
  bankAccounts: BankAccount[]
  qrisEnabled: boolean
  qrisImage?: ImageAsset
  physicalGifts?: PhysicalGifts
}

// --- Root ---------------------------------------------------------------------

export interface WeddingContent {
  contentVersion?: '1.1' | '1.2'
  holyRecite1?: HolyReciteSection
  holyRecite2?: HolyReciteSection
  greeting?: GreetingSection
  countdown?: CountdownSection
  wishes?: WishesSection
  amplopDigital?: AmplopDigitalSection
  schemaVersion: typeof WEDDING_SCHEMA_VERSION
  /** Language for dates and built-in labels. Defaults to English. */
  locale?: WeddingLocale
  opening: OpeningSection
  couple: CoupleSection
  story?: StorySection
  /** One or more events, in display order. */
  events: WeddingEvent[]
  gallery?: GallerySection
  rsvp: RsvpSection
  closing: ClosingSection
}
