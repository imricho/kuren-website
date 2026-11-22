/**
 * Template manifests (docs/architecture/invitation-engine.md §5) for every selectable
 * template:
 *  - the 49 pre-engine themes: GENERATED tokens (catalog/legacyManifests.generated.ts,
 *    extracted from their stylesheets), the legacy compatibility rule and the 13 wedding sections;
 *  - the 4 Temuvibe presets: hand-written from their design tokens (temuvibe/presets.ts).
 * Compatibility always comes from the invitation registry, so the manifests, the wizard
 * and the backend can never disagree.
 */
import {
  LEGACY_TEMPLATE_COMPATIBILITY,
  SECTION_ORDER,
  TEMPLATES as COMPATIBLE_TEMPLATES,
  isTemplateCompatible,
  type SectionId,
  type VariantId,
} from '@/features/invitation/registry'

import { LEGACY_THEME_TOKENS } from '../catalog/legacyManifests.generated'
import { TEMUVIBE_PRESETS, isTemuvibePresetId, primaryFont } from '../temuvibe/presets'
import { THEMES } from './registry'
import type { RenderableTemplate, TemplateManifest } from './types'

/** The 13 sections the pre-engine (wedding) themes render, in canonical order. */
export const LEGACY_TEMPLATE_SECTIONS: readonly SectionId[] = [
  'opening', 'holyRecite1', 'greeting', 'couple', 'countdown', 'events', 'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing',
]

function legacyManifest(t: RenderableTemplate): TemplateManifest {
  const tokens = LEGACY_THEME_TOKENS[t.id]
  if (!tokens) throw new Error(`[themes] no generated manifest tokens for "${t.id}"; regenerate legacyManifests.generated.ts`)
  return {
    id: t.id,
    name: t.name,
    family: t.familyId,
    categories: LEGACY_TEMPLATE_COMPATIBILITY.categories,
    variants: LEGACY_TEMPLATE_COMPATIBILITY.variants,
    sections: LEGACY_TEMPLATE_SECTIONS,
    theme: { colors: { ...tokens.colors }, typography: { ...tokens.typography } },
    // Every legacy theme renders without a cover and shows the gallery when it has images.
    media: { cover: 'optional', gallery: true },
  }
}

function temuvibeManifest(t: RenderableTemplate): TemplateManifest {
  if (!isTemuvibePresetId(t.id)) throw new Error(`[themes] unknown Temuvibe preset "${t.id}"`)
  const compat = COMPATIBLE_TEMPLATES.find((c) => c.id === t.id)
  if (!compat) throw new Error(`[themes] "${t.id}" is missing from the invitation registry TEMPLATES`)
  const k = TEMUVIBE_PRESETS[t.id].tokens
  return {
    id: t.id,
    name: t.name,
    family: t.familyId,
    categories: compat.categories,
    ...(compat.variants ? { variants: compat.variants } : {}),
    sections: SECTION_ORDER,
    theme: {
      colors: {
        background: k.bg, surface: k.surface, text: k.ink, muted: k.muted, primary: k.primary, accent: k.accent,
        surfaceAlt: k.surfaceAlt, onPrimary: k.onPrimary, accentInk: k.accentInk, line: k.line,
        heroBackground: k.heroBg, heroText: k.heroInk, heroAccent: k.heroAccent,
      },
      typography: { display: primaryFont(k.fontDisplay), body: primaryFont(k.fontBody) },
    },
    media: { cover: 'optional', gallery: true },
  }
}

export const TEMPLATE_MANIFESTS: readonly TemplateManifest[] = Object.freeze(
  THEMES.map((t) => (t.familyId === 'temuvibe' ? temuvibeManifest(t) : legacyManifest(t))),
)

const BY_ID = new Map(TEMPLATE_MANIFESTS.map((m) => [m.id, m]))

export function templateManifest(id: string | null | undefined): TemplateManifest | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** Selectable templates that support a variant (wizard / theme studio filter). */
export function manifestsForVariant(variant: VariantId): TemplateManifest[] {
  return TEMPLATE_MANIFESTS.filter((m) => isTemplateCompatible(m.id, variant))
}
