<script setup lang="ts">
/** Story / timeline. */
import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'

defineProps<{ content: WeddingContent }>()
</script>

<template>
  <section data-section="story" class="tv-section tv-story">
    <div class="tv-inner">
      <header class="tv-center">
        <h2 class="tv-h2" dir="auto">{{ content.story!.title }}</h2>
        <p v-if="content.story!.introduction" class="tv-lead tv-pre" dir="auto">{{ content.story!.introduction }}</p>
      </header>
      <ol class="tv-story__list">
        <li v-for="entry in content.story!.timeline" :key="entry.id" class="tv-story__entry">
          <div v-if="entry.image" class="tv-story__photo"><ThemeImage :image="entry.image" /></div>
          <p v-if="entry.date" class="tv-kicker" dir="auto">{{ entry.date }}</p>
          <h3 class="tv-h3" dir="auto">{{ entry.title }}</h3>
          <p class="tv-body tv-pre" dir="auto">{{ entry.description }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
