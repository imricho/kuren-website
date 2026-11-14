<script setup lang="ts">
/**
 * Renders a theme inside a resizable "device" frame. Because themes use
 * container queries, the phone/tablet frames show the real responsive layout.
 */
import type { WeddingContent } from '@/features/wedding/types'

import ThemeRenderer from '../core/ThemeRenderer.vue'

export type Device = 'phone' | 'tablet' | 'desktop'

defineProps<{ content: WeddingContent; themeId: string; device: Device; label?: string }>()

const FRAME: Record<Device, { width: string; height: number }> = {
  phone: { width: '390px', height: 780 },
  tablet: { width: '820px', height: 860 },
  desktop: { width: '100%', height: 820 },
}

/** Never taller than the visible screen, so the frame stays usable on short viewports. */
const frameHeight = (device: Device) => `min(${FRAME[device].height}px, calc(100svh - 7rem))`
</script>

<template>
  <div class="flex justify-center">
    <div
      class="device-frame w-full overflow-y-auto overscroll-contain rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-soft)] transition-[max-width] duration-300"
      :class="device === 'phone' && 'rounded-[2rem] border-[6px] border-ink-900'"
      :style="{ maxWidth: FRAME[device].width, height: frameHeight(device) }"
      :data-device="device"
      role="region"
      :aria-label="`${label ?? 'Template preview'} at ${device} size — scrollable`"
      tabindex="0"
    >
      <ThemeRenderer :content="content" :theme-id="themeId" :viewport-height="`calc(${frameHeight(device)} - 12px)`" />
    </div>
  </div>
</template>
