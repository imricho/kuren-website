<script setup lang="ts">
/** Event extras shared by every theme: online/hybrid access, dress code and livestream link. */
import { computed } from 'vue'

import { isHttpsUrl } from '@/features/wedding/draft'
import type { WeddingEvent, WeddingLocale } from '@/features/wedding/types'

const props = defineProps<{
  event: Pick<WeddingEvent, 'dressCode' | 'livestream'> & Partial<Pick<WeddingEvent, 'format' | 'onlineUrl' | 'onlineLabel' | 'onlineInstructions'>>
  locale?: WeddingLocale
}>()
/** Online / hybrid access: the joining link and any instructions (in-person sessions have none). */
const online = computed(() => {
  const e = props.event
  if (e.format !== 'online' && e.format !== 'hybrid') return undefined
  const url = e.onlineUrl?.trim()
  const instructions = e.onlineInstructions?.trim()
  if (!(url && isHttpsUrl(url)) && !instructions) return undefined
  return {
    kind: e.format,
    url: url && isHttpsUrl(url) ? url : undefined,
    label: e.onlineLabel?.trim() || (isId.value ? 'Gabung daring' : 'Join online'),
    instructions,
    heading: e.format === 'hybrid' ? (isId.value ? 'Bisa hadir langsung atau daring' : 'Join in person or online') : isId.value ? 'Acara daring' : 'Online event',
  }
})
const isId = computed(() => props.locale === 'id')
const dress = computed(() => (props.event.dressCode?.enabled ? props.event.dressCode.text?.trim() : undefined))
const live = computed(() => {
  const l = props.event.livestream
  const url = l?.url?.trim()
  return l?.enabled && isHttpsUrl(url) ? { url, label: l.label?.trim() || (isId.value ? 'Tonton siaran langsung' : 'Watch the livestream') } : undefined
})
</script>

<template>
  <div v-if="dress || live || online" class="event-extras">
    <div v-if="online" class="event-extras__online" data-role="online-access" :data-format="online.kind">
      <span class="event-extras__label">{{ online.heading }}</span>
      <a v-if="online.url" class="event-extras__link" :href="online.url" target="_blank" rel="noopener noreferrer" data-role="online-link">
        <span dir="auto">{{ online.label }}</span><span aria-hidden="true"> ↗</span><span class="universal-visually-hidden"> {{ isId ? '(membuka tab baru)' : '(opens in a new tab)' }}</span>
      </a>
      <span v-if="online.instructions" class="universal-text whitespace-pre-line" dir="auto">{{ online.instructions }}</span>
    </div>
    <p v-if="dress" class="event-extras__dress" data-role="dress-code">
      <span class="event-extras__label">Dress code</span>
      <span class="universal-text whitespace-pre-line" dir="auto">{{ dress }}</span>
    </p>
    <p v-if="live" class="event-extras__live">
      <a class="event-extras__link" :href="live.url" target="_blank" rel="noopener noreferrer" data-role="livestream">
        <span dir="auto">{{ live.label }}</span><span aria-hidden="true"> ↗</span><span class="universal-visually-hidden"> {{ isId ? '(membuka tab baru)' : '(opens in a new tab)' }}</span>
      </a>
    </p>
  </div>
</template>

<style>
.event-extras { margin-block: 0.75rem; display: grid; gap: 0.35rem; }
.event-extras p { margin: 0; }
.event-extras__online { display: grid; gap: 0.2rem; }
.event-extras__label { display: block; font-size: 0.75em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; }
.event-extras__link { color: inherit; text-decoration: underline; text-underline-offset: 0.2em; overflow-wrap: anywhere; }
.event-extras__link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>
