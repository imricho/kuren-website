import type { RenderableTemplate, ThemeFamily } from '../core/types'

import artisticThumb from '../artistic/assets/thumbnail.svg'
import classicThumb from '../conventional/assets/thumbnail.svg'
import internationalThumb from '../international/assets/thumbnail.svg'
import minimalistThumb from '../minimalist/assets/thumbnail.svg'
import rusticThumb from '../rustic/assets/thumbnail.svg'
import traditionalThumb from '../traditional/assets/thumbnail.svg'

type FamilyId = ThemeFamily['id'] &
  ('traditional' | 'international' | 'classic' | 'artistic' | 'modern-minimalist' | 'rustic-nature')
type Variant = Omit<Pick<RenderableTemplate, 'id' | 'collectionId' | 'name' | 'tagline' | 'description'>, 'id'> & {
  id: string
  familyId: FamilyId
}

const photos: Record<FamilyId, string> = {
  traditional: traditionalThumb,
  international: internationalThumb,
  classic: classicThumb,
  artistic: artisticThumb,
  'modern-minimalist': minimalistThumb,
  'rustic-nature': rusticThumb,
}

const fonts: Record<FamilyId, string> = {
  traditional: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap',
  international: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Jost:wght@300;400;500&display=swap',
  classic: 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lora:ital,wght@0,400;0,500;1,400&display=swap',
  artistic: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300;1,9..144,500&family=Space+Grotesk:wght@400;500&display=swap',
  'modern-minimalist': 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap',
  'rustic-nature': 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap',
}

const renderers: Record<FamilyId, RenderableTemplate['component']> = {
  traditional: () => import('../traditional/TraditionalTheme.vue'),
  international: () => import('../international/InternationalTheme.vue'),
  classic: () => import('../conventional/ConventionalTheme.vue'),
  artistic: () => import('../artistic/ArtisticTheme.vue'),
  'modern-minimalist': () => import('../minimalist/MinimalistTheme.vue'),
  'rustic-nature': () => import('../rustic/RusticTheme.vue'),
}

const variants: Variant[] = [
  { id: 'ivory-processional', familyId: 'traditional', collectionId: 'ceremonial-classic', name: 'Ivory Processional', tagline: 'Ceremonial calm in ivory and antique gold', description: 'A vertical invitation with an ivory ground, antique-gold rules and a deliberate procession from names to date.' },
  { id: 'terracotta-geometry', familyId: 'traditional', collectionId: 'artisan-pattern', name: 'Terracotta Geometry', tagline: 'Warm clay, sand and original geometric forms', description: 'A contemporary ceremony design that pairs clay color fields with original repeating geometry and clear modern type.' },
  { id: 'gilded-vow', familyId: 'traditional', collectionId: 'formal-signatures', name: 'Gilded Vow', tagline: 'Charcoal, antique gold and high-contrast type', description: 'A formal dark invitation with luminous gold rules, a strong serif hierarchy and restrained ornament.' },
  { id: 'candlelit-hall', familyId: 'traditional', collectionId: 'formal-signatures', name: 'Candlelit Hall', tagline: 'Deep plum and candle-cream warmth', description: 'A narrow ceremonial text column, softly glowing plum surfaces and fine paper details create an intimate evening mood.' },
  { id: 'pressed-filigree', familyId: 'traditional', collectionId: 'abstract-heritage', name: 'Pressed Filigree', tagline: 'Pale stone, bronze lines and quiet symmetry', description: 'An airy invitation framed with original fine-line ornament and muted bronze on warm stone.' },
  { id: 'loomed-lines', familyId: 'traditional', collectionId: 'abstract-heritage', name: 'Loomed Lines', tagline: 'A woven-like grid in cream and jewel tones', description: 'Broad original grid marks and a single jewel accent make a tactile design without referencing a named textile or community.' },

  { id: 'the-monograph', familyId: 'international', collectionId: 'editorial', name: 'The Monograph', tagline: 'A long-form love story with generous margins', description: 'A black-and-bone editorial with one-column storytelling, fine image captions and a book-like reading rhythm.' },
  { id: 'coastal-issue', familyId: 'international', collectionId: 'coastal-journal', name: 'Coastal Issue', tagline: 'Sea-glass tones and open horizons', description: 'Wide landscape photography, pale blue-gray surfaces and airy modern serif type create a relaxed coastal editorial.' },
  { id: 'the-sunday-edit', familyId: 'international', collectionId: 'coastal-journal', name: 'The Sunday Edit', tagline: 'Warm beige, olive and candid lifestyle images', description: 'A softer magazine rhythm with quiet olive accents, relaxed spacing and natural candid photography.' },
  { id: 'city-journal', familyId: 'international', collectionId: 'city-editions', name: 'City Journal', tagline: 'A split-grid story with documentary character', description: 'Asymmetric image and text columns, charcoal captions and an urban journal sensibility.' },
  { id: 'gallery-no-08', familyId: 'international', collectionId: 'city-editions', name: 'Gallery No. 08', tagline: 'Oversized type, image blocks and discreet numbers', description: 'A crisp editorial grid uses large photography, oversized typography and carefully placed section numbering.' },
  { id: 'modern-heirloom', familyId: 'international', collectionId: 'after-hours', name: 'Modern Heirloom', tagline: 'Navy, cream and archival photo details', description: 'A portrait-led modern heirloom with a deep navy frame, classic serif and small archive-style captions.' },
  { id: 'afterglow', familyId: 'international', collectionId: 'after-hours', name: 'Afterglow', tagline: 'Dusk photography in espresso and champagne', description: 'A cinematic full-width hero and warm champagne typography set a refined evening tone.' },

  { id: 'rosewater', familyId: 'classic', collectionId: 'romantic-floral', name: 'Rosewater', tagline: 'Soft rose, cream and graceful script', description: 'A centered invitation with a fine floral border and a restrained script accent for the couple’s names.' },
  { id: 'lily-and-lace', familyId: 'classic', collectionId: 'botanical-classics', name: 'Lily & Lace', tagline: 'Pale sage and original lily linework', description: 'A white and sage botanical design with original lily drawings and delicate lace-like edge details.' },
  { id: 'the-conservatory', familyId: 'classic', collectionId: 'botanical-classics', name: 'The Conservatory', tagline: 'Greenhouse photography and fern-green details', description: 'Fern green, parchment and botanical labels frame generous greenhouse and garden photography.' },
  { id: 'pearl-keepsake', familyId: 'classic', collectionId: 'fine-keepsakes', name: 'Pearl Keepsake', tagline: 'Ivory, pearl-gray and fine metallic rules', description: 'A framed portrait and understated metallic lines bring a polished keepsake quality to a familiar invitation layout.' },
  { id: 'peony-season', familyId: 'classic', collectionId: 'fine-keepsakes', name: 'Peony Season', tagline: 'Warm pink, leaf green and expressive florals', description: 'A larger floral image balances an asymmetric invitation card in warm pink and leaf green.' },
  { id: 'bluebell-manor', familyId: 'classic', collectionId: 'estate-gardens', name: 'Bluebell Manor', tagline: 'Powder blue and cream in a formal layout', description: 'A centered classic layout with fine blue botanical drawings and gentle powder-blue framing.' },
  { id: 'garden-at-dusk', familyId: 'classic', collectionId: 'estate-gardens', name: 'Garden at Dusk', tagline: 'Mauve, deep green and evening garden imagery', description: 'An atmospheric garden photograph pairs with readable serif type and elegant mauve details.' },

  { id: 'cut-paper', familyId: 'artistic', collectionId: 'contemporary', name: 'Cut Paper', tagline: 'Layered coral and ultramarine paper shapes', description: 'A bold collage of layered paper-like fields and expressive block lettering, balanced by a clear event hierarchy.' },
  { id: 'color-study', familyId: 'artistic', collectionId: 'color-experiments', name: 'Color Study', tagline: 'Large color fields and a strong typographic grid', description: 'One dramatic portrait sits within vivid modular color blocks and a disciplined typographic grid.' },
  { id: 'chromatic-vows', familyId: 'artistic', collectionId: 'color-experiments', name: 'Chromatic Vows', tagline: 'Saturated red-orange accents and modular cards', description: 'A vivid color system and geometric modules keep the expressive composition energetic and legible.' },
  { id: 'afterimage', familyId: 'artistic', collectionId: 'photo-studies', name: 'Afterimage', tagline: 'Soft photographic overlays in violet and warm red', description: 'Blurred image layers and editorial sans-serif typography create a photographic, atmospheric design.' },
  { id: 'sunday-collage', familyId: 'artistic', collectionId: 'photo-studies', name: 'Sunday Collage', tagline: 'Taped-photo composition on warm paper', description: 'Candid photos, paper textures and a handwritten accent form a relaxed, art-directed collage.' },
  { id: 'the-exhibition', familyId: 'artistic', collectionId: 'gallery-editions', name: 'The Exhibition', tagline: 'Art-catalog pacing with numbered moments', description: 'Numbered sections, small captions and generous whitespace make a wedding feel like a thoughtful exhibition.' },
  { id: 'negative-space', familyId: 'artistic', collectionId: 'gallery-editions', name: 'Negative Space', tagline: 'A single dramatic portrait surrounded by space', description: 'A restrained art-book composition lets one striking portrait and condensed type carry the opening.' },

  { id: 'monogram', familyId: 'modern-minimalist', collectionId: 'quiet-form', name: 'Monogram', tagline: 'Initials, symmetry and near-black on cream', description: 'A symmetry-led opening centers a custom-feeling monogram between fine rules and a clear date rail.' },
  { id: 'soft-grid', familyId: 'modern-minimalist', collectionId: 'soft-essentials', name: 'Soft Grid', tagline: 'Pale stone, muted olive and modular sections', description: 'A gentle modular grid with soft image corners creates a calm and flexible editorial invitation.' },
  { id: 'paper-light', familyId: 'modern-minimalist', collectionId: 'soft-essentials', name: 'Paper Light', tagline: 'Bright white, delicate details and broad margins', description: 'Tiny typographic details, broad paper margins and a delicate date rail produce a quiet, bright design.' },
  { id: 'black-tie', familyId: 'modern-minimalist', collectionId: 'evening-minimal', name: 'Black Tie', tagline: 'A sharp split hero in black, white and brass', description: 'A formal split hero combines a dark panel, restrained brass accent and clean high-contrast type.' },
  { id: 'quiet-contrast', familyId: 'modern-minimalist', collectionId: 'evening-minimal', name: 'Quiet Contrast', tagline: 'Warm gray, one dark panel and a portrait crop', description: 'Stacked typographic hierarchy and one full-height portrait give this design a quiet dramatic edge.' },
  { id: 'outline', familyId: 'modern-minimalist', collectionId: 'fine-lines', name: 'Outline', tagline: 'Fine-line frames in taupe and chalk', description: 'A geometric monogram, thin framing and chalk-soft neutrals keep the page precise and understated.' },
  { id: 'atelier', familyId: 'modern-minimalist', collectionId: 'fine-lines', name: 'Atelier', tagline: 'A gallery grid with graphite captions', description: 'Gallery-like image crops and quiet graphite captioning give the invitation a studio-designed finish.' },

  { id: 'meadowlight', familyId: 'rustic-nature', collectionId: 'field-notes', name: 'Meadowlight', tagline: 'Wildflower meadows in oat and soft green', description: 'An airy serif invitation pairs meadow imagery with soft green details and warm oat paper.' },
  { id: 'olive-grove', familyId: 'rustic-nature', collectionId: 'garden-gatherings', name: 'Olive Grove', tagline: 'Olive, cream and sunlit tree photography', description: 'Sunlit tree imagery, an olive-and-cream palette and relaxed spacing create an elegant outdoor feel.' },
  { id: 'orchard-table', familyId: 'rustic-nature', collectionId: 'garden-gatherings', name: 'Orchard Table', tagline: 'Fruit, foliage and generous gathering cards', description: 'Botanical still-life imagery and generous event cards suggest a relaxed, abundant garden table.' },
  { id: 'coastal-pine', familyId: 'rustic-nature', collectionId: 'landscape-editions', name: 'Coastal Pine', tagline: 'Sea glass, evergreen and open horizon', description: 'Landscape photography and an open horizon pair sea-glass tones with deep evergreen.' },
  { id: 'golden-hour-garden', familyId: 'rustic-nature', collectionId: 'landscape-editions', name: 'Golden Hour Garden', tagline: 'Honey light, moss and intimate photography', description: 'Warm sunset photography, honey tones and moss-green details make a relaxed intimate invitation.' },
  { id: 'gathered-branch', familyId: 'rustic-nature', collectionId: 'botanical-paper', name: 'Gathered Branch', tagline: 'Original branch linework and a vertical story trail', description: 'Warm white and bark brown frame original branch illustrations and a clearly visible story trail.' },
  { id: 'wildflower-press', familyId: 'rustic-nature', collectionId: 'botanical-paper', name: 'Wildflower Press', tagline: 'Pressed-flower details on lavender parchment', description: 'Pressed-flower composition, pale lavender and tactile paper accents create a gentle botanical mood.' },
]

export const ADDITIONAL_TEMPLATES: readonly RenderableTemplate[] = variants.map((variant) => ({
  ...variant,
  status: 'available',
  slug: variant.id,
  previewImage: photos[variant.familyId],
  fonts: { href: fonts[variant.familyId] },
  component: renderers[variant.familyId],
  config: { variant: variant.id },
}))
