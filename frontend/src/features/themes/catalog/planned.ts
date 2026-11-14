import type { PlannedTemplate } from '../core/types'

/**
 * Planned templates (no renderer yet). They show the roadmap in the picker
 * and become available once implemented and culturally reviewed.
 */
export const PLANNED_TEMPLATES: readonly PlannedTemplate[] = [
  {
    id: 'yogyakarta-paes-ageng',
    familyId: 'traditional',
    collectionId: 'javanese',
    name: 'Yogyakarta Paes Ageng',
    tagline: 'Inspired by the Yogyakarta court bridal style',
    description: 'A planned design drawing on the Yogyakarta Paes Ageng bridal tradition.',
    regionalVariation: 'Yogyakarta',
    status: 'coming_soon',
  },
  {
    id: 'solo-basahan',
    familyId: 'traditional',
    collectionId: 'javanese',
    name: 'Solo Basahan',
    tagline: 'Inspired by the Surakarta court bridal style',
    description: 'A planned design drawing on the Surakarta (Solo) Basahan bridal tradition.',
    regionalVariation: 'Surakarta (Solo)',
    status: 'coming_soon',
  },
  {
    id: 'batak-toba',
    familyId: 'traditional',
    collectionId: 'batak',
    name: 'Batak Toba',
    tagline: 'Inspired by Batak Toba wedding traditions',
    description: 'A planned design drawing on Batak Toba wedding customs and textiles.',
    regionalVariation: 'Toba',
    status: 'coming_soon',
  },
]
