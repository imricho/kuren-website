<script setup lang="ts">
/**
 * The one "Select template" action used on cards, the inline preview and the
 * full-screen preview. Once selected it reads "Selected" and becomes inert via
 * aria-disabled (not `disabled`), so keyboard focus stays on the button.
 *
 * Selecting saves to the wedding record (pessimistic): while saving the button
 * is aria-busy; if saving fails an inline error explains it and the button retries.
 */
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useThemeSelectionStore } from '@/stores/themeSelection'

import { getTheme } from '../core/registry'
import { isSelectable } from '../core/types'
import { localizedActions } from './format'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ templateId: string; templateName: string; size?: 'md' | 'sm' }>(), {
  size: 'md',
})
const selection = useThemeSelectionStore()
const { t } = useAppLocale()
const toast = useToast()
const action = computed(() => localizedActions())
const isSelected = computed(() => selection.selectedThemeId === props.templateId)
const selectable = computed(() => isSelectable(getTheme(props.templateId)))
const pending = computed(() => selection.pendingThemeId === props.templateId)
const failed = computed(() => selection.error?.themeId === props.templateId)

async function choose() {
  if (!selectable.value || isSelected.value || pending.value) return
  const ok = await selection.select(props.templateId)
  if (!ok && failed.value) toast.error(t('themeSaveFailed', { name: props.templateName }))
}
</script>

<template>
  <!-- Drafts can be previewed but not selected until cultural review is complete. -->
  <span
    v-if="!selectable"
    v-bind="$attrs"
    class="inline-flex items-center gap-1.5 rounded-lg bg-[#fbf1cf] px-3 py-2.5 text-sm font-medium text-[#5b4a12] ring-1 ring-[#ecd98f]"
    role="note"
    :aria-label="`${templateName}: ${action.draftNotSelectable}`"
    data-action="draft-not-selectable"
  >
    {{ action.draftNotSelectable }}
  </span>
  <span v-else v-bind="$attrs" class="inline-flex flex-col items-start gap-1">
    <button
      type="button"
      class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors sm:min-h-0"
      :class="[
        size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm',
        isSelected
          ? 'cursor-default bg-rose-50 text-rose-700 ring-1 ring-rose-200'
          : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        pending && 'cursor-progress opacity-80',
      ]"
      :aria-disabled="isSelected || pending || undefined"
      :aria-busy="pending || undefined"
      :aria-label="isSelected ? `${templateName}: ${action.selected}` : `${action.select}: ${templateName}`"
      :aria-describedby="failed ? `select-error-${templateId}` : undefined"
      data-action="select"
      @click="choose"
    >
      <svg v-if="pending" class="size-3.5 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
      <svg v-else-if="isSelected" class="size-3.5" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {{ pending ? t('saving') : isSelected ? action.selected : action.select }}
    </button>
    <span
      v-if="failed && !pending"
      :id="`select-error-${templateId}`"
      class="text-xs text-danger-600"
      data-testid="select-error"
    >
      {{ t('themeSaveFailedShort') }}
    </span>
  </span>
</template>
