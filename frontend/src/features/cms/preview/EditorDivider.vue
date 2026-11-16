<script setup lang="ts">
/**
 * Resizable divider between the editor and the preview (docs/ux/live-editor.md §4).
 * A focusable ARIA separator: ←/→ ±2% (Shift ±10%), Home/End min/max, Enter or
 * double-click resets. Pointer drag uses pointer capture; text selection is
 * disabled on the page while dragging. No transitions (reduced motion safe).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'

import { clampWidth, EDITOR_WIDTH, type WidthBounds } from './editorWidth'

const props = defineProps<{ bounds: WidthBounds; controls: string }>()
const width = defineModel<number>({ required: true })
const { t } = useAppLocale()
const dragging = ref(false)
const el = ref<HTMLElement | null>(null)

const now = computed(() => Math.round(clampWidth(width.value, props.bounds)))
const set = (value: number) => (width.value = clampWidth(value, props.bounds))

function onKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 2
  const current = clampWidth(width.value, props.bounds)
  switch (e.key) {
    case 'ArrowLeft':
      set(current - step)
      break
    case 'ArrowRight':
      set(current + step)
      break
    case 'Home':
      set(props.bounds.min)
      break
    case 'End':
      set(props.bounds.max)
      break
    case 'Enter':
      set(EDITOR_WIDTH.default)
      break
    default:
      return
  }
  e.preventDefault()
}

let pointerId: number | null = null
function percentAt(clientX: number): number | null {
  const container = el.value?.parentElement
  if (!container) return null
  const rect = container.getBoundingClientRect()
  return rect.width > 0 ? ((clientX - rect.left) / rect.width) * 100 : null
}
// A click without dragging toggles between the narrowest and widest editor, so the
// divider also works with a single pointer action (WCAG 2.5.7).
let downX = 0
let moved = false
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  downX = e.clientX
  moved = false
  pointerId = e.pointerId
  el.value?.setPointerCapture?.(e.pointerId)
  dragging.value = true
  document.body.classList.add('select-none')
  e.preventDefault()
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  if (!moved && Math.abs(e.clientX - downX) < 4) return
  moved = true
  const p = percentAt(e.clientX)
  if (p !== null) set(p)
}
function endDrag() {
  if (!dragging.value) return
  if (pointerId !== null && el.value?.hasPointerCapture?.(pointerId)) el.value.releasePointerCapture(pointerId)
  pointerId = null
  dragging.value = false
  document.body.classList.remove('select-none')
}
function onPointerUp(e: PointerEvent) {
  const wasClick = dragging.value && !moved && e.pointerId === pointerId
  endDrag()
  if (wasClick) set(now.value >= EDITOR_WIDTH.default ? props.bounds.min : props.bounds.max)
}
onBeforeUnmount(endDrag)
</script>

<template>
  <div
    ref="el"
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    :aria-controls="controls"
    :aria-valuemin="Math.round(bounds.min)"
    :aria-valuemax="Math.round(bounds.max)"
    :aria-valuenow="now"
    :aria-valuetext="t('resizeEditorValue', { percent: now })"
    :aria-label="t('resizeEditor')"
    class="group relative flex w-2 cursor-col-resize touch-none justify-center outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-600"
    :data-dragging="dragging || undefined"
    data-testid="editor-divider"
    @keydown="onKeydown"
    @dblclick="set(EDITOR_WIDTH.default)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
  >
    <span
      class="h-full w-px bg-line group-hover:w-0.5 group-hover:bg-rose-500 group-focus-visible:w-0.5 group-focus-visible:bg-rose-500 group-data-[dragging]:w-0.5 group-data-[dragging]:bg-rose-500"
      aria-hidden="true"
    />
  </div>
</template>
