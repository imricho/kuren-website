<script setup lang="ts">
/**
 * The one "Select template" action used on cards, the inline preview and the
 * full-screen preview. Once selected it reads "Selected" and becomes inert via
 * aria-disabled (not `disabled`), so keyboard focus stays on the button.
 */
import { computed } from 'vue'

import { useThemeSelectionStore } from '@/stores/themeSelection'

import { ACTION } from './format'

const props = withDefaults(defineProps<{ templateId: string; templateName: string; size?: 'md' | 'sm' }>(), {
  size: 'md',
})
const selection = useThemeSelectionStore()
const isSelected = computed(() => selection.selectedThemeId === props.templateId)

function choose() {
  if (!isSelected.value) selection.select(props.templateId)
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors"
    :class="[
      size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm',
      isSelected ? 'cursor-default bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
    ]"
    :aria-disabled="isSelected || undefined"
    :aria-label="isSelected ? `${templateName} is selected` : `${ACTION.select}: ${templateName}`"
    data-action="select"
    @click="choose"
  >
    <svg v-if="isSelected" class="size-3.5" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {{ isSelected ? ACTION.selected : ACTION.select }}
  </button>
</template>
