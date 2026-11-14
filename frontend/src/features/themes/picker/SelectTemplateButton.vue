<script setup lang="ts">
/**
 * The one "Select template" action used on cards, the inline preview and the
 * full-screen preview. Once selected it reads "Selected" and becomes inert via
 * aria-disabled (not `disabled`), so keyboard focus stays on the button.
 */
import { computed } from 'vue'

import { useThemeSelectionStore } from '@/stores/themeSelection'

import { getTheme } from '../core/registry'
import { isSelectable } from '../core/types'
import { ACTION } from './format'

const props = withDefaults(defineProps<{ templateId: string; templateName: string; size?: 'md' | 'sm' }>(), {
  size: 'md',
})
const selection = useThemeSelectionStore()
const isSelected = computed(() => selection.selectedThemeId === props.templateId)
const selectable = computed(() => isSelectable(getTheme(props.templateId)))

function choose() {
  if (selectable.value && !isSelected.value) selection.select(props.templateId)
}
</script>

<template>
  <!-- Drafts can be previewed but not selected until cultural review is complete. -->
  <span
    v-if="!selectable"
    class="inline-flex items-center gap-1.5 rounded-lg bg-[#fbf1cf] px-3 py-2.5 text-sm font-medium text-[#5b4a12] ring-1 ring-[#ecd98f]"
    role="note"
    :aria-label="`${templateName} is a draft pending cultural review and can't be selected yet`"
    data-action="draft-not-selectable"
  >
    {{ ACTION.draftNotSelectable }}
  </span>
  <button
    v-else
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
