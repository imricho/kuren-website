/**
 * The pre-engine theme manifests are GENERATED from the real stylesheets. Fail when the
 * generated file drifts from the CSS (or a theme is added without regenerating).
 *   UPDATE_MANIFESTS=1 npx vitest run src/features/themes/catalog/legacyManifests.spec.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { THEMES } from '../core/registry'
import { wovenMotifs } from '../ethnic/motifs/woven'
import { LEGACY_THEME_TOKENS } from './legacyManifests.generated'
import { LEGACY_RENDERERS, extractLegacyThemeTokens, legacyRendererOf, type LegacyThemeTokens } from './legacyThemeTokens'

const themesDir = resolve(__dirname, '..')
const css = (file: string) => readFileSync(resolve(themesDir, file), 'utf8')
const ethnicVars = Object.fromEntries(
  Object.entries(wovenMotifs.cssVars).filter(([, v]) => v.startsWith('#')).map(([k, v]) => [k.replace(/^--/, ''), v]),
)

function generate(): Record<string, LegacyThemeTokens> {
  const out: Record<string, LegacyThemeTokens> = {}
  for (const t of THEMES) {
    if (t.familyId === 'temuvibe') continue
    const key = legacyRendererOf(t)
    if (!key) throw new Error(`no legacy renderer for ${t.id}`)
    const spec = LEGACY_RENDERERS[key]
    const variant = typeof t.config?.variant === 'string' ? t.config.variant : undefined
    out[t.id] = extractLegacyThemeTokens(css(spec.file), spec, variant, key === 'eth' ? ethnicVars : {})
  }
  return out
}

describe('generated legacy theme manifests', () => {
  it('match the tokens in the theme stylesheets', () => {
    const fresh = generate()
    if (process.env.UPDATE_MANIFESTS) {
      const body = JSON.stringify(fresh, null, 2)
      writeFileSync(
        resolve(__dirname, 'legacyManifests.generated.ts'),
        `// GENERATED — do not edit. Regenerate: UPDATE_MANIFESTS=1 npx vitest run src/features/themes/catalog/legacyManifests.spec.ts\nimport type { LegacyThemeTokens } from './legacyThemeTokens'\n\nexport const LEGACY_THEME_TOKENS: Readonly<Record<string, LegacyThemeTokens>> = ${body}\n`,
      )
      return
    }
    expect(LEGACY_THEME_TOKENS).toEqual(fresh)
    expect(Object.keys(fresh)).toHaveLength(49)
  })

  it('variants get their own palette (not only the family default)', () => {
    const fresh = generate()
    expect(fresh['black-tie']!.colors.background).toBe('#202120')
    expect(fresh['still-form']!.colors.background).toBe('#f4f2ed')
    expect(fresh['ethnic']!.colors.primary).toBe('#1f2a44')
    expect(fresh['conventional']!.typography).toEqual({ display: 'Lora', body: 'Lora', script: 'Great Vibes' })
    for (const tokens of Object.values(fresh)) for (const v of Object.values(tokens.colors)) expect(v).toMatch(/^#[0-9a-f]{6}$/)
  })
})
