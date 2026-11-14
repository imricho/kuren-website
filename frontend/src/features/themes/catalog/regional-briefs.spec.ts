import { describe, expect, it } from 'vitest'

import { COLLECTIONS, collectionsOf, validateBrief } from '../core/registry'
import type { ThemeCollection } from '../core/types'
import { REGIONAL_BRIEFS } from './regional-briefs'

const regional = collectionsOf('traditional').filter((c) => c.reference.kind === 'cultural')

describe('regional Traditional collections — cultural briefs', () => {
  it('Traditional has exactly 12 regional collections plus the separate Nusantara Heritage collection', () => {
    expect(regional).toHaveLength(12)
    const general = collectionsOf('traditional').filter((c) => c.reference.kind === 'design')
    expect(general.map((c) => c.id)).toEqual(['nusantara-heritage'])
    expect(general[0]!.brief).toBeUndefined()
  })

  it('every regional collection has a brief and no brief exists without a collection', () => {
    for (const c of regional) expect(c.brief, c.id).toBeDefined()
    expect(Object.keys(REGIONAL_BRIEFS).sort()).toEqual(regional.map((c) => c.id).sort())
  })

  it('nothing is presented as verified, confirmed or reviewed yet', () => {
    for (const c of regional) {
      const b = c.brief!
      expect(c.status, c.id).toBe('coming_soon')
      expect(b.review.status, c.id).toBe('in_development')
      expect(b.review.reviewers, c.id).toEqual([])
      expect(b.sources.every((s) => !s.verified), c.id).toBe(true)
      expect(Object.values(b.confirmed).flat(), c.id).toEqual([])
    }
  })

  it('multi-community collections require a locality or subtradition before specific motifs', () => {
    for (const id of ['javanese', 'sundanese', 'minangkabau', 'batak', 'malay', 'madura', 'balinese', 'dayak', 'ambon-maluku', 'papuan']) {
      const b = REGIONAL_BRIEFS[id]!
      expect(b.localityRequired, id).toBe(true)
      expect(b.selectedLocality, id).toBeNull()
    }
    expect(REGIONAL_BRIEFS.batak!.localities.map((l) => l.name)).toEqual(['Toba', 'Karo', 'Mandailing', 'Simalungun', 'Pakpak', 'Angkola'])
    expect(REGIONAL_BRIEFS.papuan!.localities.map((l) => l.id)).toEqual(['biak', 'asmat', 'sentani', 'dani'])
    // Option lists are explicitly marked as not exhaustive where communities are many.
    for (const id of ['javanese', 'bugis', 'malay', 'madura', 'dayak', 'ambon-maluku', 'papuan']) {
      expect(REGIONAL_BRIEFS[id]!.localitiesNote, id).toMatch(/not exhaustive/i)
    }
  })

  it('keeps locality-specific sources scoped to their locality', () => {
    const covers = (id: string) => REGIONAL_BRIEFS[id]!.sources.map((s) => s.covers).join(' ')
    expect(covers('batak')).toMatch(/Toba subtradition only/)
    expect(covers('dayak')).toMatch(/community association to confirm/)
    expect(covers('malay')).toMatch(/Specific to Siak/)
  })

  it('every brief has guardrails and a complete, valid art direction', () => {
    for (const c of regional) {
      const b = c.brief!
      expect(b.avoid.length, c.id).toBeGreaterThan(0)
      expect(b.artDirection.palette.length, c.id).toBeGreaterThan(0)
      for (const color of b.artDirection.palette) expect(color.hex, c.id).toMatch(/^#[0-9A-F]{6}$/i)
      for (const field of ['typography', 'composition', 'imagery', 'layout'] as const) expect(b.artDirection[field], c.id).toBeTruthy()
      for (const s of b.sources) expect(s.url, c.id).toMatch(/^https:\/\//)
    }
  })

  it('records the AI desk review without presenting it as a practitioner review', () => {
    for (const c of regional) {
      expect(c.brief!.review.notes.some((n) => /desk review by an AI/.test(n) && /not a practitioner/.test(n)), c.id).toBe(true)
      expect(c.brief!.review.reviewers, c.id).toEqual([])
    }
  })

  it('includes the guardrails added by the cultural review', () => {
    const avoid = (id: string) => REGIONAL_BRIEFS[id]!.avoid.join(' ')
    expect(avoid('balinese')).toMatch(/poleng/)
    expect(avoid('dayak')).toMatch(/hornbill/)
    expect(avoid('papuan')).toMatch(/Morning Star/)
    expect(avoid('batak')).toMatch(/do not identify as Batak/)
    expect(avoid('minangkabau')).toMatch(/marawa/)
  })

  it('all briefs pass the brief validation rules', () => {
    for (const c of COLLECTIONS.filter((c) => c.reference.kind === 'cultural')) expect(validateBrief(c), c.id).toEqual([])
  })
})

describe('validateBrief blocks releasing unverified or unreviewed cultural designs', () => {
  const batak = regional.find((c) => c.id === 'batak')!
  const withBrief = (patch: Partial<ThemeCollection>, brief: Partial<NonNullable<ThemeCollection['brief']>> = {}): ThemeCollection => ({
    ...batak,
    ...patch,
    brief: { ...batak.brief!, ...brief },
  })

  it('refuses an available collection without review, verified sources or a chosen subtradition', () => {
    const problems = validateBrief(withBrief({ status: 'available' }))
    expect(problems).toContain('collection "batak" must be reviewed before it is available')
    expect(problems).toContain('collection "batak" needs at least one verified source before it is available')
    expect(problems).toContain('collection "batak" needs a subtradition before it is available')
  })

  it('refuses confirmed references without a verified source', () => {
    const problems = validateBrief(withBrief({}, { confirmed: { garments: [], textiles: ['Ulos'], motifs: [], objects: [] } }))
    expect(problems).toContain('collection "batak" lists confirmed references without a verified source')
  })

  it('refuses a "reviewed" status with no named reviewers', () => {
    const problems = validateBrief(
      withBrief({ reference: { ...batak.reference, review: 'reviewed' } }, { review: { status: 'reviewed', reviewers: [], notes: [] } }),
    )
    expect(problems).toContain('collection "batak" is marked reviewed but names no reviewers')
  })

  it('accepts a fully reviewed, sourced, locality-specific collection', () => {
    const problems = validateBrief(
      withBrief(
        { status: 'available', reference: { ...batak.reference, review: 'reviewed' } },
        {
          selectedLocality: 'toba',
          review: { status: 'reviewed', reviewers: ['Example cultural organisation'], notes: [] },
          sources: batak.brief!.sources.map((s) => ({ ...s, verified: true })),
        },
      ),
    )
    expect(problems).toEqual([])
  })
})
