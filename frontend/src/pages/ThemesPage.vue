<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import { DEFAULT_THEME_ID, THEMES, getTheme } from '@/features/themes/core/registry'
import DevicePreview, { type Device } from '@/features/themes/preview/DevicePreview.vue'
import { sampleWedding } from '@/features/wedding/sampleWedding'
import { useThemeSelectionStore } from '@/stores/themeSelection'

const selection = useThemeSelectionStore()

const previewId = ref(selection.selectedThemeId ?? DEFAULT_THEME_ID)
const previewTheme = computed(() => getTheme(previewId.value)!)
const device = ref<Device>('phone')
const previewEl = ref<HTMLElement | null>(null)

const devices: { id: Device; label: string }[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
]

function preview(id: string) {
  previewId.value = id
  previewEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="space-y-12">
    <section>
      <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Step 1</p>
      <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">Choose your theme</h1>
      <p class="mt-3 max-w-2xl text-ink-500">
        Every theme uses the same content you'll fill in later, so you can switch designs at any time without
        retyping anything. Previews below use sample content.
      </p>
    </section>

    <!-- Theme cards -->
    <section aria-labelledby="themes-heading">
      <h2 id="themes-heading" class="sr-only">Available themes</h2>
      <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <li
          v-for="theme in THEMES"
          :key="theme.id"
          class="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--shadow-soft)] transition-colors"
          :class="selection.selectedThemeId === theme.id ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-line'"
          :data-theme-card="theme.id"
        >
          <button
            type="button"
            class="relative block aspect-[16/10] overflow-hidden bg-canvas"
            :aria-label="`Preview ${theme.name}`"
            @click="preview(theme.id)"
          >
            <img
              :src="theme.previewImage"
              :alt="`${theme.name} theme thumbnail`"
              class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <span
              v-if="selection.selectedThemeId === theme.id"
              class="absolute top-3 left-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-medium text-white"
            >
              Selected
            </span>
          </button>
          <div class="flex flex-1 flex-col p-5">
            <p class="text-xs font-medium tracking-wide text-ink-500 uppercase">{{ theme.category }}</p>
            <h3 class="mt-1 text-2xl font-semibold">{{ theme.name }}</h3>
            <p class="mt-1 text-sm font-medium text-ink-700">{{ theme.tagline }}</p>
            <p class="mt-2 flex-1 text-sm text-ink-500">{{ theme.description }}</p>
            <div class="mt-5 flex flex-wrap gap-2">
              <BaseButton variant="secondary" @click="preview(theme.id)">Preview</BaseButton>
              <BaseButton
                :variant="selection.selectedThemeId === theme.id ? 'ghost' : 'primary'"
                :disabled="selection.selectedThemeId === theme.id"
                @click="selection.select(theme.id)"
              >
                {{ selection.selectedThemeId === theme.id ? 'Selected' : 'Select theme' }}
              </BaseButton>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!-- Live preview -->
    <section ref="previewEl" aria-labelledby="preview-heading" class="scroll-mt-24 space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Live preview</p>
          <h2 id="preview-heading" class="mt-1 text-3xl font-semibold">{{ previewTheme.name }}</h2>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <label class="sr-only" for="preview-theme">Theme</label>
          <select
            id="preview-theme"
            v-model="previewId"
            class="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option v-for="theme in THEMES" :key="theme.id" :value="theme.id">{{ theme.name }}</option>
          </select>
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
            :to="{ name: 'theme-preview', params: { themeId: previewId } }"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            Full screen ↗
          </RouterLink>
          <BaseButton
            :disabled="selection.selectedThemeId === previewId"
            @click="selection.select(previewId)"
          >
            {{ selection.selectedThemeId === previewId ? 'Selected' : 'Use this theme' }}
          </BaseButton>
        </div>
      </div>

      <DevicePreview :content="sampleWedding" :theme-id="previewId" :device="device" />
    </section>
  </div>
</template>
