<script setup lang="ts">
/** Organisation (corporate): logo, name, tagline, description, website. */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent }>()
const { t } = useTv()
const org = computed(() => props.content.organization!)
</script>

<template>
  <section data-section="organization" class="tv-section tv-org">
    <div class="tv-inner tv-center">
      <div v-if="org.logo" class="tv-org__logo"><ThemeImage :image="org.logo" /></div>
      <p class="tv-kicker">{{ t('tvPresentedBy') }}</p>
      <h2 class="tv-h2" dir="auto">{{ org.name || org.tagline }}</h2>
      <p v-if="org.name && org.tagline" class="tv-lead" dir="auto">{{ org.tagline }}</p>
      <p v-if="org.description" class="tv-body tv-pre" dir="auto">{{ org.description }}</p>
      <p v-if="org.websiteUrl">
        <a class="tv-link" :href="org.websiteUrl" target="_blank" rel="noopener noreferrer" data-role="website">
          {{ t('tvVisitWebsite') }}<span aria-hidden="true"> ↗</span><span class="universal-visually-hidden"> {{ t('tvOpensNewTab') }}</span>
        </a>
      </p>
    </div>
  </section>
</template>
