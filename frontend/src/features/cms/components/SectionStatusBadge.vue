<script setup lang="ts">
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionStatus } from '@/features/wedding/completeness'

const props = defineProps<{ status: SectionStatus }>()
const { t } = useAppLocale()

const STYLE: Record<SectionStatus, string> = {
  complete: 'bg-success-50 text-success-600',
  in_progress: 'bg-amber-50 text-amber-800',
  not_started: 'bg-canvas text-ink-500 ring-1 ring-line',
  optional: 'bg-canvas text-ink-500 ring-1 ring-line',
}
const label = computed(
  () =>
    ({
      complete: t('statusComplete'),
      in_progress: t('statusInProgress'),
      not_started: t('statusNotStarted'),
      optional: t('statusOptional'),
    })[props.status],
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="STYLE[status]"
    :data-status="status"
  >
    <svg v-if="status === 'complete'" class="size-3" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {{ label }}
  </span>
</template>
