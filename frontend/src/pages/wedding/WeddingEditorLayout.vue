<script setup lang="ts">
/**
 * Live split-screen website editor (docs/ux/live-editor.md).
 *
 *  ≥1024px  [ editor panel | divider | live preview ]  (full height, studio layout)
 *  <1024px  sticky Edit / Preview tabs; both panes stay mounted (v-show)
 *
 * The editor panel holds the save status, "x of N done", the section chips and
 * the current section's page (child route). The preview renders the live
 * content with the selected theme and follows the current section. Both stay
 * mounted while child routes change. Loads the wedding first; /wedding
 * redirects to the first incomplete section.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { useMediaQuery } from '@/composables/useMediaQuery'
import ConflictBanner from '@/features/cms/components/ConflictBanner.vue'
import SaveStatus from '@/features/cms/components/SaveStatus.vue'
import SectionNav from '@/features/cms/components/SectionNav.vue'
import EditorDivider from '@/features/cms/preview/EditorDivider.vue'
import { clampWidth, editorWidthBounds, useEditorWidth } from '@/features/cms/preview/editorWidth'
import MobileEditorTabs, { type EditorTab } from '@/features/cms/preview/MobileEditorTabs.vue'
import PreviewPanel from '@/features/cms/preview/PreviewPanel.vue'
import { useElementSize } from '@/features/cms/preview/useElementSize'
import { sectionByKey } from '@/features/cms/sections'
import { SECTION_KEYS } from '@/features/wedding/completeness'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const route = useRoute()
const router = useRouter()
const { t } = useAppLocale()

onMounted(() => void store.ensureLoaded())

/** First incomplete required section edited here (theme lives in the studio), else Opening. */
function firstSectionRoute() {
  const key =
    SECTION_KEYS.find((k) => k !== 'theme' && store.completeness.sections[k].required && store.completeness.sections[k].status !== 'complete') ??
    'opening'
  return { name: sectionByKey(key).routeName }
}

watch(
  () => [store.loadState, route.name] as const,
  ([state, name]) => {
    if (state === 'ready' && name === 'wedding') void router.replace(firstSectionRoute())
  },
  { immediate: true },
)

// --- Split (desktop) ----------------------------------------------------------------
const isDesktop = useMediaQuery('(min-width: 1024px)')
const grid = ref<HTMLElement | null>(null)
const { width: gridWidth } = useElementSize(grid)
const bounds = computed(() => editorWidthBounds(gridWidth.value))
const editorWidth = useEditorWidth()
const effectiveWidth = computed(() => clampWidth(editorWidth.value, bounds.value))

/** The editor panel scrolls on its own on desktop, so start each section at its top. */
const editorBody = ref<HTMLElement | null>(null)
watch(
  () => route.name,
  () => {
    if (isDesktop.value && editorBody.value) editorBody.value.scrollTop = 0
  },
)

// --- Tabs (mobile) ------------------------------------------------------------------
const tab = ref<EditorTab>('edit')
const ids = {
  edit: { tab: 'editor-tab-edit', panel: 'editor-panel' },
  preview: { tab: 'editor-tab-preview', panel: 'preview-panel' },
} as const
const showEditor = computed(() => isDesktop.value || tab.value === 'edit')
const showPreview = computed(() => isDesktop.value || tab.value === 'preview')

function panelAttrs(key: EditorTab) {
  return isDesktop.value
    ? { 'aria-label': t(key === 'edit' ? 'editorPanelLabel' : 'livePreview') }
    : { role: 'tabpanel', 'aria-labelledby': ids[key].tab }
}

/** Each tab keeps its own page scroll position. */
const tabScroll: Record<EditorTab, number> = { edit: 0, preview: 0 }
watch(tab, async (next, previous) => {
  if (isDesktop.value || typeof window === 'undefined') return
  tabScroll[previous] = window.scrollY
  await nextTick()
  window.scrollTo({ top: tabScroll[next], left: 0, behavior: 'auto' })
})
</script>

<template>
  <div
    v-if="store.loadState === 'ready'"
    ref="grid"
    :class="isDesktop ? 'grid h-full grid-cols-[var(--editor-w)_0.5rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]' : 'min-w-0'"
    :style="isDesktop ? { '--editor-w': `${effectiveWidth}%` } : undefined"
    :data-mode="isDesktop ? 'split' : 'tabs'"
    data-testid="editor-layout"
  >
    <MobileEditorTabs v-if="!isDesktop" v-model="tab" :ids="ids">
      <SaveStatus />
    </MobileEditorTabs>
    <!-- On phones the banner sits outside both tab panels, so it is visible on Edit and Preview. -->
    <ConflictBanner v-if="!isDesktop" />

    <section
      v-show="showEditor"
      id="editor-panel"
      v-bind="panelAttrs('edit')"
      :class="isDesktop ? 'flex min-h-0 min-w-0 flex-col border-r border-line bg-canvas' : 'min-w-0'"
      data-testid="editor-panel"
    >
      <div class="shrink-0 border-b border-line bg-surface px-4">
        <div class="flex items-center gap-3" :class="isDesktop ? 'h-12' : 'pt-3'">
          <div v-if="isDesktop" class="mr-auto min-w-0"><SaveStatus /></div>
          <p class="text-xs text-ink-500" data-testid="sections-done">
            {{ t('sectionsDone', { done: store.completeness.done, total: store.completeness.total }) }}
          </p>
        </div>
        <SectionNav />
      </div>
      <ConflictBanner v-if="isDesktop" />
      <div
        ref="editorBody"
        :class="isDesktop ? 'min-h-0 flex-1 overflow-y-auto px-6 py-6' : 'px-4 py-6'"
        data-testid="editor-body"
      >
        <div class="max-w-xl">
          <RouterView />
        </div>
      </div>
    </section>

    <EditorDivider v-if="isDesktop" v-model="editorWidth" :bounds="bounds" controls="editor-panel" />

    <section
      v-show="showPreview"
      id="preview-panel"
      v-bind="panelAttrs('preview')"
      class="min-w-0 lg:min-h-0"
      data-testid="preview-panel"
    >
      <!-- On phones the Edit tab (with the section h1) is hidden while previewing. -->
      <h1 v-if="!isDesktop && showPreview && !showEditor" class="sr-only">{{ t('livePreview') }}</h1>
      <PreviewPanel :compact="!isDesktop" :visible="showPreview" />
    </section>
  </div>

  <div v-else-if="store.loadState === 'error' || store.loadState === 'none'" class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <h1 class="text-3xl font-semibold">{{ t('myWebsite') }}</h1>
    <div role="alert" class="mt-6 max-w-xl rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
      <p class="font-medium">{{ t('loadFailed') }}</p>
      <p v-if="store.loadError" class="mt-1">{{ store.loadError }}</p>
      <BaseButton class="mt-4 min-h-11 sm:min-h-0" variant="secondary" data-action="retry" @click="store.reload()">
        {{ t('tryAgain') }}
      </BaseButton>
    </div>
  </div>

  <div v-else class="lg:grid lg:h-full lg:grid-cols-[40%_0.5rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
    <div class="space-y-4 px-4 py-6" role="status" aria-live="polite" data-testid="editor-loading">
      <span class="sr-only">{{ t('loadingWebsite') }}</span>
      <div class="flex gap-2 overflow-hidden" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="h-9 w-24 shrink-0 animate-pulse rounded-full bg-rose-50 motion-reduce:animate-none" />
      </div>
      <div class="h-8 w-2/3 animate-pulse rounded-md bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
      <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
      <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
    </div>
    <div class="hidden border-l border-line lg:col-start-3 lg:block lg:bg-rose-50/40 lg:p-6" aria-hidden="true">
      <div class="mx-auto h-full max-w-[390px] animate-pulse rounded-[1.25rem] bg-rose-50 motion-reduce:animate-none" />
    </div>
  </div>
</template>
