<script setup lang="ts">
/**
 * Renders wedding content with the selected theme.
 *
 *   content + themeId ──► registry ──► theme component ──► wedding site
 *
 * Unknown theme ids fall back to the default theme (guests should always see
 * a working page) and emit `fallback` so editors can be told.
 */
import { computed, defineAsyncComponent, h, watch, type Component } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import { useThemeFonts } from './composables/useThemeFonts'
import { DEFAULT_THEME_ID, getTheme } from './registry'
import type { ThemeDefinition } from './types'
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
  }>(),
  { viewportHeight: '100svh' },
)

const emit = defineEmits<{ fallback: [requestedId: string | null | undefined] }>()

const theme = computed<ThemeDefinition>(() => getTheme(props.themeId) ?? getTheme(DEFAULT_THEME_ID)!)

watch(
  () => props.themeId,
  (id) => {
    if (!getTheme(id)) {
      console.warn(`[themes] Unknown theme "${id}"; falling back to "${DEFAULT_THEME_ID}".`)
      emit('fallback', id)
    }
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
  <div class="wedding-site" :data-theme="theme.id" :style="{ '--site-vh': viewportHeight }">
    <component :is="themeComponent" :content="content" />
  </div>
</template>
