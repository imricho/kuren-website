/**
 * Presentation helpers shared by all themes (formatting only; no styling).
 */
import type { EventType, ISODate, RsvpSection, TimeOfDay, WeddingContent, WeddingEvent, WeddingLocale } from './types'

const INTL_LOCALE: Record<WeddingLocale, string> = { en: 'en-GB', id: 'id-ID' }

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC off-by-one). */
export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function formatDate(
  value: ISODate,
  locale: WeddingLocale = 'en',
  style: 'full' | 'long' | 'short' = 'full',
): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'full'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(parseISODate(value))
}

/** Day, month name and year as separate parts, for themes that typeset them individually. */
export function dateParts(value: ISODate, locale: WeddingLocale = 'en') {
  const date = parseISODate(value)
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(INTL_LOCALE[locale], o).format(date)
  return {
    day: String(date.getDate()),
    dayPadded: String(date.getDate()).padStart(2, '0'),
    month: fmt({ month: 'long' }),
    monthShort: fmt({ month: 'short' }),
    monthNumber: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
    weekday: fmt({ weekday: 'long' }),
  }
}

export function formatTimeRange(start: TimeOfDay, end?: TimeOfDay, locale: WeddingLocale = 'en'): string {
  const sep = locale === 'id' ? '.' : ':'
  const t = (v: TimeOfDay) => v.replace(':', sep)
  if (!end) return locale === 'id' ? `${t(start)} – selesai` : `From ${t(start)}`
  return `${t(start)} – ${t(end)}`
}

const EVENT_LABELS: Record<EventType, Record<WeddingLocale, string>> = {
  engagement: { en: 'Engagement', id: 'Lamaran' },
  akad: { en: 'Akad Nikah', id: 'Akad Nikah' },
  holy_matrimony: { en: 'Holy Matrimony', id: 'Pemberkatan' },
  ceremony: { en: 'Wedding Ceremony', id: 'Upacara Pernikahan' },
  reception: { en: 'Reception', id: 'Resepsi' },
  other: { en: 'Celebration', id: 'Acara' },
}

export function eventTypeLabel(type: EventType, locale: WeddingLocale = 'en'): string {
  return EVENT_LABELS[type]?.[locale] ?? EVENT_LABELS.other[locale]
}

/** Built-in UI labels used by themes, so a theme never hardcodes one language. */
const LABELS = {
  en: {
    weddingOf: 'The Wedding of',
    saveTheDate: 'Save the Date',
    groom: 'The Groom',
    bride: 'The Bride',
    viewMap: 'View map',
    venue: 'Venue',
    when: 'When',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    rsvpBy: 'Kindly respond by',
    rsvpClosed: 'RSVP has closed',
    rsvpDisabled: 'RSVP is not being collected online',
    yourName: 'Your name',
    attending: 'Will you attend?',
    accept: 'Joyfully accept',
    decline: 'Regretfully decline',
    rsvpSoon: 'RSVP opens soon',
    guests: 'Number of guests',
    and: '&',
  },
  id: {
    weddingOf: 'Pernikahan',
    saveTheDate: 'Simpan Tanggalnya',
    groom: 'Mempelai Pria',
    bride: 'Mempelai Wanita',
    viewMap: 'Lihat peta',
    venue: 'Lokasi',
    when: 'Waktu',
    days: 'Hari',
    hours: 'Jam',
    minutes: 'Menit',
    seconds: 'Detik',
    rsvpBy: 'Mohon konfirmasi sebelum',
    rsvpClosed: 'Konfirmasi kehadiran telah ditutup',
    rsvpDisabled: 'Konfirmasi kehadiran tidak dibuka secara online',
    yourName: 'Nama Anda',
    attending: 'Apakah Anda akan hadir?',
    accept: 'Ya, saya hadir',
    decline: 'Maaf, tidak bisa hadir',
    rsvpSoon: 'Konfirmasi segera dibuka',
    guests: 'Jumlah tamu',
    and: '&',
  },
} satisfies Record<WeddingLocale, Record<string, string>>

export type LabelKey = keyof (typeof LABELS)['en']

export function labels(locale: WeddingLocale = 'en') {
  return LABELS[locale]
}

// --- Links & safety ----------------------------------------------------------

/** Only allow http(s) URLs in links built from customer content (blocks `javascript:` etc.). */
export function isSafeHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Image sources may be http(s) URLs or same-origin absolute paths. */
export function isSafeImageSrc(value: string | undefined): value is string {
  if (!value) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  return isSafeHttpUrl(value)
}

/** Map link for an event: the provided URL if safe, otherwise a Google Maps search. */
export function mapsLink(event: Pick<WeddingEvent, 'mapsUrl' | 'venueName' | 'address'>): string {
  if (isSafeHttpUrl(event.mapsUrl)) return event.mapsUrl
  const query = encodeURIComponent(`${event.venueName}, ${event.address}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

// --- Derived values -------------------------------------------------------------

/** Start of the celebration: the earliest event on the wedding date, else that day's midnight. */
export function weddingStart(content: Pick<WeddingContent, 'opening' | 'events'>): Date {
  const day = content.opening.weddingDate
  const first = content.events
    .filter((e) => e.date === day)
    .map((e) => e.startTime)
    .sort()[0]
  const date = parseISODate(day)
  if (first) {
    const [h, m] = first.split(':').map(Number)
    date.setHours(h ?? 0, m ?? 0)
  }
  return date
}

export type RsvpState = 'open' | 'closed' | 'disabled'

export function rsvpState(rsvp: RsvpSection, today: Date = new Date()): RsvpState {
  if (!rsvp.enabled) return 'disabled'
  if (rsvp.deadline) {
    const end = parseISODate(rsvp.deadline)
    end.setHours(23, 59, 59, 999)
    if (today > end) return 'closed'
  }
  return 'open'
}

export function focalPosition(image: { focalPoint?: { x: number; y: number } } | undefined): string | undefined {
  if (!image?.focalPoint) return undefined
  const clamp = (n: number) => Math.min(100, Math.max(0, n))
  return `${clamp(image.focalPoint.x)}% ${clamp(image.focalPoint.y)}%`
}
