import { describe, expect, it } from 'vitest'

import { toPreviewContent } from '@/features/wedding/draft'
import { publishableDraft } from '@/test/publishFixture'

import { googleCalendarUrl, icsContent, icsFileName, weddingCalendarEntry } from './calendar'
import { GUEST_NAME_MAX, sanitizeGuestName } from './composables/useRenderMode'

const content = () => toPreviewContent(publishableDraft(), 'en', new Date(2026, 10, 16), { mode: 'public' }).content

describe('add to calendar', () => {
  it('uses the first wedding-day event with the couple names', () => {
    const entry = weddingCalendarEntry(content())
    expect(entry).toMatchObject({ title: 'Wedding of Alex & Sarah', date: '2027-06-12', startTime: '09:00', endTime: '10:30', location: 'Garden Hall, Jl. Melati 1, Jakarta', details: 'Ceremony' })
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
