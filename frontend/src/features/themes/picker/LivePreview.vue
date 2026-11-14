<script setup lang="ts">
/** Live preview of one of the given templates, with device frames and selection. */
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import { sampleWedding } from '@/features/wedding/sampleWedding'
import { useThemeSelectionStore } from '@/stores/themeSelection'

import type { RenderableTemplate } from '../core/types'
import DevicePreview, { type Device } from '../preview/DevicePreview.vue'

const props = defineProps<{ templates: RenderableTemplate[] }>()
const previewId = defineModel<string>({ required: true })

const selection = useThemeSelectionStore()
const device = ref<Device>('phone')
const active = computed(() => props.templates.find((t) => t.id === previewId.value) ?? props.templates[0]!)

const devices: { id: Device; label: string }[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
]
</script>

<template>
  <section aria-labelledby="preview-heading" class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Live preview</p>
        <h2 id="preview-heading" class="mt-1 text-3xl font-semibold">{{ active.name }}</h2>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="templates.length > 1">
          <label class="sr-only" for="preview-template">Template</label>
          <select
            id="preview-template"
            v-model="previewId"
            class="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </template>
        <div class="inline-flex rounded-lg border border-line bg-surface p-1" role="group" aria-label="Device size">
          <button
            v-for="d in devices"
            :key="d.id"
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="device === d.id ? 'bg-rose-50 text-ink-900' : 'text-ink-500 hover:text-ink-900'"
            :aria-pressed="device === d.id"
            @click="device = d.id"
          >
            {{ d.label }}
          </button>
        </div>
        <RouterLink
          :to="{ name: 'theme-preview', params: { themeId: active.id } }"
          class="rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:text-rose-700"
        >
          Full screen ↗
        </RouterLink>
        <BaseButton :disabled="selection.selectedThemeId === active.id" @click="selection.select(active.id)">
          {{ selection.selectedThemeId === active.id ? 'Selected' : 'Use this template' }}
        </BaseButton>
      </div>
    </div>

    <DevicePreview :content="sampleWedding" :theme-id="active.id" :device="device" />
  </section>
</template>
