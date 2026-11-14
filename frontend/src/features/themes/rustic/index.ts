import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const rusticTheme: RenderableTemplate = {
  id: 'wildwood-gathering',
  familyId: 'rustic-nature',
  collectionId: 'field-notes',
  name: 'Field Notes',
  status: 'available',
  slug: 'field-notes',
  tagline: 'A garden celebration, gathered with care',
  description:
    'A nature-led invitation with forest-green panels, botanical details, layered photography and a warm paper palette.',
  previewImage: thumbnail,
  config: { variant: 'field-notes' },
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap',
  },
  component: () => import('./RusticTheme.vue'),
}
