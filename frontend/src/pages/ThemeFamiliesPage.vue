<script setup lang="ts">
/** Step 1 of theme selection: choose a theme family. */
import { FAMILIES, availableCountInFamily, collectionsOf } from '@/features/themes/core/registry'
import SelectionSummary from '@/features/themes/picker/SelectionSummary.vue'
import StatusBadge from '@/features/themes/picker/StatusBadge.vue'

function countLabel(familyId: string) {
  const templates = availableCountInFamily(familyId)
  const collections = collectionsOf(familyId).length
  if (templates === 0) return 'In development'
  const t = `${templates} template${templates === 1 ? '' : 's'}`
  return collections > 1 ? `${t} · ${collections} collections` : t
}
</script>

<template>
  <div class="space-y-10">
    <section class="space-y-3">
      <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Step 1 · Choose a style</p>
      <h1 class="text-4xl font-semibold sm:text-5xl">Find your wedding style</h1>
      <p class="max-w-2xl text-ink-500">
        Start with a family of designs, then explore its collections and preview each template with sample content.
        Every template uses the same details you'll fill in later, so you can switch at any time.
      </p>
    </section>

    <SelectionSummary />

    <section aria-labelledby="families-heading">
      <h2 id="families-heading" class="sr-only">Theme families</h2>
      <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="family in FAMILIES" :key="family.id" :data-family-card="family.id">
          <RouterLink
            :to="{ name: 'theme-family', params: { familyId: family.id } }"
            class="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-colors hover:border-rose-500"
          >
            <div class="relative aspect-[16/10] overflow-hidden bg-canvas">
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
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-2xl font-semibold">{{ family.name }}</h3>
                <StatusBadge v-if="family.status !== 'available'" :status="family.status" />
              </div>
              <p class="text-sm font-medium text-ink-700">{{ family.tagline }}</p>
              <p class="flex-1 text-sm text-ink-500">{{ family.description }}</p>
              <p class="mt-2 text-sm font-medium text-rose-600">
                {{ countLabel(family.id) }} <span aria-hidden="true">→</span>
              </p>
            </div>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
