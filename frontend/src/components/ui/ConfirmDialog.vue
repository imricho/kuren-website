<script setup lang="ts">
/**
 * Accessible confirmation built on the native <dialog> (showModal gives a focus
 * trap, Escape to cancel and an inert background). Focus returns to whatever
 * was focused before it opened.
 */
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmLabel: string
    cancelLabel: string
    tone?: 'danger' | 'default'
  }>(),
  { tone: 'default', message: undefined },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
const id = useId()
let returnFocus: HTMLElement | null = null

function show() {
  const el = dialog.value
  if (!el || el.open) return
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (typeof el.showModal === 'function') el.showModal()
  else el.setAttribute('open', '') // jsdom / very old browsers
  nextTick(() => cancelButton.value?.focus())
}

function hide() {
  const el = dialog.value
  if (el?.open || el?.hasAttribute('open')) {
    if (typeof el.close === 'function') el.close()
    else el.removeAttribute('open')
  }
  const target = returnFocus
  returnFocus = null
  if (target?.isConnected) nextTick(() => target.focus())
}

watch(
  () => props.open,
  (open) => (open ? nextTick(show) : hide()),
  { immediate: true, flush: 'post' },
)
onBeforeUnmount(hide)

function onCancel(event: Event) {
  // Escape key: let the parent decide (it will set open=false).
  event.preventDefault()
  emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink-900 shadow-[var(--shadow-soft)] backdrop:bg-ink-900/40"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="message ? `${id}-msg` : undefined"
    data-testid="confirm-dialog"
    @cancel="onCancel"
  >
    <div class="p-6">
      <h2 :id="`${id}-title`" class="text-2xl font-semibold">{{ title }}</h2>
      <p v-if="message" :id="`${id}-msg`" class="mt-2 text-sm text-ink-500">{{ message }}</p>
      <slot />
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          ref="cancelButton"
          type="button"
          class="min-h-11 rounded-lg border border-ink-500/85 bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-rose-50 sm:min-h-0"
          data-action="cancel"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:min-h-0"
          :class="tone === 'danger' ? 'bg-danger-600 hover:bg-danger-600/90' : 'bg-rose-600 hover:bg-rose-700'"
          data-action="confirm"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>
