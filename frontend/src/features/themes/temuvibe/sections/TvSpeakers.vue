<script setup lang="ts">
/** Speakers: photo, name, role · organisation, bio. Anchors let the agenda link here. */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent }>()
const { t } = useTv()
const people = computed(() => props.content.speakers?.people ?? [])
const heading = computed(() => props.content.speakers?.title?.trim() || t.value('tvSpeakers'))
const meta = (p: { role?: string; organization?: string }) => [p.role, p.organization].filter(Boolean).join(' · ')
</script>

<template>
  <section data-section="speakers" class="tv-section tv-speakers">
    <div class="tv-inner">
      <h2 class="tv-h2 tv-center" dir="auto">{{ heading }}</h2>
      <ul class="tv-speakers__grid" :data-count="people.length">
        <li v-for="p in people" :id="`tv-speaker-${p.id}`" :key="p.id" class="tv-card tv-speaker" :data-sample="p.id.startsWith('placeholder-') ? 'true' : undefined">
          <div v-if="p.image" class="tv-speaker__photo"><ThemeImage :image="p.image" /></div>
          <h3 class="tv-h3" dir="auto">{{ p.name }}</h3>
          <p v-if="meta(p)" class="tv-kicker tv-speaker__meta" dir="auto">{{ meta(p) }}</p>
          <p v-if="p.bio" class="tv-body tv-pre" dir="auto">{{ p.bio }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
