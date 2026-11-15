<script setup lang="ts">
/** Category → Collection → Template progress indicator shown on every picker page. */
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ current: 1 | 2 | 3 }>()
const { t } = useAppLocale()
const steps = ['family', 'collection', 'template'] as const
</script>

<template>
  <ol class="grid w-full grid-cols-3 items-start gap-1 text-[0.6875rem] font-medium tracking-[0.06em] uppercase" :aria-label="t('chooseWeddingTheme')">
    <li
      v-for="(step, i) in steps"
      :key="step"
      class="flex min-w-0 flex-col items-center gap-1.5"
      :class="i + 1 === current ? 'text-rose-600' : i + 1 < current ? 'text-ink-700' : 'text-ink-500'"
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
    </li>
  </ol>
</template>
