import artisticCover from '../artistic/assets/thumbnail.svg'
import classicCover from '../conventional/assets/thumbnail.svg'
import internationalCover from '../international/assets/thumbnail.svg'
import traditionalCover from '../traditional/assets/thumbnail.svg'
import type { ThemeFamily } from '../core/types'
import minimalistCover from './assets/modern-minimalist.svg'
import rusticCover from './assets/rustic-nature.svg'

/** Theme families, in display order. */
export const FAMILIES: readonly ThemeFamily[] = [
  {
    id: 'traditional',
    name: 'Traditional',
    tagline: 'Formal, ornate and timeless wedding styles',
    description:
      'Origin-neutral design styles, from formal ceremony framing to original abstract ornament.',
    coverImage: traditionalCover,
    status: 'available',
  },
  {
    id: 'international',
    name: 'International',
    tagline: 'Global, editorial and quietly luxurious',
    description: 'Magazine-inspired layouts with refined serif typography, generous space and full-bleed photography.',
    coverImage: internationalCover,
    status: 'available',
  },
  {
    id: 'classic',
    // Canonical display name. "Conventional" was the Workstream 2 term; its slug still resolves here.
    name: 'Conventional / Classic',
    aliases: ['conventional'],
    tagline: 'The timeless invitation feel',
    description: 'Romantic, familiar designs: florals, soft pastels, elegant script and arched photo frames.',
    coverImage: classicCover,
    status: 'available',
  },
  {
    id: 'artistic',
    name: 'Artistic',
    tagline: 'Expressive, contemporary and bold',
    description: 'Asymmetric compositions, oversized type and collage-style photography — expressive but readable.',
    coverImage: artisticCover,
    status: 'available',
  },
  {
    id: 'modern-minimalist',
    name: 'Modern Minimalist',
    tagline: 'Clean lines, quiet confidence',
    description:
      'Stark, geometric layouts with sans-serif typography and a restrained palette. (Distinct from International, which is serif-led and editorial.)',
    coverImage: minimalistCover,
    status: 'coming_soon',
  },
  {
    id: 'rustic-nature',
    name: 'Rustic / Nature',
    tagline: 'Organic textures and natural tones',
    description: 'Earthy palettes, botanical details and natural textures for garden, forest and beach weddings.',
    coverImage: rusticCover,
    status: 'coming_soon',
  },
]
