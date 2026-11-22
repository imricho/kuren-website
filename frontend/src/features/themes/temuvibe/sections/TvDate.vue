<script setup lang="ts">
/** Main event date with the optional countdown (timer-only toggle) and Add to Calendar. */
import { computed } from 'vue'

import { formatDate } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import AddToCalendar from '../../core/components/AddToCalendar.vue'
import CountdownTimer from '../../core/components/CountdownTimer.vue'
import { useTv } from '../context'
import { dateHeadingKey, isWedding } from '../wording'

const props = defineProps<{ content: WeddingContent; calendarTitle: string }>()
const { t, locale, variant } = useTv()
const date = computed(() => formatDate(props.content.opening.weddingDate, locale.value, 'full'))
const showTimer = computed(() => props.content.countdown?.enabled !== false)
const showCalendar = computed(() => props.content.countdown?.addToCalendar === true)
const calTitle = computed(() => (isWedding(variant.value) ? undefined : props.calendarTitle))
</script>

<template>
  <section data-section="weddingDate" class="tv-section tv-date">
    <div class="tv-inner tv-center">
      <h2 class="tv-h2">{{ t(dateHeadingKey(variant)) }}</h2>
      <p class="tv-date__full"><time :datetime="content.opening.weddingDate">{{ date }}</time></p>
      <CountdownTimer v-if="showTimer" :content="content" />
      <AddToCalendar v-if="showCalendar" :content="content" :title="calTitle" />
    </div>
  </section>
</template>
