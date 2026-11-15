<script setup lang="ts">
/**
 * Full-screen preview: the template exactly as guests will see it.
 * The control bar sits ABOVE the invitation (sticky, not overlaid on it), and
 * the invitation's "one screen" height excludes the bar, so no content is hidden.
 */
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { previewableTemplatesOf, templatePath } from '@/features/themes/core/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import type { RenderableTemplate } from '@/features/themes/core/types'
import { collectionRoute, previewRoute } from '@/features/themes/picker/routes'
import SelectTemplateButton from '@/features/themes/picker/SelectTemplateButton.vue'
import { sampleWedding } from '@/features/wedding/sampleWedding'
import AppLanguageSwitch from '@/components/AppLanguageSwitch.vue'
import { localizedActions } from '@/features/themes/picker/format'
import { localizedCatalogText, useAppLocale } from '@/composables/useAppLocale'
import { useWeddingStore } from '@/stores/wedding'

// Route params are canonical here (see picker/guards.ts).
const props = defineProps<{ familyId?: string; collectionId?: string; templateSlug?: string }>()
const route = useRoute()
const router = useRouter()
const { t } = useAppLocale()
const action = computed(() => localizedActions())
const wedding = useWeddingStore()
// The selected theme lives on the wedding record (this page is outside AppLayout).
onMounted(() => void wedding.ensureLoaded())

const path = computed(() => templatePath(props.templateSlug))
const template = computed(() => path.value?.template as RenderableTemplate | undefined)
const siblings = computed(() => (path.value ? previewableTemplatesOf(path.value.collection.id) : []))
const notFound = computed(() => (typeof route.query.notFound === 'string' ? route.query.notFound : null))

function switchTo(id: string) {
  const next = siblings.value.find((t) => t.id === id)
  if (next) router.replace(previewRoute(next))
}
</script>

<template>
  <div v-if="path && template" class="min-h-dvh bg-canvas" style="--toolbar-h: 3.5rem">
    <header
      class="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur"
      :aria-label="t('preview')"
    >
      <div class="mx-auto flex h-[var(--toolbar-h)] max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <RouterLink
          :to="collectionRoute(path.family.id, path.collection.id)"
          class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-rose-50"
          :aria-label="`${t('back')} ${localizedCatalogText(path.collection.id, 'name', path.collection.name)} ${t('collection').toLowerCase()}`"
        >
          <span aria-hidden="true">←</span><span class="hidden md:inline">{{ t('back') }}</span>
        </RouterLink>

        <nav :aria-label="t('previewLocation')" class="min-w-0 flex-1 text-sm">
          <ol class="flex items-center gap-1.5 truncate text-ink-500">
            <li class="hidden truncate lg:block">{{ localizedCatalogText(path.family.id, 'name', path.family.name) }}</li>
            <li class="hidden lg:block" aria-hidden="true">›</li>
            <li class="hidden truncate sm:block">{{ localizedCatalogText(path.collection.id, 'name', path.collection.name) }}</li>
            <li class="hidden sm:block" aria-hidden="true">›</li>
            <li aria-current="page" class="truncate font-medium text-ink-900">{{ template.name }}</li>
          </ol>
        </nav>

        <template v-if="siblings.length > 1">
          <label class="sr-only" for="fs-template">{{ t('templatePreview') }}</label>
          <select
            id="fs-template"
            :value="template.id"
            class="min-w-0 max-w-[7rem] rounded-lg border border-line bg-surface px-2 py-2 text-sm sm:max-w-none"
            @change="switchTo(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in siblings" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </template>

        <!-- Hidden on phones so the bar fits; the language switch stays in the main app header. -->
        <span class="hidden sm:inline-flex"><AppLanguageSwitch /></span>
        <SelectTemplateButton :template-id="template.id" :template-name="template.name" size="sm" class="shrink-0" />
      </div>
      <p
        v-if="notFound"
        class="border-t border-line bg-danger-50 px-4 py-2 text-center text-xs text-danger-600"
        role="status"
        data-testid="preview-not-found"
      >
        {{ t('templateMissing', { name: notFound, fallback: template.name }) }}
      </p>
    </header>

    <main :aria-label="`${template.name} ${action.preview.toLowerCase()} · ${t('sampleWedding')}`">
      <ThemeRenderer :content="sampleWedding" :theme-id="template.id" viewport-height="calc(100svh - var(--toolbar-h))" />
    </main>
  </div>
</template>
