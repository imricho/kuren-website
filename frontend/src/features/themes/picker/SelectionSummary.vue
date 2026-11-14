<script setup lang="ts">
/**
 * "Selected: Family › Collection › Template". It is a polite live region, so
 * choosing a template is announced to screen-reader users as well as shown.
 */
import { computed } from 'vue'

import { useThemeSelectionStore } from '@/stores/themeSelection'

import { templatePath } from '../core/registry'
import { formatTemplatePath } from './format'
import { collectionRoute } from './routes'

defineProps<{ compact?: boolean }>()
const selection = useThemeSelectionStore()
const path = computed(() => templatePath(selection.selectedThemeId))
const label = computed(() => formatTemplatePath(selection.selectedThemeId))
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border text-sm"
    :data-compact="compact || undefined"
    :class="[path ? 'border-rose-100 bg-rose-50' : 'border-dashed border-line bg-surface', compact ? 'px-3 py-2.5' : 'min-h-12 px-4 py-3']"
    data-testid="selection-summary"
  >
    <p role="status" aria-live="polite" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <template v-if="path">
        <span class="font-medium text-rose-700">Selected</span>
        <span class="text-ink-700">{{ label }}</span>
      </template>
      <span v-else class="text-ink-500">No template selected yet — preview freely, then select the one you love.</span>
    </p>
    <RouterLink
      v-if="path && !compact"
      :to="collectionRoute(path.family.id, path.collection.id)"
      class="ml-auto rounded font-medium text-rose-600 hover:text-rose-700"
    >
      View collection <span aria-hidden="true">→</span>
    </RouterLink>
  </div>
</template>
