<script setup lang="ts">
/** Greeting (or the legacy opening headline/introduction fallback). */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import GreetingPrayer from '../../core/components/GreetingPrayer.vue'
import { greetingContent } from '../visibleSections'

const props = defineProps<{ content: WeddingContent }>()
const g = computed(() => greetingContent(props.content))
</script>

<template>
  <section v-if="g" data-section="greeting" class="tv-section tv-greeting">
    <div class="tv-inner tv-center">
      <h2 v-if="g.title?.trim()" class="tv-h2" dir="auto">{{ g.title.trim() }}</h2>
      <p v-if="g.message?.trim()" class="tv-lead tv-pre" dir="auto">{{ g.message.trim() }}</p>
      <GreetingPrayer :prayer="g.prayer" />
    </div>
  </section>
</template>
