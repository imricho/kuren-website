<script setup lang="ts">
/**
 * Live preview toolbar (docs/ux/live-editor.md §2): device (Phone/Desktop) and
 * zoom (Fit/100%) as native radio groups — arrow keys and "radio, 1 of 2"
 * semantics for free — then the theme name + Change link and Full screen.
 * `compact` (mobile Preview tab): zoom + an icon-only Full screen button.
 */
import { useId } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'

import type { PreviewDevice, PreviewZoom } from './frameBox'

defineProps<{ themeName: string; fullScreenTo: RouteLocationRaw; compact?: boolean }>()
const device = defineModel<PreviewDevice>('device', { required: true })
const zoom = defineModel<PreviewZoom>('zoom', { required: true })
const { t } = useAppLocale()
const uid = useId()

const devices = [
  { value: 'phone', label: 'previewDevicePhone' },
  { value: 'desktop', label: 'previewDeviceDesktop' },
] as const
const zooms = [
  { value: 'fit', label: 'previewZoomFit' },
  { value: 'actual', label: 'previewZoomActual' },
] as const

const segment =
  'flex h-8 cursor-pointer items-center rounded-full px-3 text-sm font-medium whitespace-nowrap text-ink-700 hover:text-ink-900 peer-checked:bg-rose-50 peer-checked:text-ink-900 peer-checked:shadow-[inset_0_0_0_1px_var(--color-rose-600)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-rose-600'
</script>

<template>
  <div
    class="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3"
    role="group"
    :aria-label="t('previewToolbarLabel')"
    data-testid="preview-toolbar"
  >
    <div
      v-if="!compact"
      role="radiogroup"
      :aria-label="t('previewDeviceGroup')"
      class="inline-flex shrink-0 rounded-full border border-line p-0.5"
      data-testid="preview-device"
    >
      <label v-for="d in devices" :key="d.value" class="relative">
        <input v-model="device" class="peer sr-only" type="radio" :name="`${uid}-device`" :value="d.value" :data-value="d.value" />
        <span :class="segment">{{ t(d.label) }}</span>
      </label>
    </div>

    <div
      role="radiogroup"
      :aria-label="t('previewZoomGroup')"
      class="inline-flex shrink-0 rounded-full border border-line p-0.5"
      data-testid="preview-zoom"
    >
      <label v-for="z in zooms" :key="z.value" class="relative">
        <input v-model="zoom" class="peer sr-only" type="radio" :name="`${uid}-zoom`" :value="z.value" :data-value="z.value" />
        <span :class="segment">{{ t(z.label) }}</span>
      </label>
    </div>

    <div v-if="!compact" class="ml-auto flex min-w-0 items-center gap-2">
      <span class="max-w-48 truncate text-sm text-ink-700" data-testid="preview-theme-name">{{ themeName }}</span>
      <RouterLink
        :to="{ name: 'themes' }"
        :aria-label="t('previewThemeChangeLabel', { name: themeName })"
        :class="['shrink-0 rounded text-sm font-medium text-rose-700 underline underline-offset-2', FOCUS_RING]"
        data-testid="preview-theme-change"
      >
        {{ t('previewThemeChange') }}
      </RouterLink>
    </div>

    <RouterLink
      :to="fullScreenTo"
      :class="[
        'flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-ink-700 hover:bg-rose-50 hover:text-ink-900',
        compact ? 'ml-auto size-11' : 'h-9 px-2.5',
        FOCUS_RING,
      ]"
      :aria-label="compact ? t('previewFullScreen') : undefined"
      data-testid="preview-fullscreen"
    >
      <svg class="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
      </svg>
      <span v-if="!compact" class="max-xl:sr-only">{{ t('previewFullScreen') }}</span>
    </RouterLink>
  </div>
</template>
