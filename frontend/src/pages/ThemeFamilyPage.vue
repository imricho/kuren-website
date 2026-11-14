<script setup lang="ts">
/**
 * Step 2: choose a collection. Every family shows this step — including
 * single-collection and planned families — so the flow is always
 * Family → Collection → Template.
 */
import { computed } from 'vue'

import { collectionsOf, getFamily } from '@/features/themes/core/registry'
import CollectionCover from '@/features/themes/picker/CollectionCover.vue'
import { countLabel } from '@/features/themes/picker/format'
import PickerBreadcrumbs from '@/features/themes/picker/PickerBreadcrumbs.vue'
import PickerSteps from '@/features/themes/picker/PickerSteps.vue'
import { collectionRoute } from '@/features/themes/picker/routes'
import SelectionSummary from '@/features/themes/picker/SelectionSummary.vue'
import StatusBadge from '@/features/themes/picker/StatusBadge.vue'

const props = defineProps<{ familyId: string }>()

const family = computed(() => getFamily(props.familyId))
const collections = computed(() => collectionsOf(props.familyId))
// Design collections (e.g. the culturally neutral Nusantara Heritage) are shown apart from regional cultural ones.
const general = computed(() => collections.value.filter((c) => c.reference.kind === 'design'))
const regional = computed(() => collections.value.filter((c) => c.reference.kind === 'cultural'))
const regionalAvailable = computed(() => regional.value.filter((c) => c.status === 'available').length)
</script>

<template>
  <div v-if="family" class="space-y-10">
    <section class="space-y-3">
      <PickerSteps :current="2" />
      <PickerBreadcrumbs :family="family" />
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-4xl font-semibold sm:text-5xl">{{ family.name }}</h1>
        <StatusBadge :status="family.status" />
      </div>
      <p class="text-lg text-ink-700">{{ family.tagline }}</p>
      <p class="max-w-2xl text-ink-500">{{ family.description }}</p>
    </section>

    <SelectionSummary />

    <!-- Planned family: the collection step exists but is empty. -->
    <section
      v-if="collections.length === 0"
      class="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-10 text-center"
      aria-labelledby="empty-heading"
      data-testid="family-coming-soon"
    >
      <h2 id="empty-heading" class="text-2xl font-semibold">Collections in development</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-ink-500">
        {{ family.name }} is a planned family. Its collections and templates aren't available to preview or select yet.
      </p>
      <RouterLink :to="{ name: 'themes' }" class="mt-5 inline-block rounded text-sm font-medium text-rose-600 hover:text-rose-700">
        ← Browse available families
      </RouterLink>
    </section>

    <template v-else>
      <!-- General / design collections -->
      <section v-if="general.length" aria-labelledby="general-heading">
        <div class="mb-4 space-y-1">
          <h2 id="general-heading" class="text-xl font-semibold">
            {{ regional.length ? 'General collection' : general.length === 1 ? 'Collection' : 'Collections' }}
          </h2>
          <p v-if="regional.length" class="text-sm text-ink-500">
            Culturally neutral designs, not tied to any single regional tradition.
          </p>
        </div>
        <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <li
            v-for="c in general"
            :key="c.id"
            :data-collection-card="c.id"
            :data-status="c.status"
            class="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-colors focus-within:ring-2 focus-within:ring-rose-500 hover:border-rose-500"
          >
            <CollectionCover :collection="c" />
            <div class="flex flex-1 flex-col gap-2 p-5">
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-2xl font-semibold">
                  <RouterLink :to="collectionRoute(family.id, c.id)" class="outline-none after:absolute after:inset-0">
                    {{ c.name }}
                  </RouterLink>
                </h3>
                <StatusBadge :status="c.status" />
              </div>
              <p class="flex-1 text-sm text-ink-500">{{ c.description }}</p>
              <p class="mt-2 text-sm font-medium text-rose-600">
                {{ countLabel({ collectionId: c.id }) }} <span aria-hidden="true">→</span>
              </p>
            </div>
          </li>
        </ul>
      </section>

      <!-- Regional cultural collections -->
      <section v-if="regional.length" aria-labelledby="regional-heading">
        <div class="mb-4 space-y-1">
          <h2 id="regional-heading" class="text-xl font-semibold">
            Regional collections <span class="text-ink-500">· {{ regional.length }}</span>
          </h2>
          <p class="text-sm text-ink-500" data-testid="regional-summary">
            {{ regionalAvailable }} of {{ regional.length }} available. Each is designed and released with cultural review.
          </p>
        </div>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <li
            v-for="c in regional"
            :key="c.id"
            :data-collection-card="c.id"
            :data-status="c.status"
            class="relative flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-rose-500 hover:border-rose-500"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-display text-xl font-semibold text-ink-900">
                <RouterLink :to="collectionRoute(family.id, c.id)" class="outline-none after:absolute after:inset-0">
                  {{ c.name }}
                </RouterLink>
              </h3>
              <StatusBadge :status="c.status" />
            </div>
            <p v-if="c.alsoKnownAs" class="text-xs text-ink-700">Also known as {{ c.alsoKnownAs }}</p>
            <p v-if="c.reference.region" class="text-xs text-ink-500">{{ c.reference.region }}</p>
            <p class="mt-1 text-xs font-medium text-rose-600">{{ countLabel({ collectionId: c.id }) }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>

  <div v-else class="space-y-4 py-10 text-center">
    <h1 class="text-3xl font-semibold">Theme family not found</h1>
    <RouterLink :to="{ name: 'themes' }" class="text-sm font-medium text-rose-600 hover:text-rose-700">← All families</RouterLink>
  </div>
</template>
