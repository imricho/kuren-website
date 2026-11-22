import { describe, expect, it } from 'vitest'

import { WEDDING_EVENT_TYPES } from '@/features/wedding/types'

import {
  CATEGORIES,
  canonicalSectionOrder,
  isSectionOffered,
  isSectionRequired,
  isTemplateCompatible,
  isVariantId,
  SECTION_ORDER,
  sectionConfig,
  sectionsFor,
  sessionTypesFor,
  VARIANT_IDS,
  VARIANTS,
  variantOf,
  variantsOf,
} from './registry'

describe('invitation registry helpers', () => {
  it('groups every variant under exactly one category, in the category order', () => {
    expect(variantsOf('wedding').map((v) => v.id)).toEqual(['wedding_ceremony', 'wedding_reception'])
    expect(variantsOf('corporate').map((v) => v.id)).toEqual(['corporate_event', 'company_celebration', 'seminar', 'workshop'])
    for (const c of CATEGORIES) expect(variantsOf(c.id).map((v) => v.id)).toEqual(c.variants)
    expect(CATEGORIES.flatMap((c) => c.variants).sort()).toEqual([...VARIANT_IDS].sort())
  })

  it('offers the 13 wedding sections to both wedding variants', () => {
    for (const v of ['wedding_ceremony', 'wedding_reception'] as const) {
      expect(sectionsFor(v).map((s) => s.id)).toEqual([
        'opening', 'holyRecite1', 'greeting', 'couple', 'countdown', 'events',
        'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
      ])
      expect(sectionsFor(v).filter((s) => s.required).map((s) => s.id)).toEqual(['opening', 'couple', 'countdown', 'events', 'closing'])
    }
  })

  it('answers offering/required questions per variant', () => {
    expect(isSectionOffered('birthday', 'profiles')).toBe(true)
    expect(isSectionOffered('birthday', 'couple')).toBe(false)
    expect(isSectionOffered('seminar', 'speakers')).toBe(true)
    expect(isSectionOffered('corporate_event', 'wishes')).toBe(false)
    expect(isSectionRequired('anniversary', 'couple')).toBe(false)
    expect(isSectionRequired('engagement', 'couple')).toBe(true)
    expect(sectionConfig('sweet_17', 'milestone')?.defaults).toEqual({ age: 17 })
    expect(sectionConfig('graduation', 'profiles')?.roles).toEqual(['graduate'])
  })

  it('keeps every variant in canonical order and always offers the structural sections', () => {
    for (const v of VARIANTS) {
      const ids = v.sections.map((s) => s.id)
      expect(canonicalSectionOrder(ids), v.id).toEqual(ids)
      for (const id of ['opening', 'countdown', 'events', 'closing'] as const) expect(isSectionRequired(v.id, id), `${v.id}.${id}`).toBe(true)
    }
  })

  it('sorts section ids into the canonical order (dropping duplicates)', () => {
    expect(canonicalSectionOrder(['closing', 'agenda', 'opening', 'agenda', 'profiles'])).toEqual(['opening', 'profiles', 'agenda', 'closing'])
    expect(canonicalSectionOrder([...SECTION_ORDER].reverse())).toEqual([...SECTION_ORDER])
  })

  it('checks template compatibility: temuvibe by category, legacy themes for wedding-style variants only', () => {
    expect(isTemplateCompatible('temuvibe-corporate', 'seminar')).toBe(true)
    expect(isTemplateCompatible('temuvibe-corporate', 'birthday')).toBe(false)
    expect(isTemplateCompatible('temuvibe-festive', 'family_reunion')).toBe(true)
    expect(isTemplateCompatible('temuvibe-elegant', 'wedding_reception')).toBe(true)
    expect(isTemplateCompatible('ethnic', 'wedding_ceremony')).toBe(true)
    expect(isTemplateCompatible('ethnic', 'anniversary')).toBe(true)
    expect(isTemplateCompatible('ethnic', 'birthday')).toBe(false)
    expect(isTemplateCompatible('ethnic', 'seminar')).toBe(false)
  })

  it('falls back to wedding_ceremony for unknown variants and keeps the wedding session types', () => {
    expect(isVariantId('birthday')).toBe(true)
    expect(isVariantId('wedding')).toBe(false)
    expect(variantOf('nope').id).toBe('wedding_ceremony')
    expect(variantOf(undefined).id).toBe('wedding_ceremony')
    expect(sessionTypesFor('wedding_reception')).toEqual(WEDDING_EVENT_TYPES)
    expect(sessionTypesFor('seminar')).toContain('talk')
  })
})
