<script setup lang="ts">
/** Step 3: view the templates in a collection, preview them, and select one. */
import { computed, nextTick, ref, watch } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import {
  availableTemplatesOf,
  collectionsOf,
  getCollection,
  getFamily,
  templatesOf,
} from '@/features/themes/core/registry'
import LivePreview from '@/features/themes/picker/LivePreview.vue'
import PickerBreadcrumbs from '@/features/themes/picker/PickerBreadcrumbs.vue'
import SelectionSummary from '@/features/themes/picker/SelectionSummary.vue'
import StatusBadge from '@/features/themes/picker/StatusBadge.vue'
import { useThemeSelectionStore } from '@/stores/themeSelection'

const props = defineProps<{ familyId: string; collectionId: string }>()
const selection = useThemeSelectionStore()

const family = computed(() => getFamily(props.familyId))
const collection = computed(() => {
  const c = getCollection(props.collectionId)
  return c && c.familyId === props.familyId ? c : undefined
})
// When the family has only this collection, the family page was skipped — so is its breadcrumb level.
const isOnlyCollection = computed(() => collectionsOf(props.familyId).length === 1)
const templates = computed(() => templatesOf(props.collectionId))
const available = computed(() => availableTemplatesOf(props.collectionId))

const previewId = ref('')
watch(
  available,
  (list) => {
    previewId.value = list.find((t) => t.id === selection.selectedThemeId)?.id ?? list[0]?.id ?? ''
  },
  { immediate: true },
)

const previewEl = ref<HTMLElement | null>(null)
async function preview(id: string) {
  previewId.value = id
  await nextTick()
  previewEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div v-if="family && collection" class="space-y-10">
    <section class="space-y-3">
      <PickerBreadcrumbs :family="family" :collection="isOnlyCollection ? undefined : collection" />
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-4xl font-semibold sm:text-5xl">{{ isOnlyCollection ? family.name : collection.name }}</h1>
        <StatusBadge v-if="collection.status !== 'available'" :status="collection.status" />
      </div>
      <p class="max-w-2xl text-ink-500">{{ isOnlyCollection ? family.description : collection.description }}</p>
    </section>

    <!-- Design / cultural reference -->
    <aside
      class="grid gap-1 rounded-xl border border-line bg-surface px-5 py-4 text-sm sm:grid-cols-[10rem_1fr]"
      aria-label="About this collection"
      data-testid="collection-reference"
    >
      <p class="font-medium text-ink-700">
        {{ collection.reference.kind === 'cultural' ? 'Cultural reference' : 'Design reference' }}
      </p>
      <div class="space-y-1 text-ink-500">
        <p v-if="collection.reference.region"><span class="text-ink-700">{{ collection.reference.region }}</span></p>
        <p>{{ collection.reference.notes }}</p>
        <p v-if="collection.reference.review === 'needs_review'" class="text-xs text-rose-700">
          Templates in this collection are released only after review with cultural advisers.
        </p>
      </div>
    </aside>

    <SelectionSummary />

    <!-- Templates -->
    <section aria-labelledby="templates-heading">
      <h2 id="templates-heading" class="mb-4 text-xl font-semibold">Templates</h2>

      <p v-if="templates.length === 0" class="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-500" data-testid="collection-empty">
        Templates for this collection are in development.
      </p>

      <ul v-else class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <li
          v-for="t in templates"
          :key="t.id"
          class="flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--shadow-soft)]"
          :class="selection.selectedThemeId === t.id ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-line'"
          :data-theme-card="t.id"
          :data-status="t.status"
        >
          <button
            v-if="t.status === 'available'"
            type="button"
            class="group relative block aspect-[16/10] overflow-hidden bg-canvas"
            :aria-label="`Preview ${t.name}`"
            @click="preview(t.id)"
          >
            <img
              :src="t.previewImage"
              :alt="`${t.name} template thumbnail`"
              class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
          <div
            v-else
            class="flex aspect-[16/10] items-center justify-center bg-[repeating-linear-gradient(135deg,var(--color-canvas),var(--color-canvas)_10px,var(--color-rose-50)_10px,var(--color-rose-50)_20px)]"
            aria-hidden="true"
          >
            <span class="font-display text-2xl text-ink-500">{{ t.name }}</span>
          </div>

          <div class="flex flex-1 flex-col gap-2 p-5">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-2xl font-semibold">{{ t.name }}</h3>
              <StatusBadge :status="selection.selectedThemeId === t.id ? 'selected' : t.status" />
            </div>
            <p v-if="t.regionalVariation" class="text-xs font-medium tracking-wide text-ink-500 uppercase">
              {{ t.regionalVariation }}
            </p>
            <p class="text-sm font-medium text-ink-700">{{ t.tagline }}</p>
            <p class="flex-1 text-sm text-ink-500">{{ t.description }}</p>
            <div v-if="t.status === 'available'" class="mt-3 flex flex-wrap gap-2">
              <BaseButton variant="secondary" @click="preview(t.id)">Preview</BaseButton>
              <BaseButton
                :variant="selection.selectedThemeId === t.id ? 'ghost' : 'primary'"
                :disabled="selection.selectedThemeId === t.id"
                @click="selection.select(t.id)"
              >
                {{ selection.selectedThemeId === t.id ? 'Selected' : 'Select template' }}
              </BaseButton>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="available.length" ref="previewEl" class="scroll-mt-24">
      <LivePreview v-model="previewId" :templates="available" />
    </div>
  </div>

  <div v-else class="space-y-4 py-10 text-center">
    <h1 class="text-3xl font-semibold">Collection not found</h1>
    <RouterLink :to="{ name: 'themes' }" class="text-sm font-medium text-rose-600 hover:text-rose-700">← All families</RouterLink>
  </div>
</template>
