<script setup lang="ts">
import type { ThemeStatus } from '../core/types'
import { localizedStatus } from './format'

defineProps<{ status: ThemeStatus | 'selected' }>()

const STYLE = {
  available: 'bg-success-50 text-success-600',
  draft: 'bg-[#fbf1cf] text-[#5b4a12] ring-1 ring-[#ecd98f]',
  coming_soon: 'bg-canvas text-ink-500 ring-1 ring-line',
  hidden: 'bg-canvas text-ink-500',
  selected: 'bg-rose-600 text-white',
}
</script>

<template>
  <!-- "Available" is the normal state, so it gets no badge; only exceptions are labelled. -->
  <span
    v-if="status !== 'available'"
    class="inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" :class="STYLE[status]">
    <svg v-if="status === 'selected'" class="size-3" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {{ localizedStatus(status) }}
  </span>
</template>
