import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const ethnicTheme: RenderableTemplate = {
  id: 'ethnic',
  familyId: 'traditional',
  collectionId: 'nusantara-heritage',
  name: 'Woven Indigo',
  status: 'available',
  aliases: ['woven-indigo'],
  tagline: 'Textile-inspired, warm and distinctive',
  description:
    'A modern take on woven-textile patterns in indigo, terracotta and ochre. Motifs are a modular set, so regional variations can be introduced without changing the layout.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Marcellus&family=Mulish:wght@400;500;600&display=swap',
  },
  component: () => import('./EthnicTheme.vue'),
}
