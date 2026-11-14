<script setup lang="ts">
/** Family → Collection → Template progress indicator shown on every picker page. */
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ current: 1 | 2 | 3 }>()
const { t } = useAppLocale()
const steps = ['family', 'collection', 'template'] as const
</script>

<template>
  <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide uppercase" :aria-label="t('chooseWeddingTheme')">
    <li
      v-for="(step, i) in steps"
      :key="step"
      class="flex items-center gap-2"
      :class="i + 1 === current ? 'text-rose-600' : i + 1 < current ? 'text-ink-700' : 'text-ink-300'"
      :aria-current="i + 1 === current ? 'step' : undefined"
    >
      <span
        class="flex size-5 items-center justify-center rounded-full text-[0.65rem]"
        :class="i + 1 === current ? 'bg-rose-600 text-white' : i + 1 < current ? 'bg-rose-100 text-rose-700' : 'bg-line text-ink-500'"
        aria-hidden="true"
      >
        {{ i + 1 }}
      </span>
      <span>{{ t(step) }}</span>
      <span v-if="i < steps.length - 1" class="text-ink-300" aria-hidden="true">—</span>
    </li>
  </ol>
</template>
