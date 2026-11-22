/** The publish checklist follows the variant: offered sections only, neutral wording outside weddings. */
import { describe, expect, it } from 'vitest'

import { publishableDraft } from '@/test/publishFixture'

import { publishChecks } from './publishChecks'

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
    expect(result).toEqual(expect.arrayContaining(['warning:agenda:empty', 'warning:speakers:empty', 'warning:rsvp:no_optional_sessions']))

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
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'sweet_17' }))).not.toContain('warning:milestone:empty')
    d.milestone = { enabled: true, years: 25 } as typeof d.milestone
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'anniversary' }))).not.toContain('warning:milestone:empty')
    d.milestone = { enabled: true }
    expect(codes(publishChecks(d, { themeId: 'temuvibe-elegant', today, variant: 'birthday' }))).toContain('warning:milestone:empty')
  })
})
