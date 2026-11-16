<script setup lang="ts">
/**
 * Countdown markup shared by all themes. It renders neutral classes
 * (`countdown`, `countdown__unit`, `countdown__value`, `countdown__label`)
 * that each theme styles in its own CSS.
 */
import { computed } from 'vue'

import { labels, weddingStart } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import { useCountdown, prefersReducedMotion } from '../composables/useCountdown'

const props = defineProps<{ content: WeddingContent }>()

const t = computed(() => labels(props.content.locale))
const remaining = useCountdown(() => weddingStart(props.content))
const units = computed(() => [
  { key: 'days', value: remaining.value.days, label: t.value.days },
  { key: 'hours', value: remaining.value.hours, label: t.value.hours },
  { key: 'minutes', value: remaining.value.minutes, label: t.value.minutes },
  // No ticking seconds for visitors who prefer reduced motion (WCAG 2.2.2).
  ...(reduceMotion ? [] : [{ key: 'seconds', value: remaining.value.seconds, label: t.value.seconds }]),
])
const reduceMotion = prefersReducedMotion()
</script>

<template>
  <div v-if="!remaining.isPast" class="countdown" role="timer" aria-live="off">
    <div v-for="unit in units" :key="unit.key" class="countdown__unit">
      <span class="countdown__value">{{ String(unit.value).padStart(2, '0') }}</span>
      <span class="countdown__label">{{ unit.label }}</span>
    </div>
  </div>
</template>
