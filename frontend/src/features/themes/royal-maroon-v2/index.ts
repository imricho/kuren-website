import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const royalMaroonV2Theme: RenderableTemplate = {
  id: 'royal-maroon-v2',
  slug: 'royal-maroon-v2',
  name: 'Royal Maroon v2',
  familyId: 'traditional',
  collectionId: 'ceremonial-classic',
  status: 'available',
  tagline: 'The Maroon Conservatory',
  description: 'An ornate botanical invitation in oxblood, antique gold and parchment, with a personal crest, botanical portrait frames and an engraved story trail.',
  previewImage: thumbnail,
  fonts: { href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap' },
  component: () => import('./RoyalMaroonV2Theme.vue'),
  config: { variant: 'royal-maroon-v2' },
}
