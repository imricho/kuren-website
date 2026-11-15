<script setup lang="ts">
import { computed, useId } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'

const props = defineProps<{ done: number; total: number; compact?: boolean }>()
const { t } = useAppLocale()
const id = useId()
const text = computed(() => t('requiredComplete', { done: props.done, total: props.total }))
</script>

<template>
  <div :class="compact ? 'space-y-1.5' : 'space-y-2'">
    <label :for="id" class="block text-sm font-medium text-ink-700" :class="compact && 'text-xs'">{{ text }}</label>
    <progress
      :id="id"
      class="completion-meter block h-2 w-full overflow-hidden rounded-full"
      :max="total"
      :value="done"
      :aria-valuetext="text"
    >
      {{ text }}
    </progress>
  </div>
</template>

<style scoped>
.completion-meter {
  appearance: none;
  border: 0;
  background: var(--color-rose-50);
}
.completion-meter::-webkit-progress-bar {
  background: var(--color-rose-50);
}
.completion-meter::-webkit-progress-value {
  background: var(--color-rose-600);
  border-radius: 9999px;
}
.completion-meter::-moz-progress-bar {
  background: var(--color-rose-600);
  border-radius: 9999px;
}
</style>
