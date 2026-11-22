<script setup lang="ts">
/** Run-of-show, ordered by session then time, with linked speakers and sessions. */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import { orderAgenda } from '../agenda'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent; speakersShown: boolean }>()
const { t, locale } = useTv()

const sep = computed(() => (locale.value === 'id' ? '.' : ':'))
const fmt = (time: string) => time.replace(':', sep.value)
const sessionTitle = computed(() => new Map(props.content.events.map((e) => [e.id, e.title])))
const multiSession = computed(() => props.content.events.length > 1)
const speakers = computed(() => new Map((props.content.speakers?.people ?? []).map((p) => [p.id, p.name])))
const items = computed(() =>
  orderAgenda(props.content.agenda?.items ?? [], props.content.events.map((e) => e.id)).map((item) => ({
    ...item,
    speakerList: (item.speakerIds ?? []).flatMap((id) => (speakers.value.has(id) ? [{ id, name: speakers.value.get(id)! }] : [])),
    session: item.sessionId && multiSession.value ? sessionTitle.value.get(item.sessionId) : undefined,
  })),
)
const heading = computed(() => props.content.agenda?.title?.trim() || t.value('tvAgenda'))
/** "With {names}" split around the names so each speaker can be a link. */
const withParts = computed(() => t.value('tvWith', { names: '\u0000' }).split('\u0000') as [string, string])
const and = computed(() => (locale.value === 'id' ? ' dan ' : ' and '))
const joiner = (i: number, n: number) => (i < n - 2 ? ', ' : i === n - 2 ? and.value : '')
</script>

<template>
  <section data-section="agenda" class="tv-section tv-agenda">
    <div class="tv-inner">
      <h2 class="tv-h2 tv-center" dir="auto">{{ heading }}</h2>
      <ol class="tv-agenda__list">
        <li v-for="item in items" :key="item.id" class="tv-agenda__item" :data-sample="item.id.startsWith('placeholder-') ? 'true' : undefined">
          <p class="tv-agenda__time">
            <template v-if="item.time"><time :datetime="item.time">{{ fmt(item.time) }}</time><template v-if="item.endTime"> – <time :datetime="item.endTime">{{ fmt(item.endTime) }}</time></template></template>
          </p>
          <div class="tv-agenda__body">
            <h3 class="tv-h3" dir="auto">{{ item.title }}</h3>
            <p v-if="item.description" class="tv-body tv-pre" dir="auto">{{ item.description }}</p>
            <p v-if="item.speakerList.length" class="tv-muted" data-role="agenda-speakers">
              {{ withParts[0] }}<template v-for="(s, i) in item.speakerList" :key="s.id"><a v-if="speakersShown" class="tv-link" :href="`#tv-speaker-${s.id}`" dir="auto">{{ s.name }}</a><bdi v-else>{{ s.name }}</bdi>{{ joiner(i, item.speakerList.length) }}</template>{{ withParts[1] }}
            </p>
            <p v-if="item.session" class="tv-kicker" data-role="agenda-session" dir="auto">{{ t('tvPartOf', { session: item.session }) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
