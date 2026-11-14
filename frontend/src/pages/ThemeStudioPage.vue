<script setup lang="ts">
/**
 * Theme studio: sidebar (left) to browse Family → Collection → Template, live
 * preview (right). One page serves /themes, /themes/:family,
 * /themes/:family/:collection and /themes/:family/:collection/:template, so the URL
 * always reflects where the user is and what is being previewed.
 *
 * Below the desktop breakpoint the sidebar becomes a collapsible selector above
 * the preview.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  DEFAULT_THEME_ID,
  THEMES,
  getCollection,
  previewableTemplatesOf,
  getFamily,
  getTheme,
  templatePath,
} from '@/features/themes/core/registry'
import type { RenderableTemplate } from '@/features/themes/core/types'
import PreviewPane from '@/features/themes/picker/PreviewPane.vue'
import ThemeSidebar from '@/features/themes/picker/ThemeSidebar.vue'
import { useThemeSelectionStore } from '@/stores/themeSelection'

const props = defineProps<{ familyId?: string; collectionId?: string; templateSlug?: string }>()
const route = useRoute()
const selection = useThemeSelectionStore()

// --- Where the user is (route params are canonical; see picker/guards.ts) ----------
const family = computed(() => getFamily(props.familyId))
const collection = computed(() => {
  const c = getCollection(props.collectionId)
  return c && c.familyId === family.value?.id ? c : undefined
})
const notFound = computed(
  () => (props.familyId !== undefined && !family.value) || (props.collectionId !== undefined && !collection.value),
)

// --- What is previewed --------------------------------------------------------------
const routeTemplate = computed(() => (props.templateSlug ? getTheme(props.templateSlug) : undefined))
// Templates the preview should come from at the current level: the collection's, else the family's.
const scopeTemplates = computed<RenderableTemplate[]>(() => {
  if (collection.value) return previewableTemplatesOf(collection.value.id)
  if (family.value) return THEMES.filter((t) => t.familyId === family.value!.id)
  return [...THEMES]
})

// Preview the URL's template; otherwise keep the last previewed or the selected template when it
// belongs to the current family/collection; otherwise its first template. If the level has nothing
// to preview, keep showing the last template (with a notice).
const previewed = computed<RenderableTemplate>(() => {
  if (routeTemplate.value) return routeTemplate.value
  const inScope = (id: string | null) => scopeTemplates.value.find((t) => t.id === id)
  if (scopeTemplates.value.length) {
    return inScope(selection.previewedThemeId) ?? inScope(selection.selectedThemeId) ?? inScope(DEFAULT_THEME_ID) ?? scopeTemplates.value[0]!
  }
  return getTheme(selection.previewedThemeId) ?? getTheme(selection.selectedThemeId) ?? getTheme(DEFAULT_THEME_ID)!
})
watch(previewed, (t) => selection.preview(t.id), { immediate: true })

const notice = computed(() => {
  const missing = route.query.notFound
  if (typeof missing === 'string') return `Template "${missing}" doesn't exist — showing ${previewed.value.name} instead.`
  if (previewed.value.status === 'draft') return 'This draft is preview-only and cannot be selected yet.'
  const scope = collection.value ?? family.value
  if (scope && scopeTemplates.value.length === 0) {
    const p = templatePath(previewed.value.id)!
    return `${scope.name} has no templates to preview yet. Still showing ${p.template.name} from ${p.family.name} › ${p.collection.name}.`
  }
  return null
})

// --- Narrow screens: collapsible selector above the preview ------------------------------
const isDesktop = ref(true)
let mq: MediaQueryList | undefined
const syncMq = () => (isDesktop.value = mq?.matches ?? true)
onMounted(() => {
  mq = window.matchMedia?.('(min-width: 1024px)')
  syncMq()
  mq?.addEventListener('change', syncMq)
})
onBeforeUnmount(() => mq?.removeEventListener('change', syncMq))

const selectorOpen = ref(!props.templateSlug)
const previewEl = ref<HTMLElement | null>(null)
const location = computed(() => [family.value?.name, collection.value?.name].filter(Boolean).join(' › ') || 'All families')

// After choosing a template on a narrow screen, collapse the selector and bring the preview into view.
watch(
  () => props.templateSlug,
  async (slug) => {
    if (!slug || isDesktop.value) return
    selectorOpen.value = false
    await nextTick()
    previewEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    previewEl.value?.querySelector<HTMLElement>('#preview-heading')?.focus({ preventScroll: true })
  },
)
</script>

<template>
  <div v-if="notFound" class="mx-auto max-w-6xl space-y-4 px-4 py-16 text-center">
    <h1 class="text-3xl font-semibold">{{ props.collectionId && family ? 'Collection not found' : 'Theme family not found' }}</h1>
    <RouterLink :to="{ name: 'themes' }" class="text-sm font-medium text-rose-600 hover:text-rose-700">← All families</RouterLink>
  </div>

  <div v-else class="lg:grid lg:h-full lg:grid-cols-[22rem_minmax(0,1fr)]" data-testid="theme-studio">
    <h1 class="sr-only">Choose your wedding theme</h1>

    <!-- Sidebar (left on desktop; collapsible selector on narrow screens) -->
    <aside class="border-line bg-canvas lg:h-full lg:overflow-y-auto lg:border-r" aria-label="Theme browser">
      <div class="px-4 pt-4 lg:hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left"
          :aria-expanded="selectorOpen"
          aria-controls="theme-sidebar"
          data-testid="selector-toggle"
          @click="selectorOpen = !selectorOpen"
        >
          <span class="min-w-0">
            <span class="block text-xs font-medium tracking-wide text-rose-600 uppercase">Browse themes</span>
            <span class="block truncate text-sm font-medium text-ink-900">{{ location }}</span>
          </span>
          <span class="shrink-0 text-sm text-ink-500" aria-hidden="true">{{ selectorOpen ? 'Hide ▲' : 'Show ▼' }}</span>
        </button>
      </div>
      <div v-show="selectorOpen || isDesktop" id="theme-sidebar" class="px-4 py-5 lg:px-5 lg:py-6">
        <ThemeSidebar :family="family" :collection="collection" :previewed-id="previewed.id" />
      </div>
    </aside>

    <!-- Live preview (right) -->
    <div ref="previewEl" class="scroll-mt-28 px-4 pt-2 pb-8 lg:h-full lg:min-h-0 lg:px-6 lg:py-6">
      <PreviewPane :template="previewed" :notice="notice" />
    </div>
  </div>
</template>
