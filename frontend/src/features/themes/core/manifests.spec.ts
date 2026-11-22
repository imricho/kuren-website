/** Manifests for every selectable template, and their agreement with the invitation registry. */
import { describe, expect, it } from 'vitest'

import { CATEGORIES, SECTION_ORDER, VARIANT_IDS, isTemplateCompatible, variantOf } from '@/features/invitation/registry'

import { LEGACY_TEMPLATE_SECTIONS, TEMPLATE_MANIFESTS, manifestsForVariant, templateManifest } from './manifests'
import { THEMES } from './registry'

const TEMUVIBE = ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive', 'temuvibe-corporate']

describe('template manifests', () => {
  it('exist for all 53 selectable templates', () => {
    expect(TEMPLATE_MANIFESTS.map((m) => m.id)).toEqual(THEMES.map((t) => t.id))
    expect(TEMPLATE_MANIFESTS).toHaveLength(53)
  })

  it('declare the legacy rule for the 49 original themes: wedding-style variants and the 13 wedding sections', () => {
    const legacy = TEMPLATE_MANIFESTS.filter((m) => !TEMUVIBE.includes(m.id))
    expect(legacy).toHaveLength(49)
    for (const m of legacy) {
      expect(m.categories, m.id).toEqual(['wedding', 'celebration'])
      expect(m.variants, m.id).toEqual(['wedding_ceremony', 'wedding_reception', 'engagement', 'anniversary'])
      expect(m.sections, m.id).toEqual(LEGACY_TEMPLATE_SECTIONS)
      expect(m.sections).toHaveLength(13)
      expect(m.media).toEqual({ cover: 'optional', gallery: true })
      expect(m.theme.typography.display, m.id).toBeTruthy()
    }
  })

  it('declare the Temuvibe categories from the contract and every section', () => {
    expect(templateManifest('temuvibe-elegant')!.categories).toEqual(['wedding', 'celebration', 'gathering', 'corporate'])
    expect(templateManifest('temuvibe-minimal')!.categories).toEqual(['wedding', 'celebration', 'gathering', 'corporate'])
    expect(templateManifest('temuvibe-festive')!.categories).toEqual(['celebration', 'gathering'])
    expect(templateManifest('temuvibe-corporate')!.categories).toEqual(['corporate', 'gathering'])
    for (const id of TEMUVIBE) {
      const m = templateManifest(id)!
      expect(m.variants).toBeUndefined()
      expect(m.sections).toEqual([...SECTION_ORDER])
      expect(m.theme.colors.primary).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(templateManifest('temuvibe-elegant')!.theme.colors.primary).toBe('#241236')
    expect(templateManifest('temuvibe-elegant')!.theme.typography).toEqual({ display: 'Cormorant Garamond', body: 'Manrope' })
  })

  it('agree with isTemplateCompatible for every template × variant', () => {
    for (const m of TEMPLATE_MANIFESTS)
      for (const v of VARIANT_IDS) {
        const byManifest = m.categories.includes(variantOf(v).category) && (!m.variants || m.variants.includes(v))
        expect(byManifest, `${m.id} × ${v}`).toBe(isTemplateCompatible(m.id, v))
      }
  })

  it('every variant has at least one compatible template; non-wedding variants only Temuvibe ones', () => {
    for (const c of CATEGORIES)
      for (const v of c.variants) {
        const ids = manifestsForVariant(v).map((m) => m.id)
        expect(ids.length, v).toBeGreaterThan(0)
        expect(ids, v).toContain('temuvibe-elegant')
        if (!['wedding_ceremony', 'wedding_reception', 'engagement', 'anniversary'].includes(v)) expect(ids.every((id) => TEMUVIBE.includes(id)), v).toBe(true)
      }
    expect(manifestsForVariant('seminar').map((m) => m.id)).toEqual(['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-corporate'])
    expect(manifestsForVariant('birthday').map((m) => m.id)).toEqual(['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive'])
    expect(manifestsForVariant('wedding_ceremony')).toHaveLength(51)
  })
})
