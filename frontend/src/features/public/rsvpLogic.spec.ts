/** Pure RSVP form logic (rsvpFormLogic.ts): config, validation, request body, error mapping, deadline. */
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/http'
import type { RsvpSection, WeddingEvent } from '@/features/wedding/types'

import { formConfig, initialValues, isPastDeadline, outcomeOf, todayIn, toSubmission, validate } from './rsvpFormLogic'

const events: WeddingEvent[] = [
  { id: 'e1', type: 'session', title: 'Main', date: '2027-06-12', startTime: '09:00', venueName: 'Hall', address: 'Jl. 1' },
  { id: 'e2', type: 'workshop', title: 'Lab', date: '2027-06-12', startTime: '13:00', venueName: 'Room', address: 'Jl. 1', optional: true },
]
const rsvp = (extra: Partial<RsvpSection> = {}): RsvpSection => ({ enabled: true, title: 'RSVP', ...extra })

describe('rsvp form config', () => {
  it('defaults: party limit 20, no contact, no sessions, no fields', () => {
    expect(formConfig(rsvp(), events)).toEqual({ partyLimit: 20, collectContact: 'none', optionalSessions: [], fields: [] })
  })
  it('offers only optional sessions, and only with allowSessionChoice', () => {
    expect(formConfig(rsvp({ allowSessionChoice: true }), events).optionalSessions.map((e) => e.id)).toEqual(['e2'])
    expect(formConfig(rsvp(), events).optionalSessions).toEqual([])
  })
})

describe('validate (mirrors the server)', () => {
  const cfg = formConfig(
    rsvp({
      maxGuestsPerResponse: 3,
      collectContact: 'email_or_phone',
      registrationFields: [
        { id: 'company', label: 'Company', type: 'text', required: true },
        { id: 'size', label: 'Size', type: 'select', required: false, options: ['S', 'M'] },
        { id: 'ok', label: 'OK', type: 'checkbox', required: true },
        { id: 'mail', label: 'Work email', type: 'email', required: false },
      ],
    }),
    events,
  )
  it('reports every missing required value', () => {
    const errors = validate(initialValues(cfg), cfg)
    expect(Object.keys(errors).sort()).toEqual(['answers.company', 'answers.ok', 'attendance', 'email', 'name'].sort())
    expect(errors.email).toEqual({ code: 'contact' })
  })
  it('checks lengths, formats, party size and select options', () => {
    const v = {
      ...initialValues(cfg), name: 'x'.repeat(121), attendance: 'attending' as const, partySize: 4, email: 'nope', phone: '12ab',
      answers: { company: 'Acme', size: 'XL', ok: true, mail: 'bad' }, message: 'm'.repeat(1001),
    }
    expect(validate(v, cfg)).toMatchObject({
      name: { code: 'tooLong', max: 120 }, partySize: { code: 'partySize', max: 3 }, email: { code: 'email' }, phone: { code: 'phone' },
      'answers.size': { code: 'choose' }, 'answers.mail': { code: 'email' }, message: { code: 'tooLong', max: 1000 },
    })
  })
  it('a declining guest needs no party size', () => {
    const v = { ...initialValues(cfg), name: 'Budi', attendance: 'not_attending' as const, partySize: 99, phone: '+62 812-3456', answers: { company: 'Acme', size: '', ok: true, mail: '' } }
    expect(validate(v, cfg)).toEqual({})
  })
})

describe('toSubmission', () => {
  const cfg = formConfig(rsvp({ collectContact: 'email', allowSessionChoice: true, registrationFields: [{ id: 'ok', label: 'OK', type: 'checkbox', required: false }] }), events)
  it('sends only what the form asks for, with an empty honeypot', () => {
    const v = { ...initialValues(cfg), name: ' Budi ', attendance: 'attending' as const, partySize: 2, email: 'b@x.co', phone: '0812', sessionIds: ['e2', 'e1', 'e2'], answers: { ok: false }, message: '  ', website: 'spam' }
    expect(toSubmission(v, cfg, 'Pak Budi')).toEqual({ name: 'Budi', attendance: 'attending', partySize: 2, email: 'b@x.co', sessionIds: ['e2'], guestLabel: 'Pak Budi', website: '' })
  })
  it('not attending → partySize 0 and no sessions', () => {
    const v = { ...initialValues(cfg), name: 'Budi', attendance: 'not_attending' as const, partySize: 3, email: 'b@x.co', sessionIds: ['e2'], answers: { ok: true } }
    expect(toSubmission(v, cfg)).toEqual({ name: 'Budi', attendance: 'not_attending', partySize: 0, email: 'b@x.co', answers: { ok: true }, website: '' })
  })
})

describe('outcomeOf', () => {
  const cfg = formConfig(rsvp({ registrationFields: [{ id: 'company', label: 'Company', type: 'text', required: true }] }), events)
  it.each([
    [new ApiError(422, 'rsvp_closed', 'closed'), 'closed'],
    [new ApiError(409, 'capacity_reached', 'full'), 'capacity'],
    [new ApiError(409, 'limit_reached', 'limit'), 'limit'],
    [new ApiError(429, 'too_many_requests', 'slow down'), 'rateLimited'],
    [new ApiError(0, 'network_error', 'offline'), 'network'],
    [new ApiError(500, 'http_error', 'boom'), 'failed'],
    [new Error('x'), 'failed'],
  ])('%s → %s', (err, kind) => {
    expect(outcomeOf(err, cfg).kind).toBe(kind)
  })
  it('maps 422 field errors to form fields (answers.<id>, sessionIds.<i>)', () => {
    const err = new ApiError(422, 'validation_error', 'bad', [
      { field: 'partySize', message: 'must be at most 2' },
      { field: 'answers.company', message: 'Field required' },
      { field: 'sessionIds.0', message: 'not optional' },
      { field: 'somethingElse', message: 'Odd' },
    ])
    const out = outcomeOf(err, cfg)
    expect(out.kind).toBe('fields')
    if (out.kind !== 'fields') return
    expect(Object.keys(out.errors)).toEqual(['partySize', 'answers.company', 'sessionIds'])
    expect(out.unmapped).toEqual(['Odd'])
  })
})

describe('deadline in the invitation time zone', () => {
  it('uses the zone and keeps the deadline day open', () => {
    // 2027-05-01 18:00 UTC is already 2 May in Jakarta (UTC+7).
    const now = new Date(Date.UTC(2027, 4, 1, 18))
    expect(todayIn('Asia/Jakarta', now)).toBe('2027-05-02')
    expect(todayIn('America/New_York', now)).toBe('2027-05-01')
    expect(isPastDeadline('2027-05-01', 'Asia/Jakarta', now)).toBe(true)
    expect(isPastDeadline('2027-05-01', 'America/New_York', now)).toBe(false)
    expect(isPastDeadline(undefined, 'Asia/Jakarta', now)).toBe(false)
    expect(todayIn('Not/AZone', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
