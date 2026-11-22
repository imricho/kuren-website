<script setup lang="ts">
/** Gallery: lazy images in fixed-ratio frames (no layout shift). */
import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'

defineProps<{ content: WeddingContent }>()
</script>

<template>
  <section data-section="gallery" class="tv-section tv-gallery">
    <div class="tv-inner">
      <header class="tv-center">
        <h2 class="tv-h2" dir="auto">{{ content.gallery!.title }}</h2>
        <p v-if="content.gallery!.description" class="tv-lead tv-pre" dir="auto">{{ content.gallery!.description }}</p>
      </header>
      <ul class="tv-gallery__grid">
        <li v-for="image in content.gallery!.images" :key="image.id" class="tv-gallery__item">
          <figure>
            <div class="tv-gallery__photo"><ThemeImage :image="image" /></div>
            <figcaption v-if="image.caption" dir="auto">{{ image.caption }}</figcaption>
          </figure>
        </li>
      </ul>
    </div>
  </section>
</template>
