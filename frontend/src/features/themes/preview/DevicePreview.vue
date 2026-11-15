<script setup lang="ts">
/**
 * Renders a theme inside a resizable "device" frame. Because themes use
 * container queries, the phone/tablet frames show the real responsive layout.
 *
 * The frame fills the height its parent gives it. It is a size container, so
 * full-height invitation sections use `100cqh` (the frame's height) rather than
 * the browser viewport.
 */
import type { WeddingContent } from '@/features/wedding/types'

import ThemeRenderer from '../core/ThemeRenderer.vue'

export type Device = 'phone' | 'tablet' | 'desktop'

defineProps<{ content: WeddingContent; themeId: string; device: Device; label?: string }>()

const MAX_WIDTH: Record<Device, string> = { phone: '390px', tablet: '820px', desktop: '100%' }
</script>

<template>
  <div class="flex h-full justify-center">
    <div
      class="device-frame h-full w-full overflow-y-auto overscroll-contain rounded-[1.25rem] border border-line bg-white shadow-[var(--shadow-soft)] transition-[max-width] duration-300 [container-type:size]"
      :class="device === 'phone' && 'rounded-[2rem] border-[6px] border-ink-900'"
      :style="{ maxWidth: MAX_WIDTH[device] }"
      :data-device="device"
      role="region"
      :aria-label="`${label ?? 'Template preview'} at ${device} size — scrollable`"
      tabindex="0"
    >
      <ThemeRenderer :content="content" :theme-id="themeId" viewport-height="100cqh" embedded />
    </div>
  </div>
</template>
