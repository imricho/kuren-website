import type { ThemeCollection, ThemeReference } from '../core/types'
import { REGIONAL_BRIEFS } from './regional-briefs'

const cultural = (region: string, notes: string): ThemeReference => ({
  kind: 'cultural',
  region,
  notes,
  review: 'needs_review',
})

/**
 * Collections, grouped by family, in display order.
 *
 * Regional Traditional collections are placeholders for future work: they are
 * `coming_soon` and flagged `needs_review`. Each covers diverse sub-traditions;
 * templates must name the specific tradition they draw on (see `notes`) rather
 * than presenting one style as representative of a whole culture.
 */
const BASE_COLLECTIONS: ThemeCollection[] = [
  // --- Traditional ------------------------------------------------------------
  {
    id: 'nusantara-heritage',
    familyId: 'traditional',
    name: 'Nusantara Heritage',
    description:
      'General, pan-Indonesian ceremonial designs that are not tied to a single culture — formal frames, warm earth and gold tones, original geometric ornament.',
    reference: {
      kind: 'design',
      notes:
        'Deliberately culturally neutral. Uses original geometric ornament only; no motifs specific to any one ethnic group.',
      review: 'not_required',
    },
    status: 'available',
  },
  {
    id: 'javanese',
    familyId: 'traditional',
    name: 'Javanese',
    description: 'Designs inspired by Javanese wedding traditions.',
    reference: cultural(
      'Central Java, Yogyakarta & East Java',
      'Each court tradition (e.g. Yogyakarta, Pakualaman, Surakarta, Mangkunegaran) has its own named bridal styles; record the exact style name from a source and name the specific tradition per template.',
    ),
    status: 'coming_soon',
  },
  {
    id: 'sundanese',
    familyId: 'traditional',
    name: 'Sundanese',
    description: 'Designs inspired by Sundanese wedding traditions.',
    reference: cultural('West Java & Banten', 'Includes distinct regional styles (e.g. Priangan); confirm details per template.'),
    status: 'coming_soon',
  },
  {
    id: 'minangkabau',
    familyId: 'traditional',
    name: 'Minangkabau',
    alsoKnownAs: 'Minang',
    description: 'Designs inspired by Minangkabau wedding traditions.',
    reference: cultural('West Sumatra', 'Attire and ornament vary between nagari (villages/regions); confirm the specific source.'),
    status: 'coming_soon',
  },
  {
    id: 'batak',
    familyId: 'traditional',
    name: 'Batak',
    description: 'Designs inspired by Batak wedding traditions.',
    reference: cultural(
      'Mainly North Sumatra (Pakpak and Karo areas extend into Aceh)',
      'Several peoples — Toba, Karo, Simalungun, Pakpak, Angkola, Mandailing — each with its own textile traditions and names. Some do not identify as Batak. Templates must specify which.',
    ),
    status: 'coming_soon',
  },
  {
    id: 'bugis',
    familyId: 'traditional',
    name: 'Bugis',
    description: 'Designs inspired by Bugis wedding traditions.',
    reference: cultural('South Sulawesi and Bugis communities elsewhere', 'Distinguish Bugis from neighbouring Makassar traditions; do not assign colour meanings unless sourced.'),
    status: 'coming_soon',
  },
  {
    id: 'betawi',
    familyId: 'traditional',
    name: 'Betawi',
    description: 'Designs inspired by Betawi wedding traditions.',
    reference: cultural('Jakarta, Bekasi, Depok, Tangerang, Bogor', 'A distinct culture with its own documented history; represent it on its own terms.'),
    status: 'coming_soon',
  },
  {
    id: 'malay',
    familyId: 'traditional',
    name: 'Malay',
    alsoKnownAs: 'Melayu',
    description: 'Designs inspired by Malay wedding traditions.',
    reference: cultural(
      'Riau, Riau Islands, coastal Sumatra & West Kalimantan',
      'Malay communities span many regions with differing customs; templates should state their regional source.',
    ),
    status: 'coming_soon',
  },
  {
    id: 'madura',
    familyId: 'traditional',
    name: 'Madura',
    description: 'Designs inspired by Madurese wedding traditions.',
    reference: cultural('Madura Island, East Java', 'Confirm attire, colours and ornament with cultural sources.'),
    status: 'coming_soon',
  },
  {
    id: 'balinese',
    familyId: 'traditional',
    name: 'Balinese',
    alsoKnownAs: 'Bali',
    description: 'Designs inspired by Balinese wedding traditions.',
    reference: cultural(
      'Bali',
      'Many Balinese motifs carry religious meaning; avoid sacred symbols used out of context and confirm with cultural reviewers.',
    ),
    status: 'coming_soon',
  },
  {
    id: 'dayak',
    familyId: 'traditional',
    name: 'Dayak',
    description: 'Designs inspired by Dayak wedding traditions.',
    reference: cultural(
      'Kalimantan',
      'Dayak is an umbrella term for many distinct peoples (e.g. Ngaju, Kenyah, Iban). Templates must specify the community and avoid generic "tribal" styling.',
    ),
    status: 'coming_soon',
  },
  {
    id: 'ambon-maluku',
    familyId: 'traditional',
    name: 'Ambon / Maluku',
    description: 'Designs inspired by Ambonese and Moluccan wedding traditions.',
    reference: cultural('Maluku and North Maluku provinces', 'Maluku spans many islands and communities; name the specific tradition per template.'),
    status: 'coming_soon',
  },
  {
    id: 'papuan',
    familyId: 'traditional',
    name: 'Papuan',
    alsoKnownAs: 'Papua',
    description: 'Designs inspired by Papuan wedding traditions.',
    reference: cultural(
      'Papua region (six provinces since 2022)',
      'Papua is home to hundreds of distinct peoples and languages. Templates must specify the community, be developed with community input, and avoid stereotyped imagery.',
    ),
    status: 'coming_soon',
  },

  // --- International ------------------------------------------------------------
  {
    id: 'editorial',
    familyId: 'international',
    name: 'Editorial',
    description: 'Fashion-magazine layouts: refined serif type, neutral tones and full-bleed photography.',
    reference: { kind: 'design', notes: 'Contemporary editorial / luxury print design.', review: 'not_required' },
    status: 'available',
  },

  // --- Classic ------------------------------------------------------------------
  {
    id: 'romantic-floral',
    familyId: 'classic',
    name: 'Romantic Floral',
    description: 'Soft pastels, botanical illustration and elegant script — the classic printed invitation.',
    reference: { kind: 'design', notes: 'Classic stationery and botanical illustration.', review: 'not_required' },
    status: 'available',
  },

  // --- Artistic -----------------------------------------------------------------
  {
    id: 'contemporary',
    familyId: 'artistic',
    name: 'Contemporary',
    description: 'Gallery-like compositions with oversized type, collage imagery and a single vivid accent.',
    reference: { kind: 'design', notes: 'Contemporary graphic design and art-book layouts.', review: 'not_required' },
    status: 'available',
  },
]

/** Collections with their cultural briefs attached (see catalog/regional-briefs.ts). */
export const COLLECTIONS: readonly ThemeCollection[] = BASE_COLLECTIONS.map((c) =>
  REGIONAL_BRIEFS[c.id] ? { ...c, brief: REGIONAL_BRIEFS[c.id] } : c,
)
