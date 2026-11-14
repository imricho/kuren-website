import type { Component } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

export const THEME_CATEGORIES = ['international', 'traditional', 'ethnic', 'conventional', 'artistic'] as const
export type ThemeCategory = (typeof THEME_CATEGORIES)[number]

/** Props every theme component receives. Themes consume ONLY the shared content model. */
export interface ThemeProps {
  content: WeddingContent
}

export interface ThemeDefinition {
  /** Stable identifier, stored with a wedding (e.g. "international"). */
  id: string
  name: string
  category: ThemeCategory
  /** One-line summary for theme cards. */
  tagline: string
  description: string
  /** Static thumbnail URL for selection cards. */
  previewImage: string
  /** Web fonts the theme needs; loaded only when the theme is shown. */
  fonts?: { href: string }
  /** Lazily imported root component, so each theme is its own bundle chunk. */
  component: () => Promise<Component | { default: Component }>
}
