<script setup lang="ts">
/**
 * A live, clipped rendering of the template's actual hero. This keeps picker
 * thumbnails in sync with its renderer, visual preset and current styles.
 */
import { universalDemo } from '@/features/wedding/universalDemo'

import ThemeRenderer from '../core/ThemeRenderer.vue'
import type { RenderableTemplate } from '../core/types'

defineProps<{ template: RenderableTemplate }>()
</script>

<template>
  <div class="template-thumbnail" aria-hidden="true" inert>
    <img class="template-thumbnail__fallback" :src="template.previewImage" alt="" loading="lazy" />
    <div class="template-thumbnail__viewport">
      <ThemeRenderer :content="universalDemo" :theme-id="template.id" viewport-height="500px" />
    </div>
  </div>
</template>

<style scoped>
.template-thumbnail {
  position: relative;
  width: 7rem;
  height: 4.5rem;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 0.375rem;
  background: #f4f0e8;
  box-shadow: 0 0 0 1px rgb(70 55 45 / 0.14);
  pointer-events: none;
  contain: paint;
}

.template-thumbnail__fallback,
.template-thumbnail__viewport {
  position: absolute;
  inset: 0 auto auto 0;
  width: 768px;
  height: 500px;
}

.template-thumbnail__fallback {
  object-fit: cover;
  object-position: top center;
}

.template-thumbnail__viewport {
  overflow: hidden;
  container-type: size;
  transform: scale(0.1458333);
  transform-origin: top left;
}

.template-thumbnail__viewport :deep(.wedding-site) {
  min-height: 500px;
  background: white;
}
</style>
