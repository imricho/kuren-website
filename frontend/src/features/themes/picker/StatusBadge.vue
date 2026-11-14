<script setup lang="ts">
import type { ThemeStatus } from '../core/types'

defineProps<{ status: ThemeStatus | 'selected' }>()

const LABEL = { available: 'Available', coming_soon: 'Coming soon', hidden: 'Preview only', selected: 'Selected' }
const STYLE = {
  available: 'bg-success-50 text-success-600',
  coming_soon: 'bg-canvas text-ink-500 ring-1 ring-line',
  hidden: 'bg-canvas text-ink-500',
  selected: 'bg-rose-600 text-white',
}
</script>

<template>
  <span class="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium" :class="STYLE[status]">
    {{ LABEL[status] }}
  </span>
</template>
