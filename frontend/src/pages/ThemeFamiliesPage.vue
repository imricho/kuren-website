<script setup lang="ts">
/** Step 1 of theme selection: choose a theme family. */
import { FAMILIES, collectionsOf } from '@/features/themes/core/registry'
import { countLabel } from '@/features/themes/picker/format'
import PickerSteps from '@/features/themes/picker/PickerSteps.vue'
import { familyRoute } from '@/features/themes/picker/routes'
import SelectionSummary from '@/features/themes/picker/SelectionSummary.vue'
import StatusBadge from '@/features/themes/picker/StatusBadge.vue'

const collectionCount = (familyId: string) => {
  const n = collectionsOf(familyId).length
  return n ? `${n} collection${n === 1 ? '' : 's'}` : 'No collections yet'
}
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-3">
      <PickerSteps :current="1" />
      <h1 class="text-4xl font-semibold sm:text-5xl">Find your wedding style</h1>
      <p class="max-w-2xl text-ink-500">
        Choose a family of designs, then a collection, then preview its templates with sample content. Previewing is
        free — nothing changes until you select a template, and you can switch at any time.
      </p>
    </section>

    <SelectionSummary />

    <section aria-labelledby="families-heading">
      <h2 id="families-heading" class="sr-only">Theme families</h2>
      <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <li
          v-for="family in FAMILIES"
          :key="family.id"
          :data-family-card="family.id"
          :data-status="family.status"
          class="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-colors focus-within:ring-2 focus-within:ring-rose-500 hover:border-rose-500"
        >
          <div class="aspect-[16/10] overflow-hidden bg-canvas">
            <img
              v-if="family.coverImage"
              :src="family.coverImage"
              alt=""
              class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              :class="family.status === 'coming_soon' && 'opacity-70 saturate-50'"
              loading="lazy"
            />
          </div>
          <div class="flex flex-1 flex-col gap-2 p-5">
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-2xl font-semibold">
                <RouterLink :to="familyRoute(family.id)" class="outline-none after:absolute after:inset-0">
                  {{ family.name }}
                </RouterLink>
              </h3>
              <StatusBadge :status="family.status" />
            </div>
            <p class="text-sm font-medium text-ink-700">{{ family.tagline }}</p>
            <p class="flex-1 text-sm text-ink-500">{{ family.description }}</p>
            <p class="mt-2 text-sm font-medium text-rose-600">
              {{ countLabel({ familyId: family.id }) }} · {{ collectionCount(family.id) }}
              <span aria-hidden="true">→</span>
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
