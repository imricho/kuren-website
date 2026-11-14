import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const minimalistTheme: RenderableTemplate = {
  id: 'still-form',
  familyId: 'modern-minimalist',
  collectionId: 'quiet-form',
  name: 'Still Form',
  status: 'available',
  slug: 'still-form',
  tagline: 'Warm restraint, made personal',
  description:
    'A precise, sans-led wedding design with a quiet date rail, soft paper tones and a deliberate photographic frame.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap',
  },
  component: () => import('./MinimalistTheme.vue'),
}
