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

// --- Cultural briefs (regional collections) ----------------------------------------
//
// A brief keeps three things visibly apart:
//   1. SOURCED cultural information  → `sources`, `confirmed` (only with a verified source)
//   2. OPEN research questions       → `toResearch` (candidate references, NOT verified)
//   3. CREATIVE art direction        → `artDirection` (design choices, never cultural claims)
// plus the review state. Nothing in `toResearch` or `artDirection` may be presented as fact.

export type CulturalReviewStatus = 'in_development' | 'awaiting_review' | 'reviewed'

export interface SourceReference {
  title: string
  url: string
  publisher: string
  /** What the source actually documents (and its geographic/community scope). */
  covers: string
  /** True only once the Kuren team has read it and confirmed it supports the cited items. */
  verified: boolean
  /** Link problems found when checking (e.g. expired certificate, moved host), with the date checked. */
  accessNote?: string
}

export interface LocalityOption {
  id: string
  name: string
  status: ThemeStatus
}

export interface CulturalItems {
  garments: string[]
  textiles: string[]
  motifs: string[]
  objects: string[]
}

export interface ArtDirection {
  palette: { name: string; hex: string }[]
  typography: string
  composition: string
  imagery: string
  layout: string
}

export interface CulturalBrief {
  /** Whether a specific locality/subtradition must be chosen before any cultural motif is shown. */
  localityRequired: boolean
  /** How to call the choice in the UI, e.g. "subtradition", "locality", "island or community". */
  localityLabel: string
  localities: LocalityOption[]
  /** Caveat about the options, e.g. that the list is not exhaustive. */
  localitiesNote?: string
  selectedLocality: string | null
  review: {
    status: CulturalReviewStatus
    /** Named practitioners/organisations who reviewed it. Empty until a real review happens. */
    reviewers: string[]
    notes: string[]
  }
  sources: SourceReference[]
  /** References confirmed by a verified source (and later by review). Empty until then. */
  confirmed: CulturalItems
  /** Candidate references from the design brief — research questions, not facts. */
  toResearch: CulturalItems
  /** Things the collection must not do or depict. */
  avoid: string[]
  /** Creative choices for the eventual design. Not cultural claims. */
  artDirection: ArtDirection
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
  /** Required for cultural collections; see CulturalBrief. */
  brief?: CulturalBrief
  status: ThemeStatus
}

interface TemplateBase {
  /** Stable identifier stored with a wedding. Never rename once released. Not shown in URLs. */
  id: string
  /**
   * Public URL slug, derived from the display name (e.g. "blush-garden"). Picker URLs use the
   * slug so a template reads consistently with its family and collection. Defaults to `id`.
   */
  slug?: string
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
