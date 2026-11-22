import { describe, expect, it } from 'vitest'

import { validateWeddingContent } from '@/features/wedding/validation'
import { publishableDraft } from '@/test/publishFixture'
import { toPreviewContent } from '@/features/wedding/draft'

import {
  checkAgenda,
  checkInvitationTitle,
  checkMilestone,
  checkOrganization,
  checkProfiles,
  checkRsvpExtensions,
  checkSpeakers,
  INVITATION_LIMITS,
} from './validation'

const codes = (issues: { field: string; code: string }[]) => issues.map((i) => `${i.field}:${i.code}`)

describe('v2.0 client-side limits (mirror the backend)', () => {
  it('profiles: count, roles allowed by the variant, lengths, birth date', () => {
    const people = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, role: 'celebrant' as const, name: 'A' }))
    expect(codes(checkProfiles({ enabled: true, people }))).toEqual(['people:tooMany'])
    expect(codes(checkProfiles({ enabled: true, people: [{ id: 'a', role: 'graduate', name: 'x'.repeat(121), birthDate: '2027-13-01' }] }, 'birthday'))).toEqual([
      'people.0.role:invalidRole',
      'people.0.name:tooLong',
      'people.0.birthDate:invalidDate',
    ])
    expect(checkProfiles({ enabled: true, people: [{ id: 'a', role: 'graduate', name: 'Ok' }] })).toEqual([])
    expect(codes(checkProfiles({ enabled: true, people: [{ id: 'a', role: 'host', name: 'A' }, { id: 'a', role: 'host', name: 'B' }] }))).toEqual(['people.1.id:duplicateId'])
  })

  it('milestone: age 1..150, years 1..100, text limits', () => {
    expect(codes(checkMilestone({ enabled: true, age: 0, years: 101, occasion: 'x'.repeat(121), degree: 'x'.repeat(161) }))).toEqual([
      'age:outOfRange',
      'years:outOfRange',
      'occasion:tooLong',
      'degree:tooLong',
    ])
    expect(checkMilestone({ enabled: true, age: 150, years: 1, partyTheme: 'x'.repeat(200) })).toEqual([])
    expect(codes(checkMilestone({ enabled: true, age: 17.5 }))).toEqual(['age:outOfRange'])
  })

  it('organization: https website only', () => {
    expect(codes(checkOrganization({ enabled: true, websiteUrl: 'http://acme.example' }))).toEqual(['websiteUrl:httpsOnly'])
    expect(checkOrganization({ enabled: true, websiteUrl: 'https://acme.example', name: 'Acme' })).toEqual([])
  })

  it('agenda: ≤ 50 items, HH:MM times, end after start, known references', () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ id: `a${i}`, title: 'x' }))
    expect(codes(checkAgenda({ enabled: true, items: many }))).toEqual(['items:tooMany'])
    expect(
      codes(checkAgenda({ enabled: true, items: [{ id: 'a', title: 'T', time: '10:00', endTime: '09:00', sessionId: 'nope', speakerIds: ['ghost'] }] }, { sessionIds: ['e1'], speakerIds: ['s1'] })),
    ).toEqual(['items.0.endTime:endBeforeStart', 'items.0.sessionId:unknownReference', 'items.0.speakerIds:unknownReference'])
    expect(codes(checkAgenda({ enabled: true, items: [{ id: 'a', title: 'T', time: '9am' }] }))).toEqual(['items.0.time:invalidTime'])
  })

  it('speakers: ≤ 30', () => {
    const people = Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, name: 'S' }))
    expect(codes(checkSpeakers({ enabled: true, people }))).toEqual(['people:tooMany'])
  })

  it('rsvp: capacity 1..100000, ≤ 10 registration fields, select options', () => {
    expect(codes(checkRsvpExtensions({ capacity: 100001 }))).toEqual(['capacity:outOfRange'])
    expect(checkRsvpExtensions({ capacity: INVITATION_LIMITS.capacityMax, collectContact: 'email_or_phone' })).toEqual([])
    const fields = Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, label: 'L', type: 'text' as const, required: false }))
    expect(codes(checkRsvpExtensions({ registrationFields: fields }))).toEqual(['registrationFields:tooMany'])
    expect(
      codes(checkRsvpExtensions({
        registrationFields: [
          { id: 'a', label: '', type: 'select', required: true, options: [] },
          { id: 'b', label: 'x'.repeat(81), type: 'text', required: false, options: ['x'] },
          { id: 'c', label: 'Pick', type: 'select', required: false, options: Array.from({ length: 21 }, () => 'o') },
        ],
      })),
    ).toEqual([
      'registrationFields.0.label:required',
      'registrationFields.0.options:required',
      'registrationFields.1.label:tooLong',
      'registrationFields.1.options:invalidOption',
      'registrationFields.2.options:tooMany',
    ])
  })

  it('invitation title ≤ 120', () => {
    expect(checkInvitationTitle('x'.repeat(121))).toEqual([{ field: 'title', code: 'tooLong', max: 120 }])
    expect(checkInvitationTitle(null)).toEqual([])
  })
})

describe('content model accepts contentVersion 2.0', () => {
  it('validates 2.0 content with the new sections', () => {
    const d = publishableDraft()
    d.contentVersion = '2.0'
    d.agenda = { enabled: true, items: [{ id: 'a1', title: 'Talk', time: '10:00' }] }
    const content = toPreviewContent(d, 'en', new Date(2026, 10, 22), { variant: 'seminar' }).content
    expect(content.contentVersion).toBe('2.0')
    expect(validateWeddingContent(content)).toEqual([])
    expect(validateWeddingContent({ ...content, contentVersion: '3.0' as never })).toContain('contentVersion is not supported')
    expect(validateWeddingContent({ ...content, agenda: { enabled: true, items: [{ id: 'a', title: 'x', time: '25:00' }] } })).toContain('agenda.items[0].time must be HH:mm')
  })
})
