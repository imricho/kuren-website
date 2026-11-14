import type { RenderableTemplate } from '../core/types'
import thumbnail from './assets/thumbnail.svg'

export const conventionalTheme: RenderableTemplate = {
  id: 'conventional',
  familyId: 'classic',
  collectionId: 'romantic-floral',
  name: 'Blush Garden',
  status: 'available',
  aliases: ['blush-garden'],
  tagline: 'Romantic florals in soft pastels',
  description:
    'The classic invitation feel: blush and sage pastels, hand-drawn-style florals, arched photo frames and an elegant script for your names.',
  previewImage: thumbnail,
  fonts: {
    href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lora:ital,wght@0,400;0,500;1,400&display=swap',
  },
  component: () => import('./ConventionalTheme.vue'),
}
