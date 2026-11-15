<script setup lang="ts">
/**
 * Section navigation for the website editor: one horizontal scroller of
 * section chips at every width, in the editor panel header (the current chip is
 * scrolled into view). The live preview sits beside/behind the editor, so there
 * is no separate "Preview website" entry.
 *
 * Each chip shows at most one marker: an amber dot ("Unsaved", sr-only text)
 * while the section has unsaved edits, a subtle check when complete, or a
 * "Needs details" ring for a required section that isn't complete. Optional,
 * incomplete sections show none. Marker text stays in the link's accessible name.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import { useWeddingStore } from '@/stores/wedding'

import { prefersReducedMotion } from '../motion'
import { EDITOR_SECTIONS, sectionByRouteName } from '../sections'

const store = useWeddingStore()
const route = useRoute()
const { t } = useAppLocale()
const list = ref<HTMLOListElement | null>(null)

const current = computed(() => sectionByRouteName(route.name))

type Marker = 'unsaved' | 'complete' | 'needed' | null
function marker(key: SectionKey): Marker {
  if (store.isSectionDirty(key)) return 'unsaved'
  const section = store.completeness.sections[key]
  if (section.status === 'complete') return 'complete'
  if (section.required) return 'needed'
  return null
}

/** Keep the current chip visible in the phone scroller (no-op when nothing scrolls). */
function revealCurrent() {
  const container = list.value
  const el = container?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!container || !el || container.scrollWidth <= container.clientWidth) return
  const left = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
  if (typeof container.scrollTo === 'function') container.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  else container.scrollLeft = left
}
onMounted(revealCurrent)
watch(() => route.name, () => nextTick(revealCurrent))
</script>

<template>
  <nav :aria-label="t('websiteSections')" class="min-w-0" data-testid="section-nav">
    <ol
      ref="list"
      class="relative flex gap-2 overflow-x-auto py-2 [scrollbar-width:thin]"
      data-testid="section-nav-list"
    >
      <li v-for="s in EDITOR_SECTIONS" :key="s.key" class="shrink-0">
        <RouterLink
          :to="s.to"
          :class="[
            'flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none hover:bg-rose-50',
            FOCUS_RING,
            current?.key === s.key
              ? 'border-rose-600 bg-rose-50 font-medium text-ink-900'
              : 'border-ink-500/85 bg-surface text-ink-700',
          ]"
          :aria-current="current?.key === s.key ? 'page' : undefined"
          :data-section="s.key"
        >
          <span class="min-w-0">{{ t(s.label) }}</span>
          <span
            v-if="marker(s.key) === 'unsaved'"
            class="inline-flex shrink-0 items-center"
            data-testid="unsaved-badge"
          >
            <span class="size-2 rounded-full bg-amber-700" aria-hidden="true" />
            <span class="sr-only">{{ t('unsavedBadge') }}</span>
          </span>
          <span v-else-if="marker(s.key) === 'complete'" class="inline-flex shrink-0 text-success-600" data-status="complete">
            <svg class="size-4" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="sr-only">{{ t('statusComplete') }}</span>
          </span>
          <span v-else-if="marker(s.key) === 'needed'" class="inline-flex shrink-0 items-center" data-status="needed">
            <span class="size-2 rounded-full border-2 border-amber-700" aria-hidden="true" />
            <span class="sr-only">{{ t('statusNeedsDetails') }}</span>
          </span>
        </RouterLink>
      </li>
    </ol>
  </nav>
</template>
