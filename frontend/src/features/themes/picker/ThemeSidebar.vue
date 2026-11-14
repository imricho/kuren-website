<script setup lang="ts">
/**
 * Left sidebar: browse Family → Collection → Template, one level at a time.
 * The current level, a back link and breadcrumbs always show where the user is.
 * Clicking a template PREVIEWS it (URL + preview pane); selecting is a separate
 * action in the preview pane.
 */
import { computed } from 'vue'

import { useThemeSelectionStore } from '@/stores/themeSelection'

import { FAMILIES, collectionsOf, templatesOf } from '../core/registry'
import type { ThemeCollection, ThemeFamily } from '../core/types'
import { countLabel, familySummary } from './format'
import PickerBreadcrumbs from './PickerBreadcrumbs.vue'
import CollectionBrief from './CollectionBrief.vue'
import PickerSteps from './PickerSteps.vue'
import { collectionRoute, familyRoute, templateRoute } from './routes'
import SelectionSummary from './SelectionSummary.vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{ family?: ThemeFamily; collection?: ThemeCollection; previewedId?: string }>()
const emit = defineEmits<{ navigate: [] }>()
const selection = useThemeSelectionStore()

const level = computed<1 | 2 | 3>(() => (props.collection ? 3 : props.family ? 2 : 1))
const collections = computed(() => (props.family ? collectionsOf(props.family.id) : []))
const templates = computed(() => (props.collection ? templatesOf(props.collection.id) : []))

const itemClass =
  'relative flex flex-col gap-1 rounded-xl border bg-surface px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-rose-500'
</script>

<template>
  <nav aria-label="Browse themes" class="flex flex-col gap-5">
    <!-- Where am I? -->
    <div class="space-y-3">
      <PickerSteps :current="level" />
      <PickerBreadcrumbs :family="family" :collection="collection" />
      <RouterLink
        v-if="level === 3 && family"
        :to="familyRoute(family.id)"
        class="inline-flex items-center gap-1 rounded text-sm font-medium text-rose-600 hover:text-rose-700"
        data-testid="sidebar-back"
        @click="emit('navigate')"
      >
        <span aria-hidden="true">←</span> All {{ family.name }} collections
      </RouterLink>
      <RouterLink
        v-else-if="level === 2"
        :to="{ name: 'themes' }"
        class="inline-flex items-center gap-1 rounded text-sm font-medium text-rose-600 hover:text-rose-700"
        data-testid="sidebar-back"
        @click="emit('navigate')"
      >
        <span aria-hidden="true">←</span> All families
      </RouterLink>
    </div>

    <SelectionSummary compact />

    <!-- Level 1: families -->
    <section v-if="level === 1" aria-labelledby="sb-families">
      <h2 id="sb-families" class="mb-3 text-xl font-semibold">Choose a family</h2>
      <ul class="space-y-2">
        <li
          v-for="f in FAMILIES"
          :key="f.id"
          :class="[itemClass, 'border-line hover:border-rose-500']"
          :data-family-card="f.id"
          :data-status="f.status"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-display text-xl font-semibold">
              <RouterLink :to="familyRoute(f.id)" class="outline-none after:absolute after:inset-0" @click="emit('navigate')">
                {{ f.name }}
              </RouterLink>
            </h3>
            <StatusBadge :status="f.status" />
          </div>
          <p class="text-xs text-ink-500">{{ f.tagline }}</p>
          <p class="text-xs font-medium text-rose-600" data-testid="family-summary">{{ familySummary(f.id) }}</p>
        </li>
      </ul>
    </section>

    <!-- Level 2: collections of a family -->
    <template v-else-if="level === 2 && family">
      <header class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-2xl font-semibold">{{ family.name }}</h2>
          <StatusBadge :status="family.status" />
        </div>
        <p class="text-sm text-ink-500">{{ family.description }}</p>
        <p class="text-xs font-medium text-ink-700" data-testid="family-summary">{{ familySummary(family.id) }}</p>
      </header>

      <section
        v-if="collections.length === 0"
        class="rounded-xl border border-dashed border-line bg-surface p-5 text-sm"
        aria-labelledby="sb-empty"
        data-testid="family-coming-soon"
      >
        <h3 id="sb-empty" class="font-display text-lg font-semibold">Collections in development</h3>
        <p class="mt-1 text-ink-500">
          {{ family.name }} is in development. It has no collections or templates to preview or select yet.
        </p>
      </section>

      <section v-if="collections.length" aria-labelledby="sb-collections">
        <h3 id="sb-collections" class="mb-1 text-sm font-semibold tracking-wide text-ink-700 uppercase">Choose a collection</h3>
        <ul class="space-y-2">
          <li
            v-for="c in collections"
            :key="c.id"
            :class="[itemClass, 'border-line hover:border-rose-500']"
            :data-collection-card="c.id"
            :data-status="c.status"
          >
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-display text-lg font-semibold">
                <RouterLink :to="collectionRoute(family.id, c.id)" class="outline-none after:absolute after:inset-0" @click="emit('navigate')">
                  {{ c.name }}
                </RouterLink>
              </h4>
              <StatusBadge :status="c.status" />
            </div>
            <p class="text-xs text-ink-500">{{ c.description }}</p>
            <p class="text-xs font-medium text-rose-600">{{ countLabel({ collectionId: c.id }) }}</p>
          </li>
        </ul>
      </section>
    </template>

    <!-- Level 3: templates of a collection -->
    <template v-else-if="level === 3 && collection">
      <header class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-2xl font-semibold">{{ collection.name }}</h2>
          <StatusBadge :status="collection.status" />
        </div>
        <p v-if="collection.alsoKnownAs" class="text-sm text-ink-700">Also known as {{ collection.alsoKnownAs }}</p>
        <p class="text-sm text-ink-500">{{ collection.description }}</p>
        <p class="text-xs font-medium text-ink-700" data-testid="collection-count">{{ countLabel({ collectionId: collection.id }) }}</p>
      </header>

      <CollectionBrief v-if="collection.brief" :collection="collection" />
      <details v-else class="rounded-xl border border-line bg-surface px-4 py-3 text-sm" data-testid="collection-reference">
        <summary class="cursor-pointer font-medium text-ink-700">
          Design direction
        </summary>
        <div class="mt-2 space-y-1 text-ink-500">
          <p>{{ collection.reference.notes }}</p>
        </div>
      </details>

      <section aria-labelledby="sb-templates">
        <h3 id="sb-templates" class="mb-2 text-sm font-semibold tracking-wide text-ink-700 uppercase">Templates</h3>
        <p v-if="templates.length === 0" class="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-ink-500" data-testid="collection-empty">
          Templates for this collection are in development and can't be previewed or selected yet.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="t in templates"
            :key="t.id"
            :class="[
              itemClass,
              'flex-row items-center gap-3 px-3',
              t.id === previewedId ? 'border-rose-500 bg-rose-50/60' : 'border-line',
              (t.status === 'available' || t.status === 'draft') && 'hover:border-rose-500',
            ]"
            :data-theme-card="t.id"
            :data-status="t.status"
          >
            <img
              v-if="t.status === 'available' || t.status === 'draft'"
              :src="t.previewImage"
              alt=""
              class="h-12 w-[4.8rem] shrink-0 rounded-md object-cover ring-1 ring-line"
              loading="lazy"
            />
            <span
              v-else
              class="h-12 w-[4.8rem] shrink-0 rounded-md bg-[repeating-linear-gradient(135deg,var(--color-canvas),var(--color-canvas)_6px,var(--color-rose-50)_6px,var(--color-rose-50)_12px)] ring-1 ring-line"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <h4 class="font-display text-lg leading-tight font-semibold">
                <RouterLink
                  v-if="t.status === 'available' || t.status === 'draft'"
                  :to="templateRoute(t)"
                  class="outline-none after:absolute after:inset-0"
                  :aria-current="t.id === previewedId ? 'true' : undefined"
                  :aria-label="`Preview ${t.name}`"
                  @click="emit('navigate')"
                >
                  {{ t.name }}
                </RouterLink>
                <template v-else>{{ t.name }}</template>
              </h4>
              <p class="truncate text-xs text-ink-500">
                <template v-if="t.id === previewedId">Previewing · </template>{{ t.regionalVariation ?? t.tagline }}
              </p>
            </div>
            <StatusBadge :status="selection.selectedThemeId === t.id ? 'selected' : t.status" />
          </li>
        </ul>
      </section>
    </template>
  </nav>
</template>
