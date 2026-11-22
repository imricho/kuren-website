<script setup lang="ts">
/**
 * Renders wedding content with the selected theme.
 *
 *   content + themeId ──► registry ──► theme component ──► wedding site
 *
 * Unknown theme ids fall back to the default theme (guests should always see
 * a working page) and emit `fallback` so editors can be told.
 *
 * Invitation variants (docs/architecture/invitation-engine.md §5): a template that is
 * not compatible with the invitation's variant (e.g. a wedding-only theme stored on a
 * seminar) renders with `temuvibe-elegant` instead — never a crash — with a dev
 * warning and a `fallback` event. Without an explicit `variant`, content whose offered
 * sections (`content.sections`) have no couple is treated as non-wedding.
 */
import { computed, defineAsyncComponent, h, watch, type Component } from 'vue'

import { isTemplateCompatible, type VariantId } from '@/features/invitation/registry'
import type { WeddingContent } from '@/features/wedding/types'

import { provideThemeEmbedded } from './composables/useHeroHeading'
import { provideRenderContext, sanitizeGuestName, type RenderMode } from './composables/useRenderMode'
import { useThemeFonts } from './composables/useThemeFonts'
import { DEFAULT_THEME_ID, getTheme, TEMUVIBE_FALLBACK_ID, TEMUVIBE_FAMILY_ID } from './registry'
import type { RenderableTemplate } from './types'
import './theme-base.css'

const props = withDefaults(
  defineProps<{
    content: WeddingContent
    themeId: string | null | undefined
    /**
     * Height of one "screen" for full-height sections. The published page
     * uses the real viewport; framed previews pass the frame height.
     */
    viewportHeight?: string
    /** Rendered inside another page (studio/editor) that owns the page's h1. */
    embedded?: boolean
    /**
     * `draft` (default): editor/preview — editor-only notes may show, interactive
     * features are inert. `public`: the published invitation for guests.
     */
    mode?: RenderMode
    /** Guest name for the opening greeting (public page, from `?to=`); sanitised again here. */
    guestName?: string
    /** The invitation's variant: drives template compatibility and variant-aware wording. */
    variant?: VariantId
    /** Published slug (public page only): turns on the live RSVP form of Temuvibe templates. */
    slug?: string
    /** Invitation time zone (IANA), for the RSVP deadline. */
    timezone?: string
  }>(),
  { viewportHeight: '100svh', embedded: false, mode: 'draft', guestName: undefined, variant: undefined, slug: undefined, timezone: undefined },
)

provideThemeEmbedded(props.embedded)
provideRenderContext({
  mode: () => props.mode,
  guestName: () => (props.mode === 'public' ? sanitizeGuestName(props.guestName) : undefined),
  variant: () => props.variant,
  slug: () => (props.mode === 'public' ? props.slug : undefined),
  timezone: () => props.timezone,
  themeId: () => theme.value.id,
})

const emit = defineEmits<{ fallback: [requestedId: string | null | undefined] }>()

/** Whether a template can render this invitation (explicit variant, else the offered sections). */
function fits(template: RenderableTemplate): boolean {
  if (props.variant) return isTemplateCompatible(template.id, props.variant)
  const offered = props.content.sections
  // Pre-engine themes always render a couple; content without one needs a schema-driven template.
  return !offered || offered.includes('couple') || template.familyId === TEMUVIBE_FAMILY_ID
}

const resolved = computed<{ theme: RenderableTemplate; reason?: 'unknown' | 'incompatible' }>(() => {
  const requested = getTheme(props.themeId)
  if (requested && fits(requested)) return { theme: requested }
  const fallbackDefault = getTheme(DEFAULT_THEME_ID)!
  const fallback = fits(fallbackDefault) ? fallbackDefault : getTheme(TEMUVIBE_FALLBACK_ID)!
  return { theme: fallback, reason: requested ? 'incompatible' : 'unknown' }
})
const theme = computed<RenderableTemplate>(() => resolved.value.theme)

watch(
  () => [props.themeId, resolved.value.reason, resolved.value.theme.id] as const,
  ([id, reason, used], previous) => {
    if (!reason || (previous && previous[0] === id && previous[1] === reason && previous[2] === used)) return
    if (reason === 'unknown') console.warn(`[themes] Unknown theme "${id}"; falling back to "${used}".`)
    else if (import.meta.env.DEV) console.warn(`[themes] Theme "${id}" does not support variant "${props.variant ?? 'non-wedding'}"; falling back to "${used}".`)
    emit('fallback', id)
  },
  { immediate: true },
)

const LoadingState: Component = { name: 'ThemeLoading', render: () => h('div', { class: 'wedding-site__loading', 'aria-busy': 'true' }) }
const ErrorState: Component = {
  name: 'ThemeLoadError',
  render: () => h('div', { class: 'wedding-site__error', role: 'alert' }, 'This design could not be loaded. Please refresh the page.'),
}

// One async wrapper per theme, created once and reused.
const componentCache = new Map<string, Component>()
const themeComponent = computed(() => {
  const def = theme.value
  let cached = componentCache.get(def.id)
  if (!cached) {
    cached = defineAsyncComponent({
      loader: def.component as () => Promise<Component>,
      loadingComponent: LoadingState,
      errorComponent: ErrorState,
      delay: 120,
    })
    componentCache.set(def.id, cached)
  }
  return cached
})

useThemeFonts(() => theme.value.fonts?.href)
</script>

<template>
  <div class="wedding-site" :data-theme="theme.id" :data-render-mode="mode" :style="{ '--site-vh': viewportHeight }">
    <component :is="themeComponent" :content="content" :config="theme.config" />
  </div>
</template>
