<script setup lang="ts">
/**
 * Right-hand preview: the previewed template (not necessarily the selected one),
 * its family/collection, device sizes, full-screen link and the single select action.
 */
import { computed, ref } from 'vue'

import { sampleWedding } from '@/features/wedding/sampleWedding'

import { templatePath } from '../core/registry'
import type { RenderableTemplate } from '../core/types'
import DevicePreview, { type Device } from '../preview/DevicePreview.vue'
import DeviceSizeControl from './DeviceSizeControl.vue'
import { ACTION } from './format'
import { collectionRoute, familyRoute, previewRoute } from './routes'
import SelectTemplateButton from './SelectTemplateButton.vue'

const props = defineProps<{ template: RenderableTemplate; notice?: string | null }>()

const device = ref<Device>('phone')
const path = computed(() => templatePath(props.template.id)!)
</script>

<template>
  <section aria-labelledby="preview-heading" class="flex h-full min-h-0 flex-col gap-4" data-testid="preview-pane">
    <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-rose-600 uppercase">Previewing · sample wedding</p>
        <h2 id="preview-heading" tabindex="-1" class="mt-1 text-3xl font-semibold outline-none">{{ template.name }}</h2>
        <nav aria-label="Previewed template location" class="mt-1 text-sm text-ink-500">
          <RouterLink :to="familyRoute(path.family.id)" class="rounded hover:text-ink-900">{{ path.family.name }}</RouterLink>
          <span aria-hidden="true"> › </span>
          <RouterLink :to="collectionRoute(path.family.id, path.collection.id)" class="rounded hover:text-ink-900">
            {{ path.collection.name }}
          </RouterLink>
          <span aria-hidden="true"> › </span>
          <span aria-current="page" class="text-ink-700">{{ template.name }}</span>
        </nav>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DeviceSizeControl v-model="device" />
        <RouterLink :to="previewRoute(template)" class="rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:text-rose-700">
          {{ ACTION.fullScreen }} <span aria-hidden="true">↗</span>
        </RouterLink>
        <SelectTemplateButton :template-id="template.id" :template-name="template.name" />
      </div>
    </header>

    <p v-if="notice" class="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-700 ring-1 ring-line" role="status" data-testid="preview-notice">
      {{ notice }}
    </p>

    <!-- Fills the remaining height on desktop; a fixed, screen-capped height when stacked. -->
    <div class="h-[min(760px,calc(100svh-7rem))] min-h-[420px] lg:h-auto lg:min-h-0 lg:flex-1">
      <DevicePreview :content="sampleWedding" :theme-id="template.id" :device="device" :label="`${template.name} preview`" />
    </div>
  </section>
</template>
