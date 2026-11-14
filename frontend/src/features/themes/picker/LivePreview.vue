<script setup lang="ts">
/** Inline preview of a collection's templates: device sizes, full-screen link and selection. */
import { computed, ref } from 'vue'

import { sampleWedding } from '@/features/wedding/sampleWedding'

import { templatePath } from '../core/registry'
import type { RenderableTemplate } from '../core/types'
import DevicePreview, { type Device } from '../preview/DevicePreview.vue'
import DeviceSizeControl from './DeviceSizeControl.vue'
import { ACTION } from './format'
import { previewRoute } from './routes'
import SelectTemplateButton from './SelectTemplateButton.vue'

const props = defineProps<{ templates: RenderableTemplate[] }>()
const previewId = defineModel<string>({ required: true })

const device = ref<Device>('phone')
const active = computed(() => props.templates.find((t) => t.id === previewId.value) ?? props.templates[0]!)
const path = computed(() => templatePath(active.value.id)!)
</script>

<template>
  <section aria-labelledby="preview-heading" class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Previewing</p>
        <h2 id="preview-heading" class="mt-1 text-3xl font-semibold">{{ active.name }}</h2>
        <p class="mt-1 text-sm text-ink-500">{{ path.family.name }} › {{ path.collection.name }} · sample wedding</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="templates.length > 1">
          <label class="sr-only" for="preview-template">Template to preview</label>
          <select id="preview-template" v-model="previewId" class="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </template>
        <DeviceSizeControl v-model="device" />
        <RouterLink :to="previewRoute(active)" class="rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:text-rose-700">
          {{ ACTION.fullScreen }} <span aria-hidden="true">↗</span>
        </RouterLink>
        <SelectTemplateButton :template-id="active.id" :template-name="active.name" />
      </div>
    </div>

    <DevicePreview :content="sampleWedding" :theme-id="active.id" :device="device" :label="`${active.name} preview`" />
  </section>
</template>
