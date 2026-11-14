import type { ThemeDefinition } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const traditionalTheme: ThemeDefinition = {
  id: 'traditional',
  name: 'Traditional',
  category: 'traditional',
  tagline: 'Formal, ceremonial and timeless',
  description:
    'A classic, symmetrical design with deep maroon and antique-gold accents, framed panels and original ornamental borders. Kept culturally neutral so regional variations can be added later.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap',
  },
  component: () => import('./TraditionalTheme.vue'),
}
