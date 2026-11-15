<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ index: number; count: number; itemName: string; itemId: string; busy?: boolean }>()
const emit = defineEmits<{ move: [direction: -1 | 1] }>()
const { t } = useAppLocale()
</script>

<template>
  <span class="inline-flex gap-1" role="group" :aria-label="t('reorderItem', { name: itemName })">
    <button
      type="button"
      class="inline-flex size-11 items-center justify-center rounded-md border border-ink-500/85 bg-surface text-ink-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-500 sm:size-9"
      :aria-label="t('moveUp', { name: itemName })"
      :disabled="index === 0"
      :aria-disabled="busy || undefined"
      :data-reorder="`${itemId}-up`"
      @click="!busy && emit('move', -1)"
    >
      <span aria-hidden="true">↑</span>
    </button>
    <button
      type="button"
      class="inline-flex size-11 items-center justify-center rounded-md border border-ink-500/85 bg-surface text-ink-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:border-line disabled:text-ink-500 sm:size-9"
      :aria-label="t('moveDown', { name: itemName })"
      :disabled="index === count - 1"
      :aria-disabled="busy || undefined"
      :data-reorder="`${itemId}-down`"
      @click="!busy && emit('move', 1)"
    >
      <span aria-hidden="true">↓</span>
    </button>
  </span>
</template>
