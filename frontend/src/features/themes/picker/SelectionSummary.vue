<script setup lang="ts">
/** "Your selection: Classic › Blush Garden" banner shown across the picker. */
import { computed } from 'vue'

import { useThemeSelectionStore } from '@/stores/themeSelection'

import { templatePath } from '../core/registry'

const selection = useThemeSelectionStore()
const path = computed(() => templatePath(selection.selectedThemeId))
</script>

<template>
  <div
    v-if="path"
    class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm"
    data-testid="selection-summary"
  >
    <span class="font-medium text-rose-700">Your selection</span>
    <span class="text-ink-700">
      {{ path.family.name }} › <template v-if="path.collection.name !== path.family.name">{{ path.collection.name }} › </template>
      <strong class="font-semibold text-ink-900">{{ path.template.name }}</strong>
    </span>
    <RouterLink
      :to="{ name: 'theme-collection', params: { familyId: path.family.id, collectionId: path.collection.id } }"
      class="ml-auto font-medium text-rose-600 hover:text-rose-700"
    >
      View →
    </RouterLink>
  </div>
</template>
