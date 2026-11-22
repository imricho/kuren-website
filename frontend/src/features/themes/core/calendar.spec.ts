import { describe, expect, it } from 'vitest'

import { toPreviewContent } from '@/features/wedding/draft'
import { publishableDraft } from '@/test/publishFixture'

import { googleCalendarUrl, icsContent, icsFileName, weddingCalendarEntry, zonedTimeToUtc } from './calendar'
import { GUEST_NAME_MAX, sanitizeGuestName } from './composables/useRenderMode'

const content = () => toPreviewContent(publishableDraft(), 'en', new Date(2026, 10, 16), { mode: 'public' }).content

describe('add to calendar', () => {
  it('uses the first wedding-day event with the couple names', () => {
    const entry = weddingCalendarEntry(content())
    expect(entry).toMatchObject({ title: 'Wedding of Alex & Sarah', date: '2027-06-12', startTime: '09:00', endTime: '10:30', location: 'Garden Hall, Jl. Melati 1, Jakarta', details: 'Ceremony', assumedEnd: false })
    const url = new URL(googleCalendarUrl(entry))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Wedding of Alex & Sarah')
    expect(url.searchParams.get('dates')).toBe('20270612T090000/20270612T103000')
    expect(url.searchParams.get('location')).toBe('Garden Hall, Jl. Melati 1, Jakarta')
  })

  it('falls back to an all-day entry on the wedding date (Indonesian title)', () => {
    const c = content()
    c.locale = 'id'
    c.events = c.events.map((e) => ({ ...e, date: '2027-06-13' }))
    const entry = weddingCalendarEntry(c)
    expect(entry.startTime).toBeUndefined()
    expect(entry.title).toBe('Pernikahan Alex & Sarah')
    expect(new URL(googleCalendarUrl(entry)).searchParams.get('dates')).toBe('20270612/20270613')
    const ics = icsContent(entry, new Date(Date.UTC(2026, 10, 16, 8, 0, 0)))
    expect(ics).toContain('DTSTART;VALUE=DATE:20270612\r\n')
    expect(ics).toContain('DTEND;VALUE=DATE:20270613\r\n')
  })

  it('builds a valid .ics with escaped text, floating local times and a 2h default end', () => {
    const c = content()
    c.events[0] = { ...c.events[0]!, endTime: undefined, venueName: 'Hall; A, B', address: 'Line 1\nLine 2' }
    const ics = icsContent(weddingCalendarEntry(c), new Date(Date.UTC(2026, 10, 16, 8, 0, 0)))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics).toContain('DTSTAMP:20261116T080000Z\r\n')
    expect(ics).toContain('DTSTART:20270612T090000\r\n')
    expect(ics).toContain('DTEND:20270612T110000\r\n')
    expect(ics).toContain('LOCATION:Hall\\; A\\, B\\, Line 1\\nLine 2\r\n')
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(icsFileName(c)).toBe('alex-sarah-wedding.ics')
  })
})

describe('add to calendar: time zones, missing end times, multi-day and online sessions', () => {
  const stamp = new Date(Date.UTC(2026, 10, 16, 8, 0, 0))

  it('converts the published time zone to UTC for Google and .ics (Jakarta UTC+7)', () => {
    const entry = weddingCalendarEntry(content(), undefined, 'Asia/Jakarta')
    const url = new URL(googleCalendarUrl(entry))
    expect(url.searchParams.get('dates')).toBe('20270612T020000Z/20270612T033000Z')
    expect(url.searchParams.get('ctz')).toBe('Asia/Jakarta')
    const ics = icsContent(entry, stamp)
    expect(ics).toContain('DTSTART:20270612T020000Z\r\n')
    expect(ics).toContain('DTEND:20270612T033000Z\r\n')
  })

  it('handles daylight-saving time (New York: EDT in June, EST in January)', () => {
    expect(zonedTimeToUtc('2027-06-12', '09:00', 'America/New_York').toISOString()).toBe('2027-06-12T13:00:00.000Z')
    expect(zonedTimeToUtc('2027-01-12', '09:00', 'America/New_York').toISOString()).toBe('2027-01-12T14:00:00.000Z')
    // A session crossing the spring-forward night keeps its real length.
    const c = content()
    c.opening.weddingDate = '2027-03-13'
    c.events[0] = { ...c.events[0]!, date: '2027-03-13', endDate: '2027-03-14', startTime: '20:00', endTime: '10:00' }
    const dates = new URL(googleCalendarUrl(weddingCalendarEntry(c, undefined, 'America/New_York'))).searchParams.get('dates')
    expect(dates).toBe('20270314T010000Z/20270314T140000Z')
  })

  it('never passes off an assumed end time silently', () => {
    const c = content()
    c.events[0] = { ...c.events[0]!, endTime: undefined }
    const entry = weddingCalendarEntry(c, undefined, 'Asia/Jakarta')
    expect(entry.assumedEnd).toBe(true)
    expect(entry.details).toContain('End time not specified; the calendar entry assumes 2 hours.')
    expect(new URL(googleCalendarUrl(entry)).searchParams.get('dates')).toBe('20270612T020000Z/20270612T040000Z')
    c.locale = 'id'
    expect(weddingCalendarEntry(c, undefined, 'Asia/Jakarta').details).toContain('Jam selesai belum ditentukan')
    // With an end time nothing is assumed.
    expect(weddingCalendarEntry(content(), undefined, 'Asia/Jakarta').assumedEnd).toBe(false)
  })

  it('multi-day sessions: timed when an end time is given, else all-day across the days', () => {
    const c = content()
    c.events[0] = { ...c.events[0]!, endDate: '2027-06-14', startTime: '16:00', endTime: '12:00' }
    const timed = weddingCalendarEntry(c, undefined, 'Asia/Jakarta')
    expect(timed.assumedEnd).toBe(false)
    expect(new URL(googleCalendarUrl(timed)).searchParams.get('dates')).toBe('20270612T090000Z/20270614T050000Z')
    c.events[0] = { ...c.events[0]!, endTime: undefined }
    const allDay = weddingCalendarEntry(c, undefined, 'Asia/Jakarta')
    expect(new URL(googleCalendarUrl(allDay)).searchParams.get('dates')).toBe('20270612/20270615')
    expect(icsContent(allDay, stamp)).toContain('DTEND;VALUE=DATE:20270615\r\n')
  })

  it('online sessions use the joining link as the location; hybrid keeps the venue and adds the link', () => {
    const c = content()
    c.events[0] = { ...c.events[0]!, format: 'online', venueName: '', address: '', onlineUrl: 'https://zoom.us/j/1', onlineLabel: 'Zoom' }
    const online = weddingCalendarEntry(c, 'Webinar', 'Asia/Jakarta')
    expect(online.location).toBe('https://zoom.us/j/1')
    expect(online.details).toContain('Zoom: https://zoom.us/j/1')
    c.events[0] = { ...c.events[0]!, format: 'hybrid', venueName: 'Hall', address: 'Jl. A' }
    const hybrid = weddingCalendarEntry(c, 'Webinar', 'Asia/Jakarta')
    expect(hybrid.location).toBe('Hall, Jl. A')
    expect(hybrid.details).toContain('https://zoom.us/j/1')
  })

  it('without a time zone (old data) times stay floating, as before', () => {
    expect(new URL(googleCalendarUrl(weddingCalendarEntry(content()))).searchParams.has('ctz')).toBe(false)
    expect(weddingCalendarEntry(content(), undefined, 'Not/AZone').timeZone).toBeUndefined()
  })
})

describe('sanitizeGuestName (?to=)', () => {
  it('keeps text only, strips control and bidi characters and limits the length', () => {
    expect(sanitizeGuestName('  Budi   Santoso ')).toBe('Budi Santoso')
    expect(sanitizeGuestName('Ana‮txt.exe\u0000‏')).toBe('Anatxt.exe')
    expect(sanitizeGuestName('<b>Rina</b>')).toBe('<b>Rina</b>') // rendered as text, never HTML
    expect(sanitizeGuestName(['Dewi', 'Other'])).toBe('Dewi')
    expect(sanitizeGuestName(undefined)).toBeUndefined()
    expect(sanitizeGuestName('‮\u0007 ')).toBeUndefined()
    expect(Array.from(sanitizeGuestName('é'.repeat(200))!)).toHaveLength(GUEST_NAME_MAX)
    expect(sanitizeGuestName('محمد علي')).toBe('محمد علي')
  })
})
