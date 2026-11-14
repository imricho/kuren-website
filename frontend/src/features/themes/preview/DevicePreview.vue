<script setup lang="ts">
/**
 * Renders a theme inside a resizable "device" frame. Because themes use
 * container queries, the phone/tablet frames show the real responsive layout.
 */
import type { WeddingContent } from '@/features/wedding/types'

import ThemeRenderer from '../core/ThemeRenderer.vue'

export type Device = 'phone' | 'tablet' | 'desktop'

defineProps<{ content: WeddingContent; themeId: string; device: Device }>()

const FRAME: Record<Device, { width: string; height: number }> = {
  phone: { width: '390px', height: 780 },
  tablet: { width: '820px', height: 860 },
  desktop: { width: '100%', height: 820 },
}
</script>

<template>
  <div class="flex justify-center">
    <div
      class="device-frame w-full overflow-y-auto overscroll-contain rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-soft)] transition-[max-width] duration-300"
      :class="device === 'phone' && 'rounded-[2rem] border-[6px] border-ink-900'"
      :style="{ maxWidth: FRAME[device].width, height: `${FRAME[device].height}px` }"
      :data-device="device"
    >
      <ThemeRenderer :content="content" :theme-id="themeId" :viewport-height="`${FRAME[device].height - 12}px`" />
    </div>
  </div>
</template>
