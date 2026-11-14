/**
 * Central theme registry. To add a theme: create its folder with an
 * `index.ts` exporting a ThemeDefinition, then add it to THEMES below.
 * Nothing else (renderer, content model) needs to change.
 */
import { artisticTheme } from '../artistic'
import { conventionalTheme } from '../conventional'
import { ethnicTheme } from '../ethnic'
import { internationalTheme } from '../international'
import { traditionalTheme } from '../traditional'
import type { ThemeDefinition } from './types'

export const THEMES: readonly ThemeDefinition[] = Object.freeze([
  internationalTheme,
  traditionalTheme,
  ethnicTheme,
  conventionalTheme,
  artisticTheme,
])

export const DEFAULT_THEME_ID = internationalTheme.id

const byId = new Map(THEMES.map((theme) => [theme.id, theme]))

export function getTheme(id: string | null | undefined): ThemeDefinition | undefined {
  return id ? byId.get(id) : undefined
}

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id)
}
