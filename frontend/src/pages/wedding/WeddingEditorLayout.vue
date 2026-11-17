<script setup lang="ts">
/**
 * Responsive invitation editor: at wide desktop sizes an outline, live preview,
 * and field panel share a single toolbar. Smaller desktops keep the resizable
 * two-pane editor; tablets and phones keep mounted Edit / Preview tab panels.
 * All modes use the same draft, autosave, conflict, and publishing workflows.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { focusMainHeading } from '@/composables/useRouteA11y'

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
import PublishAnnouncer from '@/features/cms/preview/PublishAnnouncer.vue'
import PublishChip from '@/features/cms/preview/PublishChip.vue'
import { useElementSize } from '@/features/cms/preview/useElementSize'
import { EDITOR_SECTIONS, sectionByKey, sectionByRouteName } from '@/features/cms/sections'
import { getTheme } from '@/features/themes/core/registry'
import { deriveCoupleNames } from '@/features/wedding/draft'
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
const isWide = useMediaQuery('(min-width: 1440px)')
const selectedTheme = computed(() => getTheme(store.themeId))
const invitationTitle = computed(() => {
  const draft = store.liveDraft ?? store.content
  return draft?.opening.coupleNames || (draft?.couple && deriveCoupleNames(draft.couple)) || t('myWebsite')
})
const invitationSections = EDITOR_SECTIONS.filter(s => s.key !== 'theme')
const activeSectionIndex = computed(() => Math.max(0, invitationSections.findIndex(s => s.routeName === route.name)))
const activeSection = computed(() => sectionByRouteName(route.name))
const grid = ref<HTMLElement | null>(null)
const { width: gridWidth } = useElementSize(grid)
const bounds = computed(() => {
  const normal = editorWidthBounds(gridWidth.value)
  if (!isWide.value || !(gridWidth.value > 0)) return normal
  // The wide outline is an additional column; reserve it before sizing either pane.
  const outline = Math.max(236, gridWidth.value * .2)
  const max = Math.min(normal.max, ((gridWidth.value - outline - 420 - 8) / gridWidth.value) * 100)
  return { min: normal.min, max: Math.max(normal.min, max) }
})
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
// --- Focus a field from a checklist link (/wedding/<section>#f-<field>) ------------------
/** Wait for the section page (and any item editor) to render, then focus the field once. */
async function focusHashField(hash: string) {
  const id = decodeURIComponent(hash.slice(1))
  if (!/^f-[A-Za-z0-9-]+$/.test(id)) return
  if (isDesktop.value === false) tab.value = 'edit'
  for (let i = 0; i < 20; i++) {
    await nextTick()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView?.({ block: 'center' })
      ;(el as HTMLElement).focus?.({ preventScroll: true })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  // The field never appeared (e.g. inside a collapsed item): don't leave focus on <body>.
  void focusMainHeading()
}
watch(
  () => [store.loadState, route.name, route.hash] as const,
  ([state, , hash]) => {
    if (state === 'ready' && hash) void focusHashField(hash)
  },
  { immediate: true },
)

</script>

<template>
<div v-if="store.loadState === 'ready'" ref="grid"
  :class="[isDesktop ? 'grid h-full grid-cols-[var(--editor-w)_0.5rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]' : 'min-w-0', isWide && 'cms-editor-wide']"
  :style="isDesktop ? { '--editor-w': `${effectiveWidth}%` } : undefined" :data-mode="isDesktop ? 'split' : 'tabs'"
  class="cms-editor-root" data-testid="editor-layout">
  <PublishAnnouncer />
  <header v-if="isWide" class="cms-editor-toolbar">
    <RouterLink :to="{ name: 'dashboard' }" class="cms-editor-back"><span
        aria-hidden="true">‹</span>{{ t('myWebsite') }}</RouterLink>
    <p class="cms-invitation-title">{{ invitationTitle }}</p>
    <div class="cms-toolbar-save">
      <SaveStatus />
    </div>
    <div id="cms-editor-preview-tools" class="cms-preview-tools"></div>
    <PublishChip />
  </header>
  <aside v-if="isWide" class="cms-editor-outline" data-testid="editor-outline" :aria-label="t('websiteSections')">
    <div class="cms-outline-card cms-selected-theme">
      <img v-if="selectedTheme?.previewImage" :src="selectedTheme.previewImage" alt="" />
      <div><strong>{{ selectedTheme?.name ?? t('chooseTheme') }}</strong>
        <p>{{ selectedTheme?.tagline }}</p>
        <RouterLink :to="{ name: 'themes' }">{{ t('previewThemeChange') }} <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>
    <div class="cms-outline-card cms-completeness">
      <div><span>{{ t('websiteSections') }}</span><strong>{{ store.completeness.percent }}<small>%</small></strong>
      </div>
      <progress :value="store.completeness.done" :max="store.completeness.total"
        :aria-label="t('requiredComplete', { done: store.completeness.done, total: store.completeness.total })"></progress>
      <p>{{ t('requiredComplete', { done: store.completeness.done, total: store.completeness.total }) }}</p>
    </div>
    <div class="cms-outline-card cms-section-card">
      <h2>{{ t('websiteSections') }}</h2>
      <SectionNav vertical />
    </div>
  </aside>
  <MobileEditorTabs v-if="!isDesktop" v-model="tab" :ids="ids">
    <div class="flex min-w-0 items-center gap-2">
      <SaveStatus />
      <PublishChip compact />
    </div>
  </MobileEditorTabs>
  <!-- On phones the banner sits outside both tab panels, so it is visible on Edit and Preview. -->
  <ConflictBanner v-if="!isDesktop" />

  <section v-show="showEditor" id="editor-panel" v-bind="panelAttrs('edit')"
    :class="isDesktop ? 'flex min-h-0 min-w-0 flex-col border-r border-line bg-canvas' : 'min-w-0'"
    data-testid="editor-panel">
    <div v-if="!isWide" class="shrink-0 border-b border-line bg-surface px-4">
      <div class="flex items-center gap-3" :class="isDesktop ? 'h-12' : 'pt-3'">
        <div v-if="isDesktop" class="mr-auto min-w-0">
          <SaveStatus />
        </div>
        <p class="text-xs text-ink-500" data-testid="sections-done">
          {{ t('sectionsDone', { done: store.completeness.done, total: store.completeness.total }) }}
        </p>
        <PublishChip v-if="isDesktop" />
      </div>
      <SectionNav />
    </div>
    <ConflictBanner v-if="isDesktop" />
    <div ref="editorBody" :class="isDesktop ? 'min-h-0 flex-1 overflow-y-auto px-6 py-6' : 'px-4 py-6'"
      data-testid="editor-body">
      <div class="max-w-xl">
        <RouterView />
      </div>
    </div>
  </section>

  <EditorDivider v-if="isDesktop" v-model="editorWidth" :bounds="bounds" controls="editor-panel" :reverse="isWide"
    class="cms-editor-divider" />

  <section v-show="showPreview" id="preview-panel" v-bind="panelAttrs('preview')" class="min-w-0 lg:min-h-0"
    data-testid="preview-panel">
    <!-- On phones the Edit tab (with the section h1) is hidden while previewing. -->
    <h1 v-if="!isDesktop && showPreview && !showEditor" class="sr-only">{{ t('livePreview') }}</h1>
    <PreviewPanel :compact="!isDesktop" :visible="showPreview"
      :toolbar-target="isWide ? '#cms-editor-preview-tools' : undefined" />
    <nav v-if="isWide && activeSection" class="cms-preview-pagination" :aria-label="t('websiteSections')">
      <RouterLink v-if="activeSectionIndex > 0" :to="invitationSections[activeSectionIndex - 1]!.to"
        :aria-label="t(invitationSections[activeSectionIndex - 1]!.label)">‹</RouterLink><span v-else
        class="cms-pagination-disabled" aria-hidden="true">‹</span>
      <span>{{ activeSectionIndex + 1 }} / {{ invitationSections.length }}</span><span
        class="cms-pagination-section">{{ activeSection ? t(activeSection.label) : t('sectionPublish') }}</span>
      <RouterLink v-if="activeSectionIndex < invitationSections.length - 1"
        :to="invitationSections[activeSectionIndex + 1]!.to"
        :aria-label="t(invitationSections[activeSectionIndex + 1]!.label)">›</RouterLink><span v-else
        class="cms-pagination-disabled" aria-hidden="true">›</span>
    </nav>
  </section>
</div>

<div v-else-if="store.loadState === 'error' || store.loadState === 'none'" class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
  <h1 class="text-3xl font-semibold">{{ t('myWebsite') }}</h1>
  <div role="alert"
    class="mt-6 max-w-xl rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
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
      <div v-for="n in 6" :key="n"
        class="h-9 w-24 shrink-0 animate-pulse rounded-full bg-rose-50 motion-reduce:animate-none" />
    </div>
    <div class="h-8 w-2/3 animate-pulse rounded-md bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
    <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none"
      aria-hidden="true" />
    <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none"
      aria-hidden="true" />
  </div>
  <div class="hidden border-l border-line lg:col-start-3 lg:block lg:bg-rose-50/40 lg:p-6" aria-hidden="true">
    <div class="mx-auto h-full max-w-[390px] animate-pulse rounded-[1.25rem] bg-rose-50 motion-reduce:animate-none" />
  </div>
</div>
</template>


<style scoped>
.cms-editor-root {
  color: #2f1936;
}

.cms-editor-wide {
  grid-template-columns: minmax(236px, 20%) minmax(0, 1fr) .5rem minmax(360px, var(--editor-w));
  grid-template-rows: 80px minmax(0, 1fr);
  background: #f0e7f4;
}

.cms-editor-toolbar {
  grid-column: 1 / -1;
  grid-row: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 24px;
  border-bottom: 1px solid #dccbe3;
  background: #f6eff9;
}

.cms-editor-back {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding-right: 22px;
  border-right: 1px solid #dfcfe4;
  white-space: nowrap;
}

.cms-editor-back span {
  font-size: 26px;
  line-height: 1;
}

.cms-invitation-title {
  min-width: 0;
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: Georgia, serif;
  font-size: 25px;
  letter-spacing: -.03em;
}

.cms-toolbar-save {
  min-width: 0;
  max-width: 185px;
  font-size: 12px;
}

.cms-preview-tools {
  min-width: 0;
  margin-left: auto;
}

.cms-editor-toolbar :deep([data-testid="save-status"]) {
  font-size: 12px;
}

.cms-editor-toolbar :deep([data-testid="preview-toolbar"]) {
  padding: 0;
  border: 0;
  background: transparent;
  gap: 12px;
}

.cms-editor-toolbar :deep([data-testid="preview-theme-name"]),
.cms-editor-toolbar :deep([data-testid="preview-theme-change"]) {
  display: none;
}

.cms-editor-toolbar :deep([data-testid="publish-chip-status"]) {
  display: none;
}

.cms-editor-toolbar :deep([data-action="open-publish"]) {
  min-height: 42px;
  padding: 0 22px;
  background: #dbb991;
  color: #29162e;
  box-shadow: 0 3px 8px #4b24581a;
}

.cms-editor-toolbar :deep([data-testid="preview-fullscreen"]) {
  min-height: 42px;
  border: 1px solid #b89bc5;
  padding: 0 14px;
  color: #4d285b;
}

.cms-editor-toolbar :deep([data-testid="preview-device"]),
.cms-editor-toolbar :deep([data-testid="preview-zoom"]) {
  border-color: #d9c6e0;
  border-radius: 10px;
  background: #ece0f1;
}

.cms-editor-toolbar :deep([data-testid="preview-device"] span),
.cms-editor-toolbar :deep([data-testid="preview-zoom"] span) {
  font-size: 12px;
  height: 34px;
  border-radius: 7px;
}

.cms-editor-toolbar :deep([data-testid="preview-device"] input:checked + span),
.cms-editor-toolbar :deep([data-testid="preview-zoom"] input:checked + span) {
  background: #643d70;
  color: #fff;
  box-shadow: none;
}

.cms-editor-outline {
  grid-column: 1;
  grid-row: 2;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 10px 20px 20px;
  scrollbar-width: thin;
}

.cms-outline-card {
  border: 1px solid #e0d1e7;
  border-radius: 14px;
  background: #faf6fc;
  box-shadow: 0 2px 4px #4b24580a;
  padding: 16px;
  margin-bottom: 8px;
}

.cms-selected-theme {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 12px;
}

.cms-selected-theme img {
  width: 74px;
  height: 62px;
  object-fit: cover;
  border-radius: 7px;
  border: 1px solid #e0d1e7;
}

.cms-selected-theme strong {
  font-size: 13px;
  line-height: 1.3;
}

.cms-selected-theme p {
  font-size: 11px;
  color: #705c79;
  margin: 3px 0 5px;
  line-height: 1.3;
}

.cms-selected-theme a {
  font-size: 12px;
  font-weight: 600;
  color: #683879;
}

.cms-completeness>div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.cms-completeness strong {
  font-size: 22px;
  color: #60336f;
}

.cms-completeness small {
  font-size: 14px;
}

.cms-completeness progress {
  appearance: none;
  height: 7px;
  width: 100%;
  border: 0;
  border-radius: 5px;
  display: block;
  margin: 10px 0 9px;
  overflow: hidden;
  background: #e7dbea;
}

.cms-completeness progress::-webkit-progress-bar {
  background: #e7dbea;
  border-radius: 5px;
}

.cms-completeness progress::-webkit-progress-value {
  background: #a279b6;
  border-radius: 5px;
}

.cms-completeness progress::-moz-progress-bar {
  background: #a279b6;
  border-radius: 5px;
}

.cms-completeness p {
  font-size: 11px;
  line-height: 1.5;
  color: #65506f;
}

.cms-section-card {
  padding: 14px 12px;
}

.cms-section-card h2 {
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  margin: 0 5px 8px;
}

.cms-editor-wide #editor-panel {
  grid-column: 4;
  grid-row: 2;
  border: 0;
  background: transparent;
  padding: 12px 12px 20px 0;
}

.cms-editor-wide [data-testid="editor-body"] {
  background: #faf6fc;
  border: 1px solid #e0d1e7;
  border-radius: 15px;
  box-shadow: 0 2px 4px #4b24580a;
  padding: 24px;
  scrollbar-width: thin;
}

.cms-editor-wide [data-testid="editor-body"]>div {
  max-width: none;
}

.cms-editor-wide #preview-panel {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px 0 12px 0;
}

.cms-editor-wide #preview-panel :deep([data-testid="live-preview"]) {
  flex: 1;
  min-height: 0;
  background: transparent;
}

.cms-editor-wide #preview-panel :deep([data-testid="preview-stage"]) {
  scrollbar-width: thin;
}

.cms-editor-wide .cms-editor-divider {
  grid-column: 3;
  grid-row: 2;
}

.cms-preview-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  flex-shrink: 0;
  min-height: 62px;
  padding: 6px;
  font-size: 12px;
}

.cms-preview-pagination a,
.cms-pagination-disabled {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d6c4df;
  border-radius: 50%;
  font-size: 25px;
  color: #5e376c;
}

.cms-pagination-disabled {
  opacity: .35;
}

.cms-pagination-section {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 1440px) and (max-width: 1550px) {
  .cms-editor-toolbar {
    gap: 10px;
    padding: 0 16px;
  }

  .cms-toolbar-save {
    max-width: 140px;
  }

  .cms-invitation-title {
    max-width: 160px;
    font-size: 22px;
  }

  .cms-editor-back {
    padding-right: 12px;
  }

  .cms-editor-toolbar :deep([data-testid="preview-device"] span),
  .cms-editor-toolbar :deep([data-testid="preview-zoom"] span) {
    padding: 0 9px;
  }
}
</style>
