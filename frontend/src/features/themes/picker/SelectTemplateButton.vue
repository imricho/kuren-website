<script setup lang="ts">
/**
 * The one "Select template" action used on cards, the inline preview and the
 * full-screen preview. Selection saves before opening Edit. A saved selection can be opened again.
 * Pending saves keep keyboard focus and block competing selections.
 *
 * Selecting saves to the wedding record (pessimistic): while saving the button
 * is aria-busy; if saving fails an inline error explains it and the button retries.
 */
import { computed, ref, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useThemeSelectionStore } from '@/stores/themeSelection'

import { getTheme } from '../core/registry'
import { isSelectable } from '../core/types'
import { localizedActions } from './format'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ templateId: string; templateName: string; size?: 'md' | 'sm'; appearance?: 'button' | 'title' }>(), {
  size: 'md',
  appearance: 'button',
})
const errorId = `select-error-${useId()}`
const selection = useThemeSelectionStore()
const router = useRouter()
const route = useRoute()
const opening = ref(false)
const navigationFailed = ref(false)
const { t } = useAppLocale()
const toast = useToast()
const action = computed(() => localizedActions())
const isSelected = computed(() => selection.selectedThemeId === props.templateId)
const selectable = computed(() => isSelectable(getTheme(props.templateId)))
const pending = computed(() => selection.pendingThemeId === props.templateId || opening.value)
const blocked = computed(() => selection.pendingThemeId !== null || opening.value)
const failed = computed(() => selection.error?.themeId === props.templateId)

async function choose() {
  if (!selectable.value || blocked.value) return
  navigationFailed.value = false
  const origin = route.fullPath
  const ok = await selection.select(props.templateId)
  if (!ok) {
    if (failed.value) toast.error(t('themeSaveFailed', { name: props.templateName }))
    return
  }
  // A completed save must not pull someone away from a page they navigated to
  // while it was pending. push preserves the collection/preview in Back history.
  if (route.fullPath !== origin) return
  opening.value = true
  try {
    const failure = await router.push({ name: 'wedding' })
    if (failure) navigationFailed.value = true
  } catch {
    navigationFailed.value = true
  } finally {
    opening.value = false
  }
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
      class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors"
      :class="[
        appearance === 'title' ? 'text-left text-lg outline-none after:absolute after:inset-0' : size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm',
        appearance === 'title' ? 'text-ink-900' : isSelected
          ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
          : 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        pending && 'cursor-progress opacity-80',
      ]"
      :aria-disabled="blocked || undefined"
      :aria-busy="pending || undefined"
      :aria-label="isSelected ? `${t('openEditor')}: ${templateName}` : `${action.select}: ${templateName}`"
      :aria-describedby="(failed || navigationFailed) ? errorId : undefined"
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
      {{ pending ? t('saving') : appearance === 'title' ? templateName : isSelected ? t('openEditor') : action.select }}
    </button>
    <span
      v-if="(failed || navigationFailed) && !pending" role="alert"
      :id="errorId"
      class="text-xs text-danger-600"
      data-testid="select-error"
    >
      {{ navigationFailed ? t('themeOpenEditorFailed') : t('themeSaveFailedShort') }}
    </span>
  </span>
</template>
