import { describe, expect, it } from 'vitest'

import {
  eventTypeLabel,
  focalPosition,
  formatDate,
  formatTimeRange,
  isSafeHttpUrl,
  isSafeImageSrc,
  mapsLink,
  parseISODate,
  rsvpState,
  weddingStart,
} from './format'
import { sampleWedding } from './sampleWedding'

describe('format helpers', () => {
  it('parses ISO dates as local calendar dates (no timezone shift)', () => {
    const d = parseISODate('2027-06-12')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 5, 12])
  })

  it('formats dates in English and Indonesian', () => {
    expect(formatDate('2027-06-12', 'en')).toMatch(/Saturday.*12 June 2027/)
    expect(formatDate('2027-06-12', 'id')).toMatch(/Sabtu.*12 Juni 2027/)
  })

  it('formats time ranges, including open-ended ones', () => {
    expect(formatTimeRange('18:30', '21:30')).toBe('18:30 – 21:30')
    expect(formatTimeRange('10:00')).toBe('From 10:00')
    expect(formatTimeRange('10:00', undefined, 'id')).toBe('10.00 – selesai')
  })

  it('labels event types per locale', () => {
    expect(eventTypeLabel('reception', 'en')).toBe('Reception')
    expect(eventTypeLabel('reception', 'id')).toBe('Resepsi')
  })

  it('only allows safe URLs from customer content', () => {
    expect(isSafeHttpUrl('https://maps.google.com/x')).toBe(true)
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('not a url')).toBe(false)
    expect(isSafeImageSrc('/sample-wedding/cover.svg')).toBe(true)
    expect(isSafeImageSrc('//evil.example/x.png')).toBe(false)
    expect(isSafeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false)
  })

  it('builds a map link, falling back to a search when the URL is missing or unsafe', () => {
    const event = { venueName: 'Hall', address: 'Jl. A 1', mapsUrl: 'javascript:alert(1)' }
    expect(mapsLink(event)).toBe('https://www.google.com/maps/search/?api=1&query=Hall%2C%20Jl.%20A%201')
    expect(mapsLink({ ...event, mapsUrl: 'https://maps.app.goo.gl/abc' })).toBe('https://maps.app.goo.gl/abc')
  })

  it('computes the wedding start from the earliest event on the wedding day', () => {
    const start = weddingStart(sampleWedding)
    expect([start.getHours(), start.getMinutes()]).toEqual([8, 0])
  })

  it('derives RSVP state from enabled flag and deadline', () => {
    const rsvp = { title: 'RSVP', enabled: true, deadline: '2027-05-25' }
    expect(rsvpState(rsvp, new Date(2027, 4, 25, 20))).toBe('open')
    expect(rsvpState(rsvp, new Date(2027, 4, 26))).toBe('closed')
    expect(rsvpState({ ...rsvp, enabled: false })).toBe('disabled')
    expect(rsvpState({ title: 'RSVP', enabled: true })).toBe('open')
  })

  it('clamps focal points into a CSS object-position', () => {
    expect(focalPosition({ focalPoint: { x: 42, y: 140 } })).toBe('42% 100%')
    expect(focalPosition({})).toBeUndefined()
  })
})
