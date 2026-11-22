<script setup lang="ts">
/**
 * The scaled device frame of the live preview (docs/ux/live-editor.md §3, §6, §8).
 *
 *   stage (scrolls at 100%) ─► outer box (W·s × H) ─► scroller (W × H/s, scale(s)) ─► inert theme
 *
 * - The theme is laid out at the device's true width; container queries make it
 *   respond to the frame (`[container-type:size]`, full-height sections use 100cqh).
 * - ThemeRenderer stays mounted while content changes (no content key), so edits
 *   patch the existing DOM: images are not recreated and scroll is kept.
 * - The scroller is a focusable, labelled region; the invitation inside is
 *   `inert`, so Tab skips its links and RSVP fields.
 * - Render errors are caught here: a card with Try again; the editor keeps working.
 */
import { computed, nextTick, onErrorCaptured, ref, watch } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import type { VariantId } from '@/features/invitation/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import type { WeddingContent } from '@/features/wedding/types'

import { computeFrameBox, FRAME_WIDTH, type PreviewDevice, type PreviewZoom } from './frameBox'
import { useElementSize } from './useElementSize'
import { useSectionScroll } from './useSectionScroll'

const props = withDefaults(
  defineProps<{
    content: WeddingContent | null
    themeId: string
    device: PreviewDevice
    zoom: PreviewZoom
    /** Total stage padding (both sides). */
    gutter: number
    /** Editor section to keep in view (data-section key). */
    section?: string | null
    /** False while the panel is hidden (mobile Edit tab). */
    visible?: boolean
    /** The invitation's variant and time zone (variant-aware templates). */
    variant?: VariantId
    timezone?: string
  }>(),
  { section: null, visible: true, variant: undefined, timezone: undefined },
)

const { t } = useAppLocale()
const stage = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const { width: stageWidth, height: stageHeight, measure } = useElementSize(stage)

const box = computed(() =>
  computeFrameBox({
    stageWidth: stageWidth.value,
    stageHeight: stageHeight.value,
    frameWidth: FRAME_WIDTH[props.device],
    gutter: props.gutter,
    zoom: props.zoom,
  }),
)

const deviceLabel = computed(() => t(props.device === 'phone' ? 'previewDevicePhone' : 'previewDeviceDesktop'))
const frameLabel = computed(() => t('previewFrameLabel', { device: deviceLabel.value.toLowerCase() }))

// --- Error boundary -------------------------------------------------------------
const failed = ref(false)
/** Bumped by Try again to remount the theme (never on content changes). */
const attempt = ref(0)
onErrorCaptured((err) => {
  console.error('[preview] theme render failed', err)
  failed.value = true
  return false
})
function retry() {
  failed.value = false
  attempt.value++
}

// --- Section sync and scroll restore (hidden on mobile) -----------------------------
const sectionScroll = useSectionScroll({
  scroller,
  section: () => props.section,
  scale: () => box.value.scale,
  visible: () => props.visible,
})

let savedTop = 0
watch(
  () => props.visible,
  async (visible) => {
    if (!visible) {
      savedTop = scroller.value?.scrollTop ?? 0
      return
    }
    await nextTick()
    measure()
    await nextTick()
    // A section chosen while hidden wins; otherwise come back where the user left off.
    if (!sectionScroll.flush() && scroller.value) scroller.value.scrollTop = savedTop
  },
)

defineExpose({ scroller, box })
</script>

<template>
  <div
    ref="stage"
    class="min-h-0 overflow-auto"
    :style="{ padding: `${gutter / 2}px` }"
    data-testid="preview-stage"
    :data-scale="box.scale"
  >
    <div
      v-if="failed"
      role="alert"
      class="mx-auto max-w-sm rounded-[var(--radius-card)] border border-line bg-surface p-6 text-sm shadow-[var(--shadow-soft)]"
      data-testid="preview-error"
    >
      <p class="font-medium text-ink-900">{{ t('previewErrorTitle') }}</p>
      <p class="mt-1 text-ink-500">{{ t('previewErrorBody') }}</p>
      <button
        type="button"
        :class="['mt-4 inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 font-medium text-ink-900 hover:bg-rose-50', FOCUS_RING]"
        data-action="preview-retry"
        @click="retry"
      >
        {{ t('previewErrorRetry') }}
      </button>
    </div>

    <div
      v-else-if="!content"
      role="status"
      class="mx-auto animate-pulse rounded-[1.25rem] bg-rose-50 motion-reduce:animate-none"
      :style="{ width: `${box.outerWidth}px`, height: `${box.outerHeight}px` }"
      data-testid="preview-loading"
    >
      <span class="sr-only">{{ t('previewLoading') }}</span>
    </div>

    <div
      v-else
      class="mx-auto overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line has-[[data-preview-scroller]:focus-visible]:outline-2 has-[[data-preview-scroller]:focus-visible]:outline-offset-2 has-[[data-preview-scroller]:focus-visible]:outline-rose-600"
      :style="{ width: `${box.outerWidth}px`, height: `${box.outerHeight}px` }"
      data-testid="preview-frame-box"
    >
      <div
        ref="scroller"
        role="region"
        tabindex="0"
        :aria-label="frameLabel"
        aria-describedby="preview-visual-only"
        class="origin-top-left overflow-x-hidden overflow-y-auto overscroll-contain outline-none [container-type:size]"
        :style="{
          width: `${box.innerWidth}px`,
          height: `${box.innerHeight}px`,
          transform: box.scale === 1 ? undefined : `scale(${box.scale})`,
        }"
        :data-device="device"
        data-preview-scroller
        data-testid="preview-frame"
      >
        <p id="preview-visual-only" class="sr-only">{{ t('previewVisualOnly') }}</p>
        <div inert aria-hidden="true" data-testid="preview-content">
          <ThemeRenderer :key="attempt" :content="content" :theme-id="themeId" :variant="variant" :timezone="timezone" viewport-height="100cqh" embedded />
        </div>
      </div>
    </div>
  </div>
</template>
