<script setup lang="ts">
/**
 * Section navigation for the website editor. One list, styled per breakpoint:
 *  - ≥lg: a sticky left column with the completion meter;
 *  - <lg: a compact horizontal scroller of section chips, so the form starts
 *    right below it (the current chip is scrolled into view).
 *
 * Each row shows at most one marker: "Unsaved" while the section has unsaved
 * edits, a subtle check when complete, or a "Needs details" marker for a
 * required section that isn't complete. Optional, incomplete sections show none.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import { useWeddingStore } from '@/stores/wedding'

import { prefersReducedMotion } from '../motion'
import { EDITOR_SECTIONS, sectionByRouteName } from '../sections'
import CompletionMeter from './CompletionMeter.vue'

const store = useWeddingStore()
const route = useRoute()
const { t } = useAppLocale()
const list = ref<HTMLOListElement | null>(null)

const current = computed(() => sectionByRouteName(route.name))
const previewTo = computed(() => ({ name: 'wedding-preview', query: { from: route.fullPath } }))

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
  <nav :aria-label="t('websiteSections')" class="min-w-0 lg:sticky lg:top-24" data-testid="section-nav">
    <CompletionMeter
      class="mb-4 hidden rounded-lg border border-line bg-surface p-3 lg:block"
      compact
      :done="store.completeness.done"
      :total="store.completeness.total"
    />
    <ol
      ref="list"
      class="relative flex gap-2 overflow-x-auto p-1 pb-2 [scrollbar-width:thin] lg:block lg:space-y-1 lg:overflow-visible lg:p-0"
      data-testid="section-nav-list"
    >
      <li v-for="s in EDITOR_SECTIONS" :key="s.key" class="shrink-0">
        <RouterLink
          :to="s.to"
          :class="[
            'flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none hover:bg-rose-50',
            'lg:rounded-md lg:border-0 lg:px-3',
            FOCUS_RING,
            current?.key === s.key
              ? 'border-rose-600 bg-rose-50 font-medium text-ink-900'
              : 'border-ink-500/85 bg-surface text-ink-700 lg:bg-transparent',
          ]"
          :aria-current="current?.key === s.key ? 'page' : undefined"
          :data-section="s.key"
        >
          <span class="min-w-0 lg:flex-1 lg:truncate">{{ t(s.label) }}</span>
          <span
            v-if="marker(s.key) === 'unsaved'"
            class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
            data-testid="unsaved-badge"
          >
            <span class="size-1.5 rounded-full bg-amber-700" aria-hidden="true" />
            {{ t('unsavedBadge') }}
          </span>
          <span v-else-if="marker(s.key) === 'complete'" class="inline-flex shrink-0 text-success-600" data-status="complete">
            <svg class="size-4" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="sr-only">{{ t('statusComplete') }}</span>
          </span>
          <span
            v-else-if="marker(s.key) === 'needed'"
            class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-800"
            data-status="needed"
          >
            <span class="size-2 rounded-full border-2 border-amber-700" aria-hidden="true" />
            <span class="sr-only lg:not-sr-only">{{ t('statusNeedsDetails') }}</span>
          </span>
        </RouterLink>
      </li>
      <li class="shrink-0 lg:mt-1 lg:border-t lg:border-line lg:pt-1">
        <RouterLink
          :to="previewTo"
          :class="[
            'flex min-h-11 items-center gap-2 rounded-full border border-rose-600 px-3.5 py-2 text-sm font-medium whitespace-nowrap text-rose-700 hover:bg-rose-50',
            'lg:rounded-md lg:border-0 lg:px-3',
            FOCUS_RING,
          ]"
          data-section="preview"
        >
          {{ t('previewWebsite') }} <span aria-hidden="true">→</span>
        </RouterLink>
      </li>
    </ol>
  </nav>
</template>
