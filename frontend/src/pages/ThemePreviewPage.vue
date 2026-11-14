<script setup lang="ts">
/**
 * Full-screen preview: the template exactly as guests will see it.
 * The control bar sits ABOVE the invitation (sticky, not overlaid on it), and
 * the invitation's "one screen" height excludes the bar, so no content is hidden.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { previewableTemplatesOf, templatePath } from '@/features/themes/core/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import type { RenderableTemplate } from '@/features/themes/core/types'
import { ACTION } from '@/features/themes/picker/format'
import { collectionRoute, previewRoute } from '@/features/themes/picker/routes'
import SelectTemplateButton from '@/features/themes/picker/SelectTemplateButton.vue'
import { sampleWedding } from '@/features/wedding/sampleWedding'

// Route params are canonical here (see picker/guards.ts).
const props = defineProps<{ familyId?: string; collectionId?: string; templateSlug?: string }>()
const route = useRoute()
const router = useRouter()

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
      aria-label="Preview controls"
    >
      <div class="mx-auto flex h-[var(--toolbar-h)] max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <RouterLink
          :to="collectionRoute(path.family.id, path.collection.id)"
          class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-rose-50"
          :aria-label="`Back to ${path.collection.name} collection`"
        >
          <span aria-hidden="true">←</span><span class="hidden md:inline">Back</span>
        </RouterLink>

        <nav aria-label="Breadcrumb" class="min-w-0 flex-1 text-sm">
          <ol class="flex items-center gap-1.5 truncate text-ink-500">
            <li class="hidden truncate lg:block">{{ path.family.name }}</li>
            <li class="hidden lg:block" aria-hidden="true">›</li>
            <li class="hidden truncate sm:block">{{ path.collection.name }}</li>
            <li class="hidden sm:block" aria-hidden="true">›</li>
            <li aria-current="page" class="truncate font-medium text-ink-900">{{ template.name }}</li>
          </ol>
        </nav>

        <template v-if="siblings.length > 1">
          <label class="sr-only" for="fs-template">Template to preview</label>
          <select
            id="fs-template"
            :value="template.id"
            class="max-w-[9rem] rounded-lg border border-line bg-surface px-2 py-2 text-sm sm:max-w-none"
            @change="switchTo(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in siblings" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </template>

        <SelectTemplateButton :template-id="template.id" :template-name="template.name" size="sm" class="shrink-0" />
      </div>
      <p
        v-if="notFound"
        class="border-t border-line bg-danger-50 px-4 py-2 text-center text-xs text-danger-600"
        role="status"
        data-testid="preview-not-found"
      >
        Template "{{ notFound }}" doesn't exist — showing {{ template.name }} instead.
      </p>
    </header>

    <main :aria-label="`${template.name} ${ACTION.preview.toLowerCase()} with sample wedding content`">
      <ThemeRenderer :content="sampleWedding" :theme-id="template.id" viewport-height="calc(100svh - var(--toolbar-h))" />
    </main>
  </div>
</template>
