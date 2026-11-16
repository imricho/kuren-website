/**
 * "Add to Calendar" for the wedding day: a Google Calendar link and an .ics file,
 * built from the first event on the wedding date (or the wedding date all day).
 *
 * Times are venue-local and stored without a timezone, so they are written as
 * floating local times (no `Z`): calendars show them as entered.
 */
import type { WeddingContent, WeddingEvent } from '@/features/wedding/types'

export interface CalendarEntry {
  title: string
  /** `YYYY-MM-DD` */
  date: string
  /** `HH:mm` when timed; absent = all day. */
  startTime?: string
  endTime?: string
  location?: string
  details?: string
  uid: string
}

const compactDate = (iso: string) => iso.replace(/-/g, '')
const compactTime = (hhmm: string) => `${hhmm.replace(':', '')}00`

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** End time: the event's end, else two hours after the start (same day, capped at 23:59). */
function endOf(entry: CalendarEntry): { date: string; time: string } {
  if (entry.endTime && entry.startTime && entry.endTime > entry.startTime) return { date: entry.date, time: entry.endTime }
  const [h, m] = entry.startTime!.split(':').map(Number) as [number, number]
  const end = Math.min(h * 60 + m + 120, 23 * 60 + 59)
  return { date: entry.date, time: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` }
}

export function weddingCalendarEntry(content: Pick<WeddingContent, 'opening' | 'events' | 'locale'>): CalendarEntry {
  const date = content.opening.weddingDate
  const names = content.opening.coupleNames
  const title = content.locale === 'id' ? `Pernikahan ${names}` : `Wedding of ${names}`
  const event: WeddingEvent | undefined = content.events.find((e) => e.date === date)
  if (!event) return { title, date, uid: `${compactDate(date)}-wedding@kuren` }
  const location = [event.venueName, event.address].filter(Boolean).join(', ')
  return {
    title,
    date,
    startTime: event.startTime,
    endTime: event.endTime,
    location: location || undefined,
    details: event.title,
    uid: `${compactDate(date)}-${event.id.replace(/[^A-Za-z0-9_-]/g, '')}@kuren`,
  }
}

export function googleCalendarUrl(entry: CalendarEntry): string {
  const dates = entry.startTime
    ? `${compactDate(entry.date)}T${compactTime(entry.startTime)}/${compactDate(endOf(entry).date)}T${compactTime(endOf(entry).time)}`
    : `${compactDate(entry.date)}/${compactDate(addDays(entry.date, 1))}`
  const params = new URLSearchParams({ action: 'TEMPLATE', text: entry.title, dates })
  if (entry.details) params.set('details', entry.details)
  if (entry.location) params.set('location', entry.location)
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
    'PRODID:-//Kuren//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${entry.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    ...(entry.startTime
      ? [`DTSTART:${compactDate(entry.date)}T${compactTime(entry.startTime)}`, `DTEND:${compactDate(endOf(entry).date)}T${compactTime(endOf(entry).time)}`]
      : [`DTSTART;VALUE=DATE:${compactDate(entry.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(entry.date, 1))}`]),
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

/** Safe download file name, e.g. "alex-sarah-wedding.ics". */
export function icsFileName(content: Pick<WeddingContent, 'opening'>): string {
  const slug = content.opening.coupleNames
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
  return `${slug || 'wedding'}-wedding.ics`
}
