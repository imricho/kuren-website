/**
 * "Add to Calendar" for the main date: a Google Calendar link and an .ics file, built
 * from the first session on that date (or the date, all day).
 *
 * Times are entered as local times at the event. With the invitation's PUBLISHED time
 * zone they are converted to UTC (`…Z`), daylight-saving included, so every guest's
 * calendar shows the right moment wherever they are. Without a time zone (old data)
 * they are written as floating local times, as before.
 *
 * A session without an end time is NOT given an invented one silently: the entry lasts
 * `ASSUMED_DURATION_MINUTES`, `assumedEnd` is set so the page can say so, and the entry's
 * description says so too. A multi-day session without an end time becomes an all-day
 * entry spanning its days.
 */
import type { WeddingContent, WeddingEvent } from '@/features/wedding/types'

export const ASSUMED_DURATION_MINUTES = 120

export interface CalendarEntry {
  title: string
  /** `YYYY-MM-DD` */
  date: string
  /** Last day (inclusive) of a multi-day session. */
  endDate?: string
  /** `HH:mm` when timed; absent = all day. */
  startTime?: string
  endTime?: string
  /** IANA zone the times are in (the published one); absent = floating local times. */
  timeZone?: string
  location?: string
  details?: string
  uid: string
  /** True when no end time was given and `ASSUMED_DURATION_MINUTES` is used. */
  assumedEnd: boolean
}

const compactDate = (iso: string) => iso.replace(/-/g, '')
const compactTime = (hhmm: string) => `${hhmm.replace(':', '')}00`

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

function addMinutes(iso: string, hhmm: string, minutes: number): { date: string; time: string } {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const total = h * 60 + m + minutes
  const days = Math.floor(total / 1440)
  const rest = ((total % 1440) + 1440) % 1440
  return { date: addDays(iso, days), time: `${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}` }
}

/** Offset (minutes east of UTC) of `timeZone` at the instant `utcMs`. */
function zoneOffsetMinutes(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - utcMs) / 60000)
}

/** The UTC instant of a wall-clock time in `timeZone` (DST-aware; a skipped hour moves forward). */
export function zonedTimeToUtc(isoDate: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = isoDate.split('-').map(Number) as [number, number, number]
  const [h, mi] = hhmm.split(':').map(Number) as [number, number]
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  let utc = wall - zoneOffsetMinutes(timeZone, wall) * 60000
  utc = wall - zoneOffsetMinutes(timeZone, utc) * 60000 // second pass settles DST edges
  return new Date(utc)
}

const isZone = (tz: string | undefined): tz is string => {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const utcStampOf = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Start/end as calendar values: timed (UTC `Z` or floating) or all-day. */
function span(entry: CalendarEntry): { allDay: true; start: string; end: string } | { allDay: false; start: string; end: string } {
  const lastDay = entry.endDate && entry.endDate > entry.date ? entry.endDate : entry.date
  if (!entry.startTime || (lastDay !== entry.date && !entry.endTime)) {
    return { allDay: true, start: compactDate(entry.date), end: compactDate(addDays(lastDay, 1)) }
  }
  let end: { date: string; time: string }
  if (entry.endTime && (lastDay !== entry.date || entry.endTime > entry.startTime)) end = { date: lastDay, time: entry.endTime }
  else end = addMinutes(entry.date, entry.startTime, ASSUMED_DURATION_MINUTES)
  if (isZone(entry.timeZone)) {
    return {
      allDay: false,
      start: utcStampOf(zonedTimeToUtc(entry.date, entry.startTime, entry.timeZone)),
      end: utcStampOf(zonedTimeToUtc(end.date, end.time, entry.timeZone)),
    }
  }
  return { allDay: false, start: `${compactDate(entry.date)}T${compactTime(entry.startTime)}`, end: `${compactDate(end.date)}T${compactTime(end.time)}` }
}

type CalendarEvent = Pick<WeddingEvent, 'id' | 'title' | 'startTime' | 'endTime' | 'venueName' | 'address'> &
  Partial<Pick<WeddingEvent, 'format' | 'onlineUrl' | 'onlineLabel' | 'onlineInstructions' | 'endDate'>>

/**
 * Calendar entry for the main date. `title` overrides the wedding wording (non-wedding
 * invitations pass their event title); omitted = "Wedding of <names>" as before.
 * `timeZone` is the invitation's published zone.
 */
export function weddingCalendarEntry(
  content: Pick<WeddingContent, 'opening' | 'events' | 'locale'>,
  customTitle?: string,
  timeZone?: string,
): CalendarEntry {
  const date = content.opening.weddingDate
  const names = content.opening.coupleNames
  const isId = content.locale === 'id'
  const title = customTitle?.trim() || (isId ? `Pernikahan ${names}` : `Wedding of ${names}`)
  const event = content.events.find((e) => e.date === date) as CalendarEvent | undefined
  if (!event) return { title, date, uid: `${compactDate(date)}-wedding@temuvibe`, assumedEnd: false }
  const online = event.format === 'online' || event.format === 'hybrid'
  const venue = [event.venueName, event.address].filter(Boolean).join(', ')
  const location = event.format === 'online' ? event.onlineUrl || (isId ? 'Daring' : 'Online') : venue
  const multiDay = !!event.endDate && event.endDate > date
  const assumedEnd = !!event.startTime && !event.endTime && !multiDay
  const details = [
    event.title,
    online && event.onlineUrl ? `${event.onlineLabel || (isId ? 'Gabung daring' : 'Join online')}: ${event.onlineUrl}` : '',
    online && event.onlineInstructions ? event.onlineInstructions : '',
    assumedEnd
      ? isId
        ? `Jam selesai belum ditentukan; kalender memakai durasi ${ASSUMED_DURATION_MINUTES / 60} jam.`
        : `End time not specified; the calendar entry assumes ${ASSUMED_DURATION_MINUTES / 60} hours.`
      : '',
  ].filter(Boolean)
  return {
    title,
    date,
    endDate: multiDay ? event.endDate : undefined,
    startTime: event.startTime,
    endTime: event.endTime,
    timeZone: isZone(timeZone) ? timeZone : undefined,
    location: location || undefined,
    details: details.join('\n') || undefined,
    uid: `${compactDate(date)}-${event.id.replace(/[^A-Za-z0-9_-]/g, '')}@temuvibe`,
    assumedEnd,
  }
}

export function googleCalendarUrl(entry: CalendarEntry): string {
  const s = span(entry)
  const params = new URLSearchParams({ action: 'TEMPLATE', text: entry.title, dates: `${s.start}/${s.end}` })
  if (entry.details) params.set('details', entry.details)
  if (entry.location) params.set('location', entry.location)
  if (!s.allDay && entry.timeZone) params.set('ctz', entry.timeZone)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** RFC 5545 TEXT escaping. */
const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Fold content lines at 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    const limit = out.length === 0 ? 75 : 74 // continuation lines start with a space
    if (size + bytes > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  out.push(current)
  return out.join('\r\n ')
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function icsContent(entry: CalendarEntry, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Temuvibe//Invitation//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${entry.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    ...(() => {
      const sp = span(entry)
      return sp.allDay ? [`DTSTART;VALUE=DATE:${sp.start}`, `DTEND;VALUE=DATE:${sp.end}`] : [`DTSTART:${sp.start}`, `DTEND:${sp.end}`]
    })(),
    `SUMMARY:${escapeText(entry.title)}`,
    ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
    ...(entry.details ? [`DESCRIPTION:${escapeText(entry.details)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function icsDataUrl(entry: CalendarEntry, now?: Date): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent(entry, now))}`
}

/** Safe download file name, e.g. "alex-sarah-wedding.ics" (or "<title>.ics" for a custom title). */
export function icsFileName(content: Pick<WeddingContent, 'opening'>, customTitle?: string): string {
  const slug = (customTitle?.trim() || content.opening.coupleNames)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
  if (customTitle?.trim()) return `${slug || 'invitation'}.ics`
  return `${slug || 'wedding'}-wedding.ics`
}
