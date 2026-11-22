<script setup lang="ts">
/**
 * Google Calendar link + .ics download for the wedding day. Live only on the
 * published invitation; in the editor/preview it is shown but inert.
 */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import { ASSUMED_DURATION_MINUTES, googleCalendarUrl, icsDataUrl, icsFileName, weddingCalendarEntry } from '../calendar'
import { useIsDraftRender, useRenderContext } from '../composables/useRenderMode'

/** `title`: calendar entry title for non-wedding invitations (default: wedding wording). */
const props = defineProps<{ content: WeddingContent; title?: string }>()
const isDraft = useIsDraftRender()
const { timezone } = useRenderContext()
const isId = computed(() => props.content.locale === 'id')
/** Times are converted from the invitation's PUBLISHED time zone (DST-aware). */
const entry = computed(() => weddingCalendarEntry(props.content, props.title, timezone.value))
/** Shown when no end time was given, so the assumed length is never passed off as a fact. */
const assumedNote = computed(() =>
  entry.value.assumedEnd
    ? isId.value
      ? `Jam selesai belum ditentukan, jadi entri kalender dibuat ${ASSUMED_DURATION_MINUTES / 60} jam.`
      : `No end time was given, so the calendar entry lasts ${ASSUMED_DURATION_MINUTES / 60} hours.`
    : '',
)
const google = computed(() => googleCalendarUrl(entry.value))
const ics = computed(() => (isDraft.value ? undefined : icsDataUrl(entry.value)))
const fileName = computed(() => icsFileName(props.content, props.title))
const labels = computed(() =>
  isId.value
    ? { group: 'Tambahkan ke kalender', google: 'Google Calendar', ics: 'Unduh file kalender (.ics)', newTab: '(membuka tab baru)', inert: 'Aktif di undangan yang diterbitkan' }
    : { group: 'Add to calendar', google: 'Google Calendar', ics: 'Download calendar file (.ics)', newTab: '(opens in a new tab)', inert: 'Works on the published invitation' },
)
</script>

<template>
  <div class="add-to-calendar" role="group" :aria-label="labels.group" data-testid="add-to-calendar">
    <p class="add-to-calendar__label">{{ labels.group }}</p>
    <div class="add-to-calendar__actions">
      <template v-if="isDraft">
        <span class="add-to-calendar__button" data-calendar="google">{{ labels.google }}</span>
        <span class="add-to-calendar__button" data-calendar="ics">{{ labels.ics }}</span>
      </template>
      <template v-else>
        <a class="add-to-calendar__button" :href="google" target="_blank" rel="noopener noreferrer" data-calendar="google">
          {{ labels.google }}<span class="universal-visually-hidden"> {{ labels.newTab }}</span>
        </a>
        <a class="add-to-calendar__button" :href="ics" :download="fileName" data-calendar="ics">{{ labels.ics }}</a>
      </template>
    </div>
    <p v-if="assumedNote" class="add-to-calendar__note" data-role="assumed-end">{{ assumedNote }}</p>
    <p v-if="isDraft" class="add-to-calendar__note" data-editor-only>{{ labels.inert }}</p>
  </div>
</template>

<style>
.add-to-calendar { margin-block-start: 1.75rem; }
.add-to-calendar__label { font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.8; margin-block-end: 0.75rem; }
.add-to-calendar__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; }
.add-to-calendar__button { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0.5rem 1.1rem; border: 1px solid currentColor; border-radius: 999px; color: inherit; text-decoration: none; font-size: 0.9em; }
.add-to-calendar__button[aria-disabled='true'] { opacity: 0.55; cursor: not-allowed; }
.add-to-calendar a.add-to-calendar__button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.add-to-calendar__note { font-size: 0.75em; opacity: 0.7; margin-block-start: 0.5rem; }
</style>
