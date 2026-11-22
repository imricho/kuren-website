/**
 * Temuvibe presets: one schema-driven renderer, four looks, expressed ONLY as design
 * tokens. The renderer sets these as CSS custom properties on its root (`--tv-*`), the
 * stylesheet consumes them, the manifests publish them, and `presets.spec.ts` checks
 * every text/background pair for WCAG AA contrast. Change a colour here, nowhere else.
 */
export const TEMUVIBE_PRESET_IDS = ['temuvibe-elegant', 'temuvibe-minimal', 'temuvibe-festive', 'temuvibe-corporate'] as const
export type TemuvibePresetId = (typeof TEMUVIBE_PRESET_IDS)[number]
export const DEFAULT_TEMUVIBE_PRESET: TemuvibePresetId = 'temuvibe-elegant'

export interface TemuvibeTokens {
  /** Page background. */
  bg: string
  /** Cards. */
  surface: string
  /** Alternate section band. */
  surfaceAlt: string
  ink: string
  muted: string
  /** Headings, buttons. */
  primary: string
  onPrimary: string
  /** Decorative only (rules, dots) — never body text. */
  accent: string
  /** Accent used for small text (kickers, links); AA on bg/surface/surfaceAlt. */
  accentInk: string
  line: string
  heroBg: string
  heroInk: string
  /** Large display accent on the hero (AA large at least; all presets reach 4.5:1). */
  heroAccent: string
  heroMuted: string
  /** Error text (forms); AA on surface. */
  danger: string
  radius: string
  /** CSS font stacks. */
  fontDisplay: string
  fontBody: string
  /** Display weight, letter spacing for headings and the uppercase kicker. */
  displayWeight: string
  displayTracking: string
  kickerTracking: string
}

export interface TemuvibePreset {
  id: TemuvibePresetId
  name: string
  tagline: string
  description: string
  /** Google Fonts stylesheet (display=swap). */
  fontsHref: string
  /** Hero composition. */
  hero: 'framed' | 'airy' | 'festive' | 'brand'
  tokens: TemuvibeTokens
}

const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif"
const SANS_FALLBACK = "'Segoe UI', system-ui, -apple-system, Arial, sans-serif"

export const TEMUVIBE_PRESETS: Readonly<Record<TemuvibePresetId, TemuvibePreset>> = {
  'temuvibe-elegant': {
    id: 'temuvibe-elegant',
    name: 'Temuvibe Elegant',
    tagline: 'Deep plum and champagne gold, quietly luxurious',
    description:
      'A refined serif invitation in Temuvibe deep plum with champagne-gold rules, generous spacing and a framed opening for any occasion.',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@400;500;600&display=swap',
    hero: 'framed',
    tokens: {
      bg: '#fbf7f1', surface: '#ffffff', surfaceAlt: '#f4ede3', ink: '#241236', muted: '#5e4f66',
      primary: '#241236', onPrimary: '#f7efe2', accent: '#b8955a', accentInk: '#7d5f2c', line: '#e4d9c8',
      heroBg: '#241236', heroInk: '#f7efe2', heroAccent: '#d9bf8c', heroMuted: '#cdbfd3', danger: '#a12d3a',
      radius: '0.25rem',
      fontDisplay: `'Cormorant Garamond', ${SERIF_FALLBACK}`, fontBody: `'Manrope', ${SANS_FALLBACK}`,
      displayWeight: '500', displayTracking: '0', kickerTracking: '0.22em',
    },
  },
  'temuvibe-minimal': {
    id: 'temuvibe-minimal',
    name: 'Temuvibe Minimal',
    tagline: 'Ivory and plum with room to breathe',
    description:
      'An airy, typographic invitation on warm ivory with plum type, hairline rules and wide margins that let every detail stand on its own.',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600&display=swap',
    hero: 'airy',
    tokens: {
      bg: '#fdfbf7', surface: '#ffffff', surfaceAlt: '#f6f2eb', ink: '#2a1f33', muted: '#675d6d',
      primary: '#241236', onPrimary: '#fdfbf7', accent: '#b9a37a', accentInk: '#6f5b34', line: '#e9e3da',
      heroBg: '#fdfbf7', heroInk: '#241236', heroAccent: '#6f5b34', heroMuted: '#675d6d', danger: '#a12d3a',
      radius: '0',
      fontDisplay: `'Manrope', ${SANS_FALLBACK}`, fontBody: `'Manrope', ${SANS_FALLBACK}`,
      displayWeight: '300', displayTracking: '-0.02em', kickerTracking: '0.28em',
    },
  },
  'temuvibe-festive': {
    id: 'temuvibe-festive',
    name: 'Temuvibe Festive',
    tagline: 'Berry, marigold and a joyful rhythm',
    description:
      'A warm celebration design with berry and marigold tones, soft rounded cards and a lively, tasteful opening for birthdays, family days and community events.',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=DM+Sans:wght@400;500;600&display=swap',
    hero: 'festive',
    tokens: {
      bg: '#fff8f1', surface: '#ffffff', surfaceAlt: '#fcede2', ink: '#2b1630', muted: '#66505d',
      primary: '#8e2f5a', onPrimary: '#fff8f1', accent: '#e3a33b', accentInk: '#8f520b', line: '#f0dccd',
      heroBg: '#5e1f45', heroInk: '#fff8f1', heroAccent: '#f6c76b', heroMuted: '#f0d6e0', danger: '#a12d3a',
      radius: '1.25rem',
      fontDisplay: `'Fraunces', ${SERIF_FALLBACK}`, fontBody: `'DM Sans', ${SANS_FALLBACK}`,
      displayWeight: '600', displayTracking: '-0.01em', kickerTracking: '0.16em',
    },
  },
  'temuvibe-corporate': {
    id: 'temuvibe-corporate',
    name: 'Temuvibe Corporate',
    tagline: 'Clean, confident and agenda-first',
    description:
      'A crisp sans-serif event page with the organisation’s logo up front, a clear run-of-show and speaker cards, for company events, seminars, workshops and gatherings.',
    fontsHref: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    hero: 'brand',
    tokens: {
      bg: '#f6f7f9', surface: '#ffffff', surfaceAlt: '#eceff4', ink: '#161a2b', muted: '#4f566a',
      primary: '#1f2a44', onPrimary: '#ffffff', accent: '#b8955a', accentInk: '#7a5c28', line: '#dde1e8',
      heroBg: '#1f2a44', heroInk: '#ffffff', heroAccent: '#d9bf8c', heroMuted: '#c9cfdc', danger: '#a12d3a',
      radius: '0.5rem',
      fontDisplay: `'Inter', ${SANS_FALLBACK}`, fontBody: `'Inter', ${SANS_FALLBACK}`,
      displayWeight: '700', displayTracking: '-0.025em', kickerTracking: '0.14em',
    },
  },
}

export function isTemuvibePresetId(id: unknown): id is TemuvibePresetId {
  return typeof id === 'string' && (TEMUVIBE_PRESET_IDS as readonly string[]).includes(id)
}

export function temuvibePreset(id: unknown): TemuvibePreset {
  return TEMUVIBE_PRESETS[isTemuvibePresetId(id) ? id : DEFAULT_TEMUVIBE_PRESET]
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** `{ '--tv-bg': '#…', … }` for the renderer root. */
export function tokenStyle(tokens: TemuvibeTokens): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).map(([k, v]) => [`--tv-${kebab(k)}`, v]))
}

/** First family name of a CSS font stack ("'Cormorant Garamond', Georgia" → "Cormorant Garamond"). */
export function primaryFont(stack: string): string {
  return stack.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '')
}
