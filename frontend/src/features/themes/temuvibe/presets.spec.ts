/** Every Temuvibe preset meets WCAG 2.1 AA contrast for the text it renders. */
import { describe, expect, it } from 'vitest'

import { contrast } from '../core/contrast'
import { TEMUVIBE_PRESETS, TEMUVIBE_PRESET_IDS, tokenStyle } from './presets'

describe.each(TEMUVIBE_PRESET_IDS.map((id) => [id]))('%s tokens', (id) => {
  const k = TEMUVIBE_PRESETS[id].tokens
  const pairs: [string, string, string, number][] = [
    ['ink on bg', k.ink, k.bg, 4.5],
    ['ink on surface', k.ink, k.surface, 4.5],
    ['ink on surfaceAlt', k.ink, k.surfaceAlt, 4.5],
    ['muted on bg', k.muted, k.bg, 4.5],
    ['muted on surface', k.muted, k.surface, 4.5],
    ['muted on surfaceAlt', k.muted, k.surfaceAlt, 4.5],
    ['primary on bg', k.primary, k.bg, 4.5],
    ['primary on surfaceAlt', k.primary, k.surfaceAlt, 4.5],
    ['onPrimary on primary (buttons)', k.onPrimary, k.primary, 4.5],
    ['accentInk on bg', k.accentInk, k.bg, 4.5],
    ['accentInk on surface', k.accentInk, k.surface, 4.5],
    ['accentInk on surfaceAlt', k.accentInk, k.surfaceAlt, 4.5],
    ['heroInk on heroBg', k.heroInk, k.heroBg, 4.5],
    ['heroMuted on heroBg', k.heroMuted, k.heroBg, 4.5],
    ['heroAccent on heroBg (kicker, signature)', k.heroAccent, k.heroBg, 4.5],
    ['danger on surface (errors)', k.danger, k.surface, 4.5],
    ['muted input border on surface (non-text)', k.muted, k.surface, 3],
  ]
  it.each(pairs)('%s ≥ AA', (_label, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min)
  })

  it('exposes every token as a --tv-* custom property', () => {
    const style = tokenStyle(k)
    expect(style['--tv-bg']).toBe(k.bg)
    expect(style['--tv-font-display']).toBe(k.fontDisplay)
    expect(Object.keys(style).every((key) => key.startsWith('--tv-'))).toBe(true)
  })

  it('loads web fonts with display=swap', () => {
    expect(TEMUVIBE_PRESETS[id].fontsHref).toMatch(/^https:\/\/fonts\.googleapis\.com\/.*display=swap/)
  })
})
