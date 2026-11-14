import type { ThemeCollection } from '../core/types'

/** Collections describe visual styles without claiming a specific cultural origin. */
export const COLLECTIONS: readonly ThemeCollection[] = [
  {
    id: 'ceremonial-classic',
    familyId: 'traditional',
    name: 'Ceremonial Classic',
    description: 'Formal framing, balanced layouts, rich color and refined display typography.',
    reference: { kind: 'design', notes: 'An original formal design direction with symmetrical composition and decorative borders.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'artisan-pattern',
    familyId: 'traditional',
    name: 'Artisan Pattern',
    description: 'Original geometric ornament, tactile texture and an expressive color story.',
    reference: { kind: 'design', notes: 'Contemporary abstract pattern work; not attributed to a named textile or community.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'editorial',
    familyId: 'international',
    name: 'Editorial',
    description: 'Magazine-inspired layouts with refined serif typography, generous space and full-bleed photography.',
    reference: { kind: 'design', notes: 'Contemporary editorial and luxury print design.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'romantic-floral',
    familyId: 'classic',
    name: 'Romantic Floral',
    description: 'Soft pastels, botanical illustration and elegant script — the classic printed invitation.',
    reference: { kind: 'design', notes: 'Classic stationery and botanical illustration.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'contemporary',
    familyId: 'artistic',
    name: 'Contemporary',
    description: 'Gallery-like compositions with oversized type, collage imagery and a single vivid accent.',
    reference: { kind: 'design', notes: 'Contemporary graphic design and art-book layouts.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'quiet-form',
    familyId: 'modern-minimalist',
    name: 'Quiet Form',
    description: 'A warm, sans-led composition with precise spacing, quiet contrast and confident typography.',
    reference: { kind: 'design', notes: 'An original modern design direction focused on grid, alignment, contrast and generous breathing room.', review: 'not_required' },
    status: 'available',
  },
  {
    id: 'field-notes',
    familyId: 'rustic-nature',
    name: 'Field Notes',
    description: 'A garden-led invitation with forest greens, botanical linework and tactile paper tones.',
    reference: { kind: 'design', notes: 'Original nature-inspired artwork and layout; no named place, community or cultural motif is represented.', review: 'not_required' },
    status: 'available',
  },
]
