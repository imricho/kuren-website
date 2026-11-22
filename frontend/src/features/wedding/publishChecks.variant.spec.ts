/** The publish checklist follows the variant: offered sections only, neutral wording outside weddings. */
import { describe, expect, it } from 'vitest'

import { publishableDraft } from '@/test/publishFixture'

import { issueFromServer, localizeServerIssue, publishChecks } from './publishChecks'

const today = new Date(2026, 10, 22)
const codes = (issues: { section: string; code: string; severity: string }[]) => issues.map((i) => `${i.severity}:${i.section}:${i.code}`)

describe('publishChecks per variant', () => {
  it('never asks a birthday for bride and groom names, and says "event date"', () => {
    const d = publishableDraft()
    d.couple = { groom: {}, bride: {} }
    d.opening.weddingDate = undefined
    const issues = publishChecks(d, { themeId: 'ethnic', locale: 'en', today, variant: 'birthday' })
    expect(issues.some((i) => i.section === 'couple')).toBe(false)
    expect(issues.find((i) => i.field === 'weddingDate')?.message).toBe('Add your event date.')
    // The same draft as a wedding still needs names.
    expect(publishChecks(d, { themeId: 'ethnic', locale: 'en', today, variant: 'wedding_ceremony' }).filter((i) => i.section === 'couple')).toHaveLength(2)
  })

  it('skips a hidden optional couple (anniversary) but not a required one', () => {
    const d = publishableDraft()
    d.couple = { groom: {}, bride: {}, enabled: false }
    expect(publishChecks(d, { themeId: 'ethnic', today, variant: 'anniversary' }).some((i) => i.section === 'couple')).toBe(false)
    expect(publishChecks(d, { themeId: 'ethnic', today, variant: 'engagement' }).some((i) => i.section === 'couple')).toBe(true)
  })

  it('checks the v2.0 sections only when shown, and ignores sections the variant does not offer', () => {
    const d = publishableDraft()
    d.story = { enabled: true, timeline: [] } // seminar doesn't offer a story
    d.profiles = { enabled: true, people: [] } // nor profiles
    d.agenda = { enabled: true, items: [] }
    d.speakers = { enabled: true, people: [] }
    d.rsvp = { ...d.rsvp, allowSessionChoice: true }
    const result = codes(publishChecks(d, { themeId: 'ethnic', today, variant: 'seminar' }))
    expect(result).not.toContain('error:story:incomplete')
    expect(result.some((c) => c.includes(':profiles:'))).toBe(false)
    // Shown but empty BLOCKS, exactly like the server (the audited seminar case).
    expect(result).toEqual(expect.arrayContaining(['error:agenda:incomplete', 'error:speakers:incomplete', 'warning:rsvp:no_optional_sessions']))

    const family = publishableDraft()
    family.profiles = { enabled: true, people: [] }
    expect(codes(publishChecks(family, { themeId: 'ethnic', today, variant: 'family_reunion' }))).toContain('error:profiles:incomplete')
  })

  it('links v2.0 issues to their editor pages', () => {
    const d = publishableDraft()
    d.profiles = { enabled: true, people: [] }
    const issue = publishChecks(d, { themeId: 'ethnic', today, variant: 'graduation' }).find((i) => i.section === 'profiles')!
    expect(issue.to).toEqual({ name: 'editor-profiles', hash: '#f-people' })
  })
  it('accepts numeric milestone values (sweet_17 age, anniversary years) without throwing', () => {
    const d = publishableDraft()
    d.milestone = { enabled: true, age: 17 } as typeof d.milestone
    expect(() => publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'sweet_17' })).not.toThrow()
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'sweet_17' }))).not.toContain('error:milestone:incomplete')
    d.milestone = { enabled: true, years: 25 } as typeof d.milestone
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'anniversary' }))).not.toContain('error:milestone:incomplete')
    d.milestone = { enabled: true }
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'birthday' }))).toContain('error:milestone:incomplete')
  })

  it('matches the server for the audited seminar: empty organization, agenda and speakers all block', () => {
    const d = publishableDraft()
    d.organization = { enabled: true }
    d.agenda = { enabled: true, items: [] }
    d.speakers = { enabled: true, people: [] }
    const errors = publishChecks(d, { themeId: 'temuvibe-corporate', today, variant: 'seminar' }).filter((i) => i.severity === 'error')
    expect(errors.map((i) => `${i.section}.${i.field}:${i.code}`).sort()).toEqual(['agenda.items:incomplete', 'organization.name:required', 'speakers.people:incomplete'])
  })

  it('online sessions need access but no venue; hybrid needs both', () => {
    const d = publishableDraft()
    d.events = [{ id: 'e1', type: 'session', title: 'Webinar', date: '2027-06-12', startTime: '10:00', format: 'online' }]
    const online = codes(publishChecks(d, { themeId: 'temuvibe-corporate', today, variant: 'seminar' }))
    expect(online).toContain('error:events:required')
    const fields = publishChecks(d, { themeId: 'temuvibe-corporate', today, variant: 'seminar' }).filter((i) => i.section === 'events').map((i) => i.field)
    expect(fields).toEqual(['0.onlineUrl'])
    d.events[0]!.onlineInstructions = 'The link is emailed on the day.'
    expect(publishChecks(d, { themeId: 'temuvibe-corporate', today, variant: 'seminar' }).filter((i) => i.section === 'events' && i.severity === 'error')).toEqual([])
    d.events[0]!.format = 'hybrid'
    expect(publishChecks(d, { themeId: 'temuvibe-corporate', today, variant: 'seminar' }).filter((i) => i.section === 'events' && i.severity === 'error').map((i) => i.field).sort())
      .toEqual(['0.address', '0.venueName'])
  })

  it('re-words server issues in the editor language from their stable codes', () => {
    const draft = publishableDraft()
    draft.events = [{ id: 'e1', type: 'session', title: 'Sesi Utama' }]
    const ctx = { locale: 'id' as const, variant: 'seminar' as const, draft }
    expect(localizeServerIssue({ section: 'organization', field: 'organization.name', code: 'required', message: 'Add the organization name, or hide this section.' }, ctx))
      .toBe('Organisasi ditampilkan tetapi belum ada nama — isi atau matikan Organisasi.')
    expect(localizeServerIssue({ section: 'events', field: 'events.0.venueName', code: 'required', message: 'Event 1 needs a venue name.' }, ctx)).toBe('Sesi Utama: tambahkan lokasi.')
    expect(localizeServerIssue({ section: 'events', field: 'events.0.onlineUrl', code: 'required', message: 'x' }, ctx)).toContain('daring')
    expect(localizeServerIssue({ section: 'opening', field: 'opening.weddingDate', code: 'required', message: 'Add the event date.' }, ctx)).toBe('Tambahkan tanggal acara.')
    expect(localizeServerIssue({ section: 'theme', field: 'themeId', code: 'incompatible', message: 'x' }, ctx)).toContain('Templat ini tidak mendukung')
    // Unknown combination: a localized generic line naming the section, never the English text.
    const generic = localizeServerIssue({ section: 'mystery', field: 'x', code: 'weird', message: 'English only' }, { ...ctx, sectionName: () => 'Misteri' })
    expect(generic).toBe('Misteri perlu diperbaiki sebelum dipublikasikan.')
    expect(issueFromServer({ section: 'agenda', field: 'agenda.items', code: 'incomplete', message: 'x' }, ctx)).toMatchObject({ section: 'agenda', field: 'items', severity: 'error' })
  })
})
