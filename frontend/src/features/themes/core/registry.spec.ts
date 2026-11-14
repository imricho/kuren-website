import { describe, expect, it } from 'vitest'

import {
  COLLECTIONS,
  DEFAULT_THEME_ID,
  FAMILIES,
  TEMPLATES,
  THEMES,
  collectionCounts,
  getCollection,
  getFamily,
  getTemplate,
  getTheme,
  isThemeId,
  templateCounts,
  templatePath,
  templateSlug,
  validateCatalog,
} from './registry'
import type { ThemeCollection, ThemeFamily, ThemeTemplate } from './types'

describe('theme registry — Workstream 2 compatibility', () => {
  it('exposes all seven available templates as selectable THEMES', () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      'international', 'traditional', 'ethnic', 'conventional', 'artistic', 'still-form', 'wildwood-gathering',
    ])
  })

  it('resolves every original id with getTheme/isThemeId', () => {
    for (const id of ['international', 'traditional', 'ethnic', 'conventional', 'artistic', 'still-form', 'wildwood-gathering']) {
      expect(getTheme(id)?.id).toBe(id)
      expect(isThemeId(id)).toBe(true)
    }
    expect(getTheme(DEFAULT_THEME_ID)?.status).toBe('available')
  })

  it('exposes the metadata needed by the picker', () => {
    for (const theme of THEMES) {
      expect(theme.name).toBeTruthy()
      expect(theme.tagline).toBeTruthy()
      expect(theme.description.length).toBeGreaterThan(40)
      expect(theme.previewImage).toBeTruthy()
      expect(theme.fonts?.href).toMatch(/^https:\/\/fonts\.googleapis\.com\/.*display=swap/)
    }
  })

  it('lazily loads a component for every selectable template', async () => {
    for (const theme of THEMES) {
      expect(await theme.component()).toHaveProperty('default')
    }
  })

  it('rejects unknown, empty and planned ids as renderable themes', () => {
    expect(getTheme('nope')).toBeUndefined()
    expect(getTheme(null)).toBeUndefined()
    expect(isThemeId('__proto__')).toBe(false)
    expect(getTheme('removed-template')).toBeUndefined()
    expect(isThemeId('removed-template')).toBe(false)
    expect(getTemplate('removed-template')).toBeUndefined()
  })

  it('is frozen so the catalog cannot be mutated at runtime', () => {
    expect(Object.isFrozen(THEMES)).toBe(true)
    expect(Object.isFrozen(TEMPLATES)).toBe(true)
  })
})

describe('theme hierarchy: family → collection → template', () => {
  it('passes all catalog integrity checks', () => {
    expect(validateCatalog()).toEqual([])
  })

  it('has the six families in order', () => {
    expect(FAMILIES.map((f) => f.id)).toEqual([
      'traditional',
      'international',
      'classic',
      'artistic',
      'modern-minimalist',
      'rustic-nature',
    ])
    expect(getFamily('modern-minimalist')?.status).toBe('available')
    expect(getFamily('rustic-nature')?.status).toBe('available')
  })

  it('places the original templates in their new families and collections', () => {
    const where = (id: string) => {
      const p = templatePath(id)!
      return `${p.family.id}/${p.collection.id}/${p.template.name}`
    }
    expect(where('international')).toBe('international/editorial/Editorial Ivory')
    expect(where('traditional')).toBe('traditional/ceremonial-classic/Royal Maroon')
    expect(where('ethnic')).toBe('traditional/artisan-pattern/Woven Indigo')
    expect(where('conventional')).toBe('classic/romantic-floral/Blush Garden')
    expect(where('artistic')).toBe('artistic/contemporary/Gallery Bold')
    expect(where('still-form')).toBe('modern-minimalist/quiet-form/Still Form')
    expect(where('wildwood-gathering')).toBe('rustic-nature/field-notes/Field Notes')
  })

  it('every template references a real family and a collection of that family', () => {
    for (const t of TEMPLATES) {
      const collection = getCollection(t.collectionId)
      expect(collection, t.id).toBeDefined()
      expect(collection!.familyId).toBe(t.familyId)
      expect(getFamily(t.familyId), t.id).toBeDefined()
    }
    expect(COLLECTIONS.every((c) => getFamily(c.familyId))).toBe(true)
  })
})

describe('validateCatalog catches mistakes', () => {
  const fam: ThemeFamily[] = [{ id: 'f', name: 'F', tagline: '', description: '', status: 'available' }]
  const col: ThemeCollection[] = [
    {
      id: 'c',
      familyId: 'f',
      name: 'C',
      description: '',
      status: 'available',
      reference: { kind: 'design', notes: '', review: 'not_required' },
    },
  ]
  const base = {
    familyId: 'f',
    collectionId: 'c',
    name: 'T',
    tagline: '',
    description: '',
    previewImage: 'x.svg',
    component: () => Promise.resolve({ default: {} }),
  }
  const ok: ThemeTemplate = { ...base, id: 't', status: 'available' }
  const run = (templates: ThemeTemplate[], families = fam, collections = col) =>
    validateCatalog(families, collections, [{ ...ok, id: 'international' }, ...templates])

  it('flags duplicate, reserved and malformed ids', () => {
    const problems = run([ok, { ...ok }, { ...ok, id: 'preview' }, { ...ok, id: 'Bad Id' }])
    expect(problems).toEqual(
      expect.arrayContaining([
        'duplicate template id "t"',
        'template id "preview" is reserved',
        'template id "Bad Id" must be kebab-case',
      ]),
    )
  })

  it('flags broken references and family/collection mismatches', () => {
    const problems = run([
      { ...ok, id: 'a', collectionId: 'missing' },
      { ...ok, id: 'b', familyId: 'other' },
    ])
    expect(problems).toContain('template "a" references unknown collection "missing"')
    expect(problems).toContain('template "b" references unknown family "other"')
    expect(problems).toContain('template "b" is in family "other" but its collection belongs to "f"')
  })

  it('flags available templates without a renderer and unreviewed cultural collections', () => {
    const noRenderer = { ...ok, id: 'n', component: undefined } as unknown as ThemeTemplate
    const cultural: ThemeCollection[] = [{ ...col[0]!, reference: { kind: 'cultural', notes: '', review: 'needs_review' } }]
    const problems = run([noRenderer], fam, cultural)
    expect(problems).toContain('template "n" is available but has no renderer')
    expect(problems).toContain('cultural collection "c" must be reviewed before it is available')
  })

  it('flags an available family with nothing to choose', () => {
    const problems = validateCatalog(
      [...fam, { id: 'empty', name: 'E', tagline: '', description: '', status: 'available' }],
      col,
      [{ ...ok, id: 'international' }],
    )
    expect(problems).toContain('family "empty" is available but has no available templates')
  })
})

describe('naming, aliases and counts', () => {
  it('uses one canonical display name for the Conventional / Classic family, with the old slug as an alias', () => {
    expect(getFamily('classic')?.name).toBe('Conventional / Classic')
    expect(getFamily('conventional')?.id).toBe('classic')
  })

  it('gives every template a URL slug that resolves to it (ids stay the stored key)', () => {
    expect(templateSlug(getTheme('conventional')!)).toBe('blush-garden')
    expect(templateSlug(getTheme('traditional')!)).toBe('royal-maroon')
    for (const t of TEMPLATES) expect(getTemplate(templateSlug(t))?.id).toBe(t.id)
  })

  it('resolves template slugs to the canonical template', () => {
    expect(getTheme('blush-garden')?.id).toBe('conventional')
    expect(getTheme('royal-maroon')?.id).toBe('traditional')
    expect(isThemeId('woven-indigo')).toBe(true)
  })

  it('counts collections by availability per family', () => {
    expect(collectionCounts('traditional')).toEqual({ total: 2, available: 2, draft: 0, comingSoon: 0 })
    expect(collectionCounts('classic')).toEqual({ total: 1, available: 1, draft: 0, comingSoon: 0 })
    expect(collectionCounts('modern-minimalist')).toEqual({ total: 1, available: 1, draft: 0, comingSoon: 0 })
    expect(collectionCounts('rustic-nature')).toEqual({ total: 1, available: 1, draft: 0, comingSoon: 0 })
  })

  it('counts templates by availability per family and collection', () => {
    expect(templateCounts({ familyId: 'traditional' })).toEqual({ available: 2, draft: 0, comingSoon: 0 })
    expect(templateCounts({ collectionId: 'ceremonial-classic' })).toEqual({ available: 1, draft: 0, comingSoon: 0 })
    expect(templateCounts({ collectionId: 'artisan-pattern' })).toEqual({ available: 1, draft: 0, comingSoon: 0 })
    expect(templateCounts({ familyId: 'modern-minimalist' })).toEqual({ available: 1, draft: 0, comingSoon: 0 })
    expect(templateCounts({ familyId: 'rustic-nature' })).toEqual({ available: 1, draft: 0, comingSoon: 0 })
  })

  it('rejects aliases that collide with another id', () => {
    const problems = validateCatalog(
      FAMILIES.map((f) => (f.id === 'artistic' ? { ...f, aliases: ['classic'] } : f)),
      COLLECTIONS,
      TEMPLATES,
    )
    expect(problems).toContain('duplicate family id "classic"')
  })
})
