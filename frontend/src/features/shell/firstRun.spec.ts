import { beforeEach, describe, expect, it } from 'vitest'

import { emptyDraft, normalizeDraft } from '@/features/wedding/draft'

import { hasSeenWelcome, isFreshWedding, markWelcomeSeen, resumeStep, shouldStartWelcome } from './firstRun'

const withNames = () => normalizeDraft({ ...emptyDraft(), couple: { groom: { name: 'Rizky' }, bride: {} } })
const withDate = () => normalizeDraft({ ...emptyDraft(), opening: { weddingDate: '2027-06-12' } })

describe('first run', () => {
  beforeEach(() => localStorage.clear())

  it('a wedding without names and date is fresh', () => {
    expect(isFreshWedding(emptyDraft())).toBe(true)
    expect(isFreshWedding(normalizeDraft({ ...emptyDraft(), opening: { weddingTitle: 'Hi', weddingDate: 'not-a-date' } }))).toBe(true)
    expect(isFreshWedding(withNames())).toBe(false)
    expect(isFreshWedding(withDate())).toBe(false)
    expect(isFreshWedding(normalizeDraft({ ...emptyDraft(), couple: { groom: {}, bride: { nickname: 'Ayu' } } }))).toBe(false)
    expect(isFreshWedding(normalizeDraft({ ...emptyDraft(), opening: { coupleNames: 'Rizky & Ayu' } }))).toBe(false)
    expect(isFreshWedding(null)).toBe(false)
  })

  it('redirects a fresh wedding only once per user', () => {
    expect(shouldStartWelcome(emptyDraft(), 'u1')).toBe(true)
    markWelcomeSeen('u1')
    expect(hasSeenWelcome('u1')).toBe(true)
    expect(shouldStartWelcome(emptyDraft(), 'u1')).toBe(false)
    expect(shouldStartWelcome(emptyDraft(), 'u2')).toBe(true) // another account on this browser
  })

  it('never redirects without a user or once content exists', () => {
    expect(shouldStartWelcome(emptyDraft(), null)).toBe(false)
    expect(shouldStartWelcome(withNames(), 'u1')).toBe(false)
  })

  it('resumes at ?step, else at the first step not done', () => {
    expect(resumeStep('2', emptyDraft(), null)).toBe(2)
    expect(resumeStep(['3'], emptyDraft(), null)).toBe(3)
    expect(resumeStep('9', emptyDraft(), null)).toBe(1)
    expect(resumeStep(undefined, emptyDraft(), null)).toBe(1)
    expect(resumeStep(undefined, withNames(), null)).toBe(2)
    expect(resumeStep(undefined, withNames(), 'international')).toBe(3)
  })
})
