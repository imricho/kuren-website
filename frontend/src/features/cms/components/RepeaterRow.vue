<script setup lang="ts">
/** One inline repeater row: heading, reorder and remove controls, then the row's fields (slot). */
import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'

import ReorderButtons from './ReorderButtons.vue'

defineProps<{ rowId: string; index: number; count: number; name: string }>()
defineEmits<{ move: [direction: -1 | 1]; remove: [] }>()
const { t } = useAppLocale()
</script>

<template>
  <li class="min-w-0 space-y-3 rounded-md bg-canvas p-3 ring-1 ring-line" :data-row="rowId" data-testid="repeater-row">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 :id="`${rowId}-h`" class="min-w-0 truncate text-sm font-semibold">{{ name }}</h3>
      <div class="flex items-center gap-2">
        <ReorderButtons :index="index" :count="count" :item-name="name" :item-id="rowId" @move="(d) => $emit('move', d)" />
        <button
          type="button"
          :class="['min-h-11 rounded-md px-3 text-sm font-medium text-danger-600 hover:bg-danger-50 sm:min-h-9', FOCUS_RING]"
          :aria-label="t('removeRowNamed', { name })"
          data-action="remove-row"
          @click="$emit('remove')"
        >
          {{ t('remove') }}
        </button>
      </div>
    </div>
    <fieldset class="min-w-0 space-y-3" :aria-labelledby="`${rowId}-h`">
      <slot />
    </fieldset>
  </li>
</template>
