<script setup lang="ts">
/**
 * Live preview panel of the website editor (docs/ux/live-editor.md §1–3, §6):
 * toolbar, optional "no theme" note, and the scaled frame rendering
 * `store.livePreviewContent` with the selected theme (default theme if none).
 *
 * Stays mounted while the editor's child routes change, so the theme renders
 * once and later edits only patch it.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import { DEFAULT_THEME_ID, getTheme } from '@/features/themes/core/registry'
import { useWeddingStore } from '@/stores/wedding'

import { sectionByRouteName } from '../sections'
import { STAGE_GUTTER, type PreviewDevice, type PreviewZoom } from './frameBox'
import PreviewFrame from './PreviewFrame.vue'
import PreviewToolbar from './PreviewToolbar.vue'

const props = withDefaults(defineProps<{ compact?: boolean; visible?: boolean; toolbarTarget?: string }>(), { compact: false, visible: true })

const store = useWeddingStore()
const route = useRoute()
const { t } = useAppLocale()

const chosenDevice = ref<PreviewDevice>('desktop')
const zoom = ref<PreviewZoom>('fit')
/** Mobile preview is always phone width. */
const device = computed<PreviewDevice>({
  get: () => (props.compact ? 'phone' : chosenDevice.value),
  set: (d) => (chosenDevice.value = d),
})

const hasTheme = computed(() => getTheme(store.themeId) !== undefined)
const themeId = computed(() => (hasTheme.value ? store.themeId! : DEFAULT_THEME_ID))
watch(themeId, () => { chosenDevice.value = 'desktop' })
const themeName = computed(() => getTheme(themeId.value)?.name ?? '')
const section = computed(() => {
  const key = sectionByRouteName(route.name)?.key
  return key && key !== 'theme' ? key : null
})
const fullScreenTo = computed(() => ({ name: 'wedding-preview', query: { from: route.fullPath } }))

const frame = ref<InstanceType<typeof PreviewFrame> | null>(null)
defineExpose({ frame })
</script>

<template>
  <div class="flex min-w-0 flex-col bg-rose-50/40 lg:h-full lg:min-h-0" data-testid="live-preview" :data-theme-id="themeId">
    <Teleport defer :to="toolbarTarget ?? 'body'" :disabled="!toolbarTarget || compact">
      <PreviewToolbar
        v-model:device="device"
        v-model:zoom="zoom"
        :theme-name="themeName"
        :full-screen-to="fullScreenTo"
        :compact="compact"
      />
    </Teleport>
    <p
      v-if="store.loadState === 'ready' && !hasTheme"
      role="note"
      class="shrink-0 border-b border-amber-700/20 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      data-testid="preview-no-theme"
    >
      {{ t('previewNoTheme', { name: themeName }) }}
      <RouterLink :to="{ name: 'themes' }" class="font-medium underline underline-offset-2">{{ t('previewChooseTheme') }}</RouterLink>
    </p>
    <PreviewFrame
      ref="frame"
      :class="compact ? 'h-[calc(100dvh-10rem)] min-h-80' : 'flex-1'"
      :content="store.livePreviewContent"
      :theme-id="themeId"
      :device="device"
      :zoom="zoom"
      :gutter="compact ? STAGE_GUTTER.compact : STAGE_GUTTER.desktop"
      :section="section"
      :visible="visible"
    />
  </div>
</template>
