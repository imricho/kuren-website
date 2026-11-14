import type { ThemeDefinition } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const artisticTheme: ThemeDefinition = {
  id: 'artistic',
  name: 'Artistic',
  category: 'artistic',
  tagline: 'Bold, editorial and expressive',
  description:
    'A contemporary, gallery-like design with oversized type, asymmetric compositions, collage-style photos and a single vivid accent — expressive, but always readable.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300;1,9..144,500&family=Space+Grotesk:wght@400;500&display=swap',
  },
  component: () => import('./ArtisticTheme.vue'),
}
