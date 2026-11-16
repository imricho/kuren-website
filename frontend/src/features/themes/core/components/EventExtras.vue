<script setup lang="ts">
/** Optional event extras shared by every theme: dress code and livestream link (each with its own toggle). */
import { computed } from 'vue'

import { isHttpsUrl } from '@/features/wedding/draft'
import type { WeddingEvent, WeddingLocale } from '@/features/wedding/types'

const props = defineProps<{ event: Pick<WeddingEvent, 'dressCode' | 'livestream'>; locale?: WeddingLocale }>()
const isId = computed(() => props.locale === 'id')
const dress = computed(() => (props.event.dressCode?.enabled ? props.event.dressCode.text?.trim() : undefined))
const live = computed(() => {
  const l = props.event.livestream
  const url = l?.url?.trim()
  return l?.enabled && isHttpsUrl(url) ? { url, label: l.label?.trim() || (isId.value ? 'Tonton siaran langsung' : 'Watch the livestream') } : undefined
})
</script>

<template>
  <div v-if="dress || live" class="event-extras">
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
.event-extras__label { display: block; font-size: 0.75em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; }
.event-extras__link { color: inherit; text-decoration: underline; text-underline-offset: 0.2em; overflow-wrap: anywhere; }
.event-extras__link:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
</style>
