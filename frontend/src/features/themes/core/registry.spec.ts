import { describe, expect, it } from 'vitest'

import { DEFAULT_THEME_ID, THEMES, getTheme, isThemeId } from './registry'
import { THEME_CATEGORIES } from './types'

describe('theme registry', () => {
  it('contains exactly the five initial themes', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['international', 'traditional', 'ethnic', 'conventional', 'artistic'])
  })

  it('covers every theme category with unique ids', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
    expect(new Set(THEMES.map((t) => t.category))).toEqual(new Set(THEME_CATEGORIES))
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

  it('lazily loads a component for every theme', async () => {
    for (const theme of THEMES) {
      const mod = await theme.component()
      expect(mod).toHaveProperty('default')
    }
  })

  it('looks up themes by id and rejects unknown ids', () => {
    expect(getTheme('artistic')?.name).toBe('Artistic')
    expect(getTheme('nope')).toBeUndefined()
    expect(getTheme(null)).toBeUndefined()
    expect(isThemeId('ethnic')).toBe(true)
    expect(isThemeId('__proto__')).toBe(false)
    expect(getTheme(DEFAULT_THEME_ID)).toBeDefined()
  })

  it('is frozen so themes cannot be mutated at runtime', () => {
    expect(Object.isFrozen(THEMES)).toBe(true)
  })
})
