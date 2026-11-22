<script setup lang="ts">
/** Sessions (events): when, where (venue and/or online access), map, dress code / livestream, optional flag. */
import { computed } from 'vue'

import { eventTypeLabel, formatDate, formatTimeRange, labels, mapsLink } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import EventExtras from '../../core/components/EventExtras.vue'
import { useTv } from '../context'
import { eventsHeadingKey, isWedding } from '../wording'

const props = defineProps<{ content: WeddingContent }>()
const { t, locale, variant } = useTv()
const l = computed(() => labels(locale.value))
const sessions = computed(() =>
  props.content.events.map((e) => ({
    ...e,
    // "Wedding Ceremony" is the wedding wording of `ceremony`; other variants say "Ceremony".
    typeLabel: e.type === 'ceremony' && !isWedding(variant.value) ? t.value('tvCeremony') : eventTypeLabel(e.type, locale.value),
    dateText: e.endDate && e.endDate > e.date
      ? `${formatDate(e.date, locale.value, 'full')} – ${formatDate(e.endDate, locale.value, 'full')}`
      : formatDate(e.date, locale.value, 'full'),
    timeText: formatTimeRange(e.startTime, e.endTime, locale.value),
    // Online-only sessions have no venue and no map.
    mapHref: e.format === 'online' || !(e.venueName || e.address) ? '' : mapsLink(e),
  })),
)
const offersChoice = computed(() => props.content.rsvp.enabled && props.content.rsvp.allowSessionChoice === true)
</script>

<template>
  <section data-section="events" class="tv-section tv-sessions">
    <div class="tv-inner">
      <h2 class="tv-h2 tv-center">{{ t(eventsHeadingKey(variant, sessions.length)) }}</h2>
      <div class="tv-sessions__list" :data-count="sessions.length">
        <article v-for="s in sessions" :id="`tv-session-${s.id}`" :key="s.id" class="tv-card tv-session" :data-optional="s.optional ? 'true' : undefined">
          <p class="tv-kicker">
            {{ s.typeLabel }}
            <span v-if="s.optional" class="tv-badge" data-role="optional">{{ t('tvOptional') }}</span>
          </p>
          <h3 class="tv-h3" dir="auto">{{ s.title }}</h3>
          <p class="tv-session__when"><time :datetime="s.date">{{ s.dateText }}</time><br />{{ s.timeText }}</p>
          <p v-if="s.venueName" class="tv-session__venue" dir="auto">{{ s.venueName }}</p>
          <p v-if="s.address" class="tv-muted tv-pre" dir="auto">{{ s.address }}</p>
          <p v-if="s.description" class="tv-body tv-pre" dir="auto">{{ s.description }}</p>
          <EventExtras :event="s" :locale="locale" />
          <p v-if="s.optional && offersChoice" class="tv-muted tv-small">{{ t('tvOptionalNote') }}</p>
          <a v-if="s.mapHref" class="tv-link" :href="s.mapHref" target="_blank" rel="noopener noreferrer">{{ l.viewMap }}<span aria-hidden="true"> ↗</span><span class="universal-visually-hidden"> {{ t('tvOpensNewTab') }}</span></a>
        </article>
      </div>
    </div>
  </section>
</template>
