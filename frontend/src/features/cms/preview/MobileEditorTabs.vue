<script setup lang="ts">
/**
 * Edit / Preview tabs for the editor below 1024px (docs/ux/live-editor.md §7–8).
 * Sticky under the app header (top, because the on-screen keyboard hides bottom
 * bars). Automatic activation: ←/→ move and select, Home/End jump; focus stays
 * on the tab. The default slot sits at the right (the save status).
 */
import { nextTick } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'

export type EditorTab = 'edit' | 'preview'

const props = defineProps<{ ids: Record<EditorTab, { tab: string; panel: string }> }>()
const tab = defineModel<EditorTab>({ required: true })
const { t } = useAppLocale()

const tabs = [
  { key: 'edit', label: 'tabEdit' },
  { key: 'preview', label: 'tabPreview' },
] as const

async function select(index: number, focus: boolean) {
  const next = tabs[(index + tabs.length) % tabs.length]!
  tab.value = next.key
  if (focus) {
    await nextTick()
    document.getElementById(props.ids[next.key].tab)?.focus()
  }
}

function onKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'ArrowRight') void select(index + 1, true)
  else if (e.key === 'ArrowLeft') void select(index - 1, true)
  else if (e.key === 'Home') void select(0, true)
  else if (e.key === 'End') void select(tabs.length - 1, true)
  else return
  e.preventDefault()
}
</script>

<template>
  <div
    class="sticky top-14 z-[9] flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur sm:top-16"
    data-testid="editor-tabs"
  >
    <div role="tablist" :aria-label="t('editorViewTabs')" class="-mb-px flex h-full shrink-0 items-end">
      <button
        v-for="(item, i) in tabs"
        :id="ids[item.key].tab"
        :key="item.key"
        type="button"
        role="tab"
        :aria-selected="tab === item.key"
        :aria-controls="ids[item.key].panel"
        :tabindex="tab === item.key ? 0 : -1"
        :class="[
          'flex h-11 items-center border-b-2 px-3 text-sm font-medium sm:px-4',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-600',
          tab === item.key ? 'border-rose-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900',
        ]"
        :data-tab="item.key"
        @click="select(i, false)"
        @keydown="onKeydown($event, i)"
      >
        {{ t(item.label) }}
      </button>
    </div>
    <div class="ml-auto flex min-w-0 items-center"><slot /></div>
  </div>
</template>
