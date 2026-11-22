/**
 * Colours for the live RSVP form inside the pre-engine (legacy) themes, derived from the
 * theme's generated manifest so the form looks like part of the design. The form sits
 * on its own card (`--tv-surface` = the theme background) so every pair is known and
 * kept at WCAG AA, whatever band colour the theme's RSVP section uses.
 */
import { pickContrasting } from './contrast'
import { templateManifest } from './manifests'

const DARK = '#1b1b1b'
const LIGHT = '#ffffff'
const DANGER_ON_LIGHT = '#a12d3a'
const DANGER_ON_DARK = '#ffb3b3'

/** `--tv-*` custom properties for RsvpForm in a legacy theme; empty for unknown ids. */
export function legacyFormStyle(themeId: string | undefined): Record<string, string> {
  const m = templateManifest(themeId)
  if (!m) return {}
  const c = m.theme.colors
  const surface = c.background
  const ink = pickContrasting(surface, [c.text, DARK, LIGHT])
  const muted = pickContrasting(surface, [c.muted, ink])
  const primary = pickContrasting(surface, [c.primary, c.text, ink], 3)
  const onPrimary = pickContrasting(primary, [surface, LIGHT, DARK])
  const accentInk = pickContrasting(surface, [c.primary, c.accent, ink])
  const danger = pickContrasting(surface, [DANGER_ON_LIGHT, DANGER_ON_DARK, ink])
  return {
    '--tv-surface': surface,
    '--tv-ink': ink,
    '--tv-muted': muted,
    '--tv-primary': primary,
    '--tv-on-primary': onPrimary,
    '--tv-accent-ink': accentInk,
    '--tv-line': muted,
    '--tv-danger': danger,
    '--tv-radius': '0.375rem',
    '--tv-font-display': `'${m.theme.typography.display}', Georgia, serif`,
  }
}
