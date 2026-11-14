import type { Component } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

/**
 * Theme catalog hierarchy:
 *
 *   ThemeFamily      broad visual or cultural category      (e.g. Traditional)
 *   └ ThemeCollection specific design identity / culture    (e.g. Javanese)
 *     └ ThemeTemplate  the selectable wedding website design (e.g. Solo Basahan)
 *
 * Only templates are rendered. Every template — whatever its family — consumes
 * the one shared `WeddingContent` model.
 */

/**
 * - `available`: listed and selectable.
 * - `coming_soon`: listed as planned; not selectable (templates have no renderer yet).
 * - `hidden`: renderable by direct id/link (QA, staged rollout) but not listed.
 */
export type ThemeStatus = 'available' | 'coming_soon' | 'hidden'

/** Free-form, template-specific settings passed to the renderer (palette, motif set…). */
export type ThemeConfig = Readonly<Record<string, unknown>>

/** Props every theme component receives. Themes consume ONLY the shared content model. */
export interface ThemeProps {
  content: WeddingContent
  /** Optional template configuration, letting one renderer power several templates. */
  config?: ThemeConfig
}

export interface ThemeFamily {
  id: string
  /** Canonical display name, used everywhere in the app. */
  name: string
  /** Older ids/URL slugs that should resolve to this family (e.g. "conventional"). */
  aliases?: string[]
  tagline: string
  description: string
  coverImage?: string
  status: ThemeStatus
}

export interface ThemeReference {
  /** Whether the collection draws on a specific culture or on a design style. */
  kind: 'cultural' | 'design'
  /** Region or community, for cultural references. */
  region?: string
  /** Guidance for designers: what this covers, sub-traditions to distinguish, sensitivities. */
  notes: string
  /**
   * Cultural review gate. Cultural templates must be reviewed by people from or
   * knowledgeable about the tradition before they become available.
   */
  review: 'not_required' | 'needs_review' | 'reviewed'
}

export interface ThemeCollection {
  id: string
  familyId: string
  name: string
  /** Common alternative name, e.g. "Melayu" for Malay. Shown alongside the name. */
  alsoKnownAs?: string
  description: string
  coverImage?: string
  reference: ThemeReference
  status: ThemeStatus
}

interface TemplateBase {
  /** Stable identifier stored with a wedding. Never rename once released. */
  id: string
  familyId: string
  collectionId: string
  name: string
  /** Other slugs that resolve to this template (e.g. its display name as a slug). */
  aliases?: string[]
  tagline: string
  description: string
  /** e.g. "Yogyakarta" vs "Surakarta (Solo)" within the Javanese collection. */
  regionalVariation?: string
}

/** A template with a renderer (available, or hidden for QA). */
export interface RenderableTemplate extends TemplateBase {
  status: 'available' | 'hidden'
  /** Static thumbnail URL for selection cards. */
  previewImage: string
  /** Web fonts the theme needs; loaded only when the theme is shown. */
  fonts?: { href: string }
  /** Lazily imported root component, so each template is its own bundle chunk. */
  component: () => Promise<Component | { default: Component }>
  config?: ThemeConfig
}

/** A planned template: listed for the roadmap, not yet selectable or renderable. */
export interface PlannedTemplate extends TemplateBase {
  status: 'coming_soon'
  previewImage?: string
  component?: never
}

export type ThemeTemplate = RenderableTemplate | PlannedTemplate

/**
 * @deprecated Use `RenderableTemplate`. Kept so Workstream 2 code keeps compiling.
 */
export type ThemeDefinition = RenderableTemplate

export function isRenderable(template: ThemeTemplate): template is RenderableTemplate {
  return template.status !== 'coming_soon' && typeof template.component === 'function'
}
