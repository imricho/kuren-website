/**
 * Extracts the real colour and typography tokens of the 49 pre-engine themes from
 * their stylesheets, for the generated manifests (`legacyManifests.generated.ts`).
 *
 * Pure (no file access): `legacyManifests.spec.ts` reads the CSS from disk, runs
 * `extractLegacyThemeTokens` and fails when the generated file is stale. Regenerate with
 *   UPDATE_MANIFESTS=1 npx vitest run src/features/themes/catalog/legacyManifests.spec.ts
 */
import type { ManifestColors } from '../core/types'

export type LegacyRendererKey = 'intl' | 'trad' | 'eth' | 'conv' | 'art' | 'minimal' | 'rustic' | 'rm2'

interface RoleSpec {
  /** CSS custom property (without `--`) or a literal value prefixed with `=`. */
  colors: Record<keyof Pick<ManifestColors, 'background' | 'surface' | 'text' | 'muted' | 'primary' | 'accent'>, string>
  display: string
  body: string
  script?: string
}

export interface LegacyRendererSpec extends RoleSpec {
  /** Stylesheet path relative to `features/themes/`. */
  file: string
  /** Root selector whose custom properties are the defaults. */
  root: string
}

export const LEGACY_RENDERERS: Readonly<Record<LegacyRendererKey, LegacyRendererSpec>> = {
  intl: { file: 'international/styles/theme.css', root: '.t-intl', colors: { background: 'bg', surface: 'bg-alt', text: 'ink', muted: 'muted', primary: 'ink', accent: 'accent' }, display: 'serif', body: 'sans' },
  trad: { file: 'traditional/styles/theme.css', root: '.t-trad', colors: { background: 'parchment', surface: 'parchment-deep', text: 'ink', muted: 'muted', primary: 'maroon', accent: 'gold' }, display: 'display', body: 'serif' },
  eth: { file: 'ethnic/styles/theme.css', root: '.t-eth', colors: { background: 'eth-cream', surface: 'eth-cream', text: 'ink', muted: 'muted', primary: 'eth-indigo', accent: 'eth-terracotta' }, display: 'display', body: 'sans' },
  conv: { file: 'conventional/styles/theme.css', root: '.t-conv', colors: { background: 'conv-cream', surface: 'conv-blush', text: 'ink', muted: 'muted', primary: 'conv-rose-deep', accent: 'conv-gold' }, display: 'serif', body: 'serif', script: 'script' },
  art: { file: 'artistic/styles/theme.css', root: '.t-art', colors: { background: 'paper', surface: 'paper-deep', text: 'ink', muted: 'muted', primary: 'ink', accent: 'accent' }, display: 'display', body: 'mono' },
  minimal: { file: 'minimalist/styles/theme.css', root: '.t-minimal', colors: { background: 'mf-paper', surface: 'mf-paper-deep', text: 'mf-ink', muted: 'mf-muted', primary: 'mf-ink', accent: 'mf-accent' }, display: 'mf-display', body: 'mf-body' },
  rustic: { file: 'rustic/styles/theme.css', root: '.t-rustic', colors: { background: 'rn-paper', surface: 'rn-oat', text: 'rn-ink', muted: 'rn-muted', primary: 'rn-forest', accent: 'rn-clay' }, display: 'rn-display', body: 'rn-body' },
  rm2: { file: 'royal-maroon-v2/theme.css', root: '.rm2', colors: { background: 'paper', surface: 'paper-deep', text: 'ink', muted: 'muted', primary: 'wine', accent: 'gold' }, display: 'display', body: "='EB Garamond', Georgia, serif" },
}

/** Base templates (own renderer modules) → renderer. */
const BASE_RENDERER: Readonly<Record<string, LegacyRendererKey>> = {
  international: 'intl', traditional: 'trad', ethnic: 'eth', conventional: 'conv', artistic: 'art',
  'still-form': 'minimal', 'wildwood-gathering': 'rustic', 'royal-maroon-v2': 'rm2',
}
/** Catalog variants (catalog/variants.ts) reuse their family renderer. */
const FAMILY_RENDERER: Readonly<Record<string, LegacyRendererKey>> = {
  traditional: 'trad', international: 'intl', classic: 'conv', artistic: 'art', 'modern-minimalist': 'minimal', 'rustic-nature': 'rustic',
}

export function legacyRendererOf(template: { id: string; familyId: string }): LegacyRendererKey | undefined {
  return BASE_RENDERER[template.id] ?? FAMILY_RENDERER[template.familyId]
}

export interface LegacyThemeTokens {
  colors: ManifestColors
  typography: { display: string; body: string; script?: string }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Custom properties declared in the first rule whose selector is exactly `selector`. */
function declarations(css: string, selector: string): Record<string, string> {
  const re = new RegExp(`(?:^|[}\\s])${escapeRe(selector)}\\s*\\{([^}]*)\\}`, 'm')
  const body = re.exec(css)?.[1] ?? ''
  const out: Record<string, string> = {}
  // Values may contain `;` inside quotes/urls only for data URIs, which we never need.
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);?/gi)) out[m[1]!] = m[2]!.trim()
  return out
}

function resolve(vars: Record<string, string>, ref: string): string {
  if (ref.startsWith('=')) return ref.slice(1)
  const value = vars[ref]
  if (value === undefined) throw new Error(`missing token --${ref}`)
  return value
}

const firstFamily = (stack: string) => stack.split(',')[0]!.trim().replace(/^['"]|['"]$/g, '')
const normalizeHex = (value: string) => {
  const v = value.trim().toLowerCase()
  return /^#[0-9a-f]{3}$/.test(v) ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v
}

/**
 * Tokens of one template: the renderer root's custom properties, overridden by its
 * `[data-variant='<variant>']` rule, plus `extraVars` (e.g. the ethnic motif palette).
 */
export function extractLegacyThemeTokens(
  css: string,
  spec: LegacyRendererSpec,
  variant: string | undefined,
  extraVars: Record<string, string> = {},
): LegacyThemeTokens {
  const vars = {
    ...extraVars,
    ...declarations(css, spec.root),
    ...(variant ? declarations(css, `${spec.root}[data-variant='${variant}']`) : {}),
  }
  const colors = Object.fromEntries(
    Object.entries(spec.colors).map(([role, ref]) => [role, normalizeHex(resolve(vars, ref))]),
  ) as ManifestColors
  return {
    colors,
    typography: {
      display: firstFamily(resolve(vars, spec.display)),
      body: firstFamily(resolve(vars, spec.body)),
      ...(spec.script ? { script: firstFamily(resolve(vars, spec.script)) } : {}),
    },
  }
}
