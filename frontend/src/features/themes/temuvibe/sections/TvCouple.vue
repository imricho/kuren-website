<script setup lang="ts">
/** The couple (wedding, engagement, anniversary). */
import { computed } from 'vue'

import { labels } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent }>()
const { t, locale } = useTv()
const l = computed(() => labels(locale.value))
const people = computed(() =>
  [
    { key: 'groom', role: l.value.groom, person: props.content.couple.groom },
    { key: 'bride', role: l.value.bride, person: props.content.couple.bride },
  ].filter((p) => p.person?.name?.trim()),
)
</script>

<template>
  <section data-section="couple" class="tv-section tv-people">
    <div class="tv-inner">
      <h2 class="tv-h2 tv-center">{{ t('tvCouple') }}</h2>
      <div class="tv-people__grid">
        <article v-for="p in people" :key="p.key" class="tv-person">
          <div v-if="p.person.image" class="tv-person__photo"><ThemeImage :image="p.person.image" /></div>
          <p class="tv-kicker">{{ p.role }}</p>
          <h3 class="tv-h3" dir="auto">{{ p.person.name }}</h3>
          <p v-if="p.person.parents" class="tv-muted tv-pre" data-role="parents" dir="auto">{{ p.person.parents }}</p>
          <p v-if="p.person.description" class="tv-body tv-pre" dir="auto">{{ p.person.description }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
