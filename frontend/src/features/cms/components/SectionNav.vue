<script setup lang="ts">
/**
 * Section navigation for the website editor (editor panel header, and the
 * mobile Edit tab): a row of group tabs (driven by the invitation variant's
 * sections; five for weddings), then a horizontal chip scroller
 * with only the selected group's sections (the canonical public order is
 * unchanged). The selected group follows the current route; choosing another
 * group tab only switches the chips shown (it does not navigate).
 *
 * Each chip shows at most one marker: an amber dot ("Unsaved", sr-only text)
 * while the section has unsaved edits, a subtle check when complete, or a
 * "Needs details" ring for a required section that isn't complete. Optional
 * sections that are switched off show "Hidden". Marker text stays in the link's
 * accessible name; links keep `data-section` = canonical section id.
 */
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import { useInvitationStore } from '@/stores/invitation'

import { prefersReducedMotion } from '../motion'
import { isSectionShown, navGroupByRouteName, navGroupsFor, SECTION_DRAFT_KEYS, type NavGroupKey } from '../sections'

withDefaults(defineProps<{ vertical?: boolean }>(), { vertical: false })

const store = useInvitationStore()
const route = useRoute()
const { t } = useAppLocale()
const uid = useId()
const list = ref<HTMLOListElement | null>(null)
const tabRefs = ref<HTMLButtonElement[]>([])

const NAV_GROUPS = computed(() => navGroupsFor(store.variant))
const routeGroup = computed(() => navGroupByRouteName(route.name, NAV_GROUPS.value)?.key ?? NAV_GROUPS.value[0]!.key)
const selected = ref<NavGroupKey>(routeGroup.value)
watch(routeGroup, (key) => (selected.value = key))
const group = computed(() => NAV_GROUPS.value.find((g) => g.key === selected.value) ?? NAV_GROUPS.value[0]!)

type Marker = 'unsaved' | 'complete' | 'needed' | 'hidden' | null
function marker(key: SectionKey): Marker {
  const keys = SECTION_DRAFT_KEYS[key] ?? [key]
  if (keys.some((k) => store.isSectionDirty(k))) return 'unsaved'
  if (!isSectionShown(store.liveDraft ?? store.content, key)) return 'hidden'
  const section = store.completeness.sections[key]
  if (section.status === 'complete') return 'complete'
  if (section.required) return 'needed'
  return null
}

const chipClass = (active: boolean) => [
  'flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none hover:bg-rose-50',
  FOCUS_RING,
  active ? 'border-rose-600 bg-rose-50 font-medium text-ink-900' : 'border-ink-500/85 bg-surface text-ink-700',
]

// --- Group tabs (←/→ move and activate, Home/End jump; focus stays on the tab) ---------------
function selectAt(index: number) {
  const groups = NAV_GROUPS.value
  const g = groups[(index + groups.length) % groups.length]!
  selected.value = g.key
  nextTick(() => tabRefs.value[groups.indexOf(g)]?.focus())
}
function onTabKey(event: KeyboardEvent, index: number) {
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: NAV_GROUPS.value.length - 1 }
  if (!(event.key in moves)) return
  event.preventDefault()
  selectAt(moves[event.key]!)
}

/** Keep the current chip visible in the scroller (no-op when nothing scrolls). */
function revealCurrent() {
  const container = list.value
  const el = container?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!container || !el || container.scrollWidth <= container.clientWidth) return
  const left = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
  if (typeof container.scrollTo === 'function') container.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  else container.scrollLeft = left
}
onMounted(revealCurrent)
watch([() => route.name, selected], () => nextTick(revealCurrent))
</script>

<template>
<nav :aria-label="t('websiteSections')" class="min-w-0" :class="{ 'cms-section-nav-vertical': vertical }"
  data-testid="section-nav">
  <div v-if="!vertical" role="tablist" :aria-label="t('navGroups')"
    class="flex gap-1 overflow-x-auto pt-2 [scrollbar-width:thin]" data-testid="section-nav-groups">
    <button v-for="(g, i) in NAV_GROUPS" :id="`${uid}-tab-${g.key}`" :key="g.key" ref="tabRefs" type="button" role="tab"
      :aria-selected="selected === g.key" :aria-controls="`${uid}-panel`" :tabindex="selected === g.key ? 0 : -1"
      :title="t(g.fullLabel)"
      :aria-label="routeGroup === g.key && selected !== g.key ? `${t(g.fullLabel)} (${t('currentGroup')})` : t(g.fullLabel)"
      :class="[
          'h-9 shrink-0 rounded-md px-3 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none',
          FOCUS_RING,
          selected === g.key ? 'bg-rose-50 font-semibold text-rose-700' : 'text-ink-700 hover:bg-rose-50',
          routeGroup === g.key && selected !== g.key && 'underline decoration-rose-600 underline-offset-4',
        ]" :data-group="g.key" @click="selected = g.key" @keydown="onTabKey($event, i)">
      {{ t(g.label) }}
    </button>
  </div>
  <div v-if="!vertical" :id="`${uid}-panel`" role="tabpanel" :aria-labelledby="`${uid}-tab-${selected}`"
    :data-group-panel="selected">
    <ol ref="list" class="relative flex gap-2 overflow-x-auto py-2 [scrollbar-width:thin]"
      data-testid="section-nav-list">
      <li v-for="entry in group.entries" :key="entry.kind === 'section' ? entry.section.key : entry.key"
        class="shrink-0">
        <RouterLink v-if="entry.kind === 'section'" :to="entry.section.to"
          :class="chipClass(route.name === entry.section.routeName)"
          :aria-current="route.name === entry.section.routeName ? 'page' : undefined" :data-section="entry.section.key">
          <span class="min-w-0">{{ t(entry.section.label) }}</span>
          <span v-if="marker(entry.section.key) === 'unsaved'" class="inline-flex shrink-0 items-center"
            data-testid="unsaved-badge">
            <span class="size-2 rounded-full bg-amber-700" aria-hidden="true" />
            <span class="sr-only">{{ t('unsavedBadge') }}</span>
          </span>
          <span v-else-if="marker(entry.section.key) === 'hidden'"
            class="shrink-0 rounded-full bg-canvas px-1.5 text-xs text-ink-500 ring-1 ring-line" data-status="hidden">
            {{ t('navHidden') }}
          </span>
          <span v-else-if="marker(entry.section.key) === 'complete'" class="inline-flex shrink-0 text-success-600"
            data-status="complete">
            <svg class="size-4" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
            <span class="sr-only">{{ t('statusComplete') }}</span>
          </span>
          <span v-else-if="marker(entry.section.key) === 'needed'" class="inline-flex shrink-0 items-center"
            data-status="needed">
            <span class="size-2 rounded-full border-2 border-amber-700" aria-hidden="true" />
            <span class="sr-only">{{ t('statusNeedsDetails') }}</span>
          </span>
        </RouterLink>
        <RouterLink v-else-if="entry.kind === 'page'" :to="entry.to"
          :class="chipClass(route.name === entry.routeName)"
          :aria-current="route.name === entry.routeName ? 'page' : undefined" :data-section="entry.key">
          {{ t(entry.label) }}
        </RouterLink>
        <p v-else
          class="flex h-9 items-center rounded-full border border-dashed border-line px-3 text-xs whitespace-nowrap text-ink-500"
          :data-note="entry.key">
          {{ t(entry.label) }}
        </p>
      </li>
    </ol>
  </div>
  <template v-if="vertical">
    <section v-for="g in NAV_GROUPS" :key="g.key" class="cms-nav-group">
      <h3>{{ t(g.fullLabel) }}</h3>
      <ol>
        <template v-for="entry in g.entries" :key="entry.kind === 'section' ? entry.section.key : entry.key">
          <li v-if="entry.kind !== 'note'">
            <RouterLink v-if="entry.kind === 'section'" :to="entry.section.to"
              :aria-current="route.name === entry.section.routeName ? 'page' : undefined"
              :data-section="entry.section.key">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
                <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
                <path d="M6.5 7h7M6.5 10h7M6.5 13h4" />
              </svg>
              <span>{{ t(entry.section.label) }}</span>
              <span v-if="marker(entry.section.key) === 'unsaved'" class="cms-nav-unsaved"
                data-testid="unsaved-badge"><span aria-hidden="true">●</span><span
                  class="sr-only">{{ t('unsavedBadge') }}</span></span>
              <span v-else-if="marker(entry.section.key) === 'complete'" class="cms-nav-complete"
                data-status="complete"><span aria-hidden="true">✓</span><span
                  class="sr-only">{{ t('statusComplete') }}</span></span>
              <span v-else-if="marker(entry.section.key) === 'hidden'" class="cms-nav-hidden" data-status="hidden"><span
                  aria-hidden="true">−</span><span class="sr-only">{{ t('navHidden') }}</span></span>
              <span v-else-if="marker(entry.section.key) === 'needed'" class="cms-nav-needed" data-status="needed"><span
                  aria-hidden="true">○</span><span class="sr-only">{{ t('statusNeedsDetails') }}</span></span>
            </RouterLink>
            <RouterLink v-else-if="entry.kind === 'page'" :to="entry.to"
              :aria-current="route.name === entry.routeName ? 'page' : undefined" :data-section="entry.key"><svg
                viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
                <path d="m3 9 14-6-6 14-2-6-6-2Zm6 2 8-8" />
              </svg><span>{{ t(entry.label) }}</span></RouterLink>
          </li>
        </template>
      </ol>
    </section>
  </template>
</nav>
</template>

<style scoped>
.cms-nav-group {
  padding-top: 9px;
  margin-top: 6px;
  border-top: 1px solid #e8dcec;
}

.cms-nav-group:first-child {
  border-top: 0;
  margin-top: 0;
  padding-top: 0;
}

.cms-nav-group h3 {
  font-family: inherit;
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: .15em;
  color: #62386d;
  margin: 0 10px 5px;
  line-height: 1.5;
}

.cms-nav-group ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cms-nav-group a {
  display: flex;
  align-items: center;
  min-height: 30px;
  gap: 10px;
  border-radius: 8px;
  padding: 5px 10px;
  color: #321a3c;
  font-size: 12px;
  line-height: 1.3;
  text-decoration: none;
}

.cms-nav-group a:hover {
  background: #eee2f3;
}

.cms-nav-group a[aria-current='page'] {
  background: #dec9e8;
  font-weight: 600;
}

.cms-nav-group a:focus-visible {
  outline: 2px solid #724587;
  outline-offset: 2px;
}

.cms-nav-group a>svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: #754686;
}

.cms-nav-group a>span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.cms-nav-complete,
.cms-nav-needed,
.cms-nav-hidden,
.cms-nav-unsaved {
  flex-shrink: 0;
}

.cms-nav-complete {
  color: #54805d;
}

.cms-nav-needed,
.cms-nav-unsaved {
  color: #99701b;
}

.cms-nav-hidden {
  color: #977f9e;
}
</style>
