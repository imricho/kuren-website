<script setup lang="ts">
/**
 * Button. While `loading` (or `disabled`) it stays focusable and is exposed as
 * aria-disabled (+ aria-busy while loading), and activation is swallowed, so
 * focus never drops to <body> after a submit.
 */
import { computed } from 'vue'

import { FOCUS_RING } from './styles'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', type: 'button', loading: false, disabled: false, block: false },
)

const variants = {
  primary: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  secondary: 'bg-surface text-ink-900 border border-ink-500/85 hover:bg-rose-50',
  ghost: 'text-ink-700 hover:bg-rose-50 hover:text-ink-900',
} as const

const inactive = computed(() => props.loading || props.disabled)

function onClick(event: MouseEvent) {
  if (!inactive.value) return
  // Block form submission and any listener the parent attached.
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <button
    :type="type"
    :aria-disabled="inactive || undefined"
    :aria-busy="loading || undefined"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors motion-reduce:transition-none',
      FOCUS_RING,
      variants[variant],
      loading ? 'cursor-progress' : disabled ? 'cursor-not-allowed opacity-60' : '',
      block && 'w-full',
    ]"
    @click.capture="onClick"
  >
    <svg v-if="loading" class="size-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-testid="spinner">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <slot />
  </button>
</template>
