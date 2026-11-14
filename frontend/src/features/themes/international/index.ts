import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const internationalTheme: RenderableTemplate = {
  id: 'international',
  familyId: 'international',
  collectionId: 'editorial',
  name: 'Editorial Ivory',
  status: 'available',
  aliases: ['editorial-ivory'],
  tagline: 'Modern, editorial and quietly luxurious',
  description:
    'A minimalist, magazine-inspired design with refined serif typography, generous white space and full-bleed photography in a soft neutral palette.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap',
  },
  component: () => import('./InternationalTheme.vue'),
}
