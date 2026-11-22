/**
 * The Temuvibe family: ONE schema-driven renderer (TemuvibeTheme.vue) and four presets
 * that differ only by design tokens (presets.ts). Compatible categories come from the
 * invitation registry (`TEMPLATES` in features/invitation/registry).
 */
import type { RenderableTemplate } from '../core/types'
import corporateThumb from './assets/corporate.svg'
import elegantThumb from './assets/elegant.svg'
import festiveThumb from './assets/festive.svg'
import minimalThumb from './assets/minimal.svg'
import { TEMUVIBE_PRESET_IDS, TEMUVIBE_PRESETS, type TemuvibePresetId } from './presets'

export const TEMUVIBE_FAMILY_ID = 'temuvibe'
export const TEMUVIBE_COLLECTION_ID = 'temuvibe-signature'

const thumbnails: Record<TemuvibePresetId, string> = {
  'temuvibe-elegant': elegantThumb,
  'temuvibe-minimal': minimalThumb,
  'temuvibe-festive': festiveThumb,
  'temuvibe-corporate': corporateThumb,
}

const component: RenderableTemplate['component'] = () => import('./TemuvibeTheme.vue')

export const TEMUVIBE_TEMPLATES: readonly RenderableTemplate[] = TEMUVIBE_PRESET_IDS.map((id) => {
  const preset = TEMUVIBE_PRESETS[id]
  return {
    id,
    slug: id,
    familyId: TEMUVIBE_FAMILY_ID,
    collectionId: TEMUVIBE_COLLECTION_ID,
    name: preset.name,
    status: 'available',
    tagline: preset.tagline,
    description: preset.description,
    previewImage: thumbnails[id],
    fonts: { href: preset.fontsHref },
    config: { variant: id },
    component,
  }
})
