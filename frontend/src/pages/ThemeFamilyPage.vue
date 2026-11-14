<script setup lang="ts">
/** Step 2: browse the collections in a family. (Single-collection families skip straight to step 3; see router.) */
import { computed } from 'vue'

import { availableTemplatesOf, collectionsOf, getFamily, templatesOf } from '@/features/themes/core/registry'
import type { ThemeCollection } from '@/features/themes/core/types'
import CollectionCover from '@/features/themes/picker/CollectionCover.vue'
import PickerBreadcrumbs from '@/features/themes/picker/PickerBreadcrumbs.vue'
import SelectionSummary from '@/features/themes/picker/SelectionSummary.vue'
import StatusBadge from '@/features/themes/picker/StatusBadge.vue'

const props = defineProps<{ familyId: string }>()

const family = computed(() => getFamily(props.familyId))
const collections = computed(() => collectionsOf(props.familyId))
const availableCollections = computed(() => collections.value.filter((c) => c.status === 'available'))
const upcomingCollections = computed(() => collections.value.filter((c) => c.status !== 'available'))

function detail(c: ThemeCollection) {
  const available = availableTemplatesOf(c.id).length
  const planned = templatesOf(c.id).length - available
  if (available) return `${available} template${available === 1 ? '' : 's'}`
  if (planned) return `${planned} template${planned === 1 ? '' : 's'} planned`
  return 'In development'
}
</script>

<template>
  <div v-if="family" class="space-y-10">
    <section class="space-y-3">
      <PickerBreadcrumbs :family="family" />
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-4xl font-semibold sm:text-5xl">{{ family.name }}</h1>
        <StatusBadge v-if="family.status !== 'available'" :status="family.status" />
      </div>
      <p class="text-lg text-ink-700">{{ family.tagline }}</p>
      <p class="max-w-2xl text-ink-500">{{ family.description }}</p>
    </section>

    <SelectionSummary />

    <section
      v-if="collections.length === 0"
      class="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-10 text-center"
      data-testid="family-coming-soon"
    >
      <h2 class="text-2xl font-semibold">Designs in progress</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-ink-500">
        We're crafting the first {{ family.name }} templates. In the meantime, explore our other families.
      </p>
      <RouterLink :to="{ name: 'themes' }" class="mt-5 inline-block text-sm font-medium text-rose-600 hover:text-rose-700">
        ← All families
      </RouterLink>
    </section>

    <template v-else>
      <section v-if="availableCollections.length" aria-labelledby="available-heading">
        <h2 id="available-heading" class="mb-4 text-xl font-semibold">Available now</h2>
        <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="c in availableCollections" :key="c.id" :data-collection-card="c.id">
            <RouterLink
              :to="{ name: 'theme-collection', params: { familyId: family.id, collectionId: c.id } }"
              class="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-colors hover:border-rose-500"
            >
              <CollectionCover :collection="c" />
              <div class="flex flex-1 flex-col gap-2 p-5">
                <h3 class="text-2xl font-semibold">{{ c.name }}</h3>
                <p v-if="c.reference.region" class="text-xs font-medium tracking-wide text-ink-500 uppercase">
                  {{ c.reference.region }}
                </p>
                <p class="flex-1 text-sm text-ink-500">{{ c.description }}</p>
                <p class="mt-2 text-sm font-medium text-rose-600">{{ detail(c) }} <span aria-hidden="true">→</span></p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="upcomingCollections.length" aria-labelledby="upcoming-heading">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="upcoming-heading" class="text-xl font-semibold">Coming soon</h2>
          <p class="text-sm text-ink-500">Developed and released with cultural review.</p>
        </div>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <li v-for="c in upcomingCollections" :key="c.id" :data-collection-card="c.id">
            <RouterLink
              :to="{ name: 'theme-collection', params: { familyId: family.id, collectionId: c.id } }"
              class="flex h-full flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-rose-500"
            >
              <span class="font-display text-xl font-semibold text-ink-900">{{ c.name }}</span>
              <span v-if="c.reference.region" class="text-xs text-ink-500">{{ c.reference.region }}</span>
              <span class="mt-1 text-xs font-medium text-rose-600">{{ detail(c) }}</span>
            </RouterLink>
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
