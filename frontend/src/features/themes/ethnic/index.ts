import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const ethnicTheme: RenderableTemplate = {
  id: 'ethnic',
  familyId: 'traditional',
  collectionId: 'artisan-pattern',
  name: 'Woven Indigo',
  status: 'available',
  slug: 'woven-indigo',
  tagline: 'Textile-inspired, warm and distinctive',
  description:
    'An original geometric design in indigo, terracotta and ochre, with tactile pattern and confident modern type. The artwork is abstract and is not attributed to a named textile or community.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Marcellus&family=Mulish:wght@400;500;600&display=swap',
  },
  component: () => import('./EthnicTheme.vue'),
}
