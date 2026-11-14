/**
 * Configuration for the regional draft renderer. Each regional draft template is
 * one config: its own palette, typography, composition, material texture and
 * section layouts. Textures are generic material treatments (linen, rib, sheen…),
 * never named textile patterns or cultural motifs.
 */
export interface RegionalDraftConfig {
  /** Always true: these designs await cultural review and render a draft notice. */
  draft: true
  /** e.g. "Javanese · Yogyakarta direction". Shown in the draft notice. */
  directionLabel: string
  palette: {
    bg: string
    surface: string
    ink: string
    muted: string
    accent: string
    accentSoft: string
    line: string
    heroBg: string
    heroInk: string
    texture: string
  }
  fonts: {
    display: string
    body: string
    displayWeight: number
    displayCase: 'none' | 'uppercase'
    tracking: string
  }
  hero: 'framed' | 'split' | 'bands' | 'arch' | 'side-portrait' | 'type'
  couple: 'pair' | 'cards' | 'overlap' | 'round'
  events: 'ledger' | 'timeline' | 'cards' | 'columns'
  gallery: 'grid' | 'mosaic' | 'strip' | 'masonry'
  texture: 'linen' | 'weave' | 'ribbed' | 'grain' | 'dots' | 'sheen'
  divider: 'rule' | 'double' | 'dots' | 'band' | 'sprig'
  corner: 'square' | 'soft' | 'round'
}

export function isRegionalDraftConfig(value: unknown): value is RegionalDraftConfig {
  return typeof value === 'object' && value !== null && (value as { draft?: unknown }).draft === true
}
