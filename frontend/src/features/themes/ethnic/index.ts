import type { ThemeDefinition } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const ethnicTheme: ThemeDefinition = {
  id: 'ethnic',
  name: 'Ethnic',
  category: 'ethnic',
  tagline: 'Textile-inspired, warm and distinctive',
  description:
    'A modern take on woven-textile patterns in indigo, terracotta and ochre. Motifs are a modular set, so regional variations can be introduced without changing the layout.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Marcellus&family=Mulish:wght@400;500;600&display=swap',
  },
  component: () => import('./EthnicTheme.vue'),
}
