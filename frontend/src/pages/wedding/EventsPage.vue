<script setup lang="ts">
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import EventEditor from '@/features/cms/components/editors/EventEditor.vue'
import ListEditor from '@/features/cms/components/ListEditor.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { useVariantCopy } from '@/features/cms/composables/useVariantCopy'
import { eventMissing } from '@/features/wedding/completeness'
import type { EventDraft } from '@/features/wedding/draft'
import { eventTypeLabel, formatDate, formatTimeRange } from '@/features/wedding/format'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t, locale } = useAppLocale()
const { vt, generic } = useVariantCopy()
useUnsavedChangesGuard()

const events = computed(() => store.items('events'))
const name = (e: EventDraft, i: number) => e.title?.trim() || t('untitledItem', { kind: eventTypeLabel(e.type, locale.value), n: i + 1 })
const when = (e: EventDraft) =>
  [e.date ? formatDate(e.date, locale.value, 'long') : null, e.startTime ? formatTimeRange(e.startTime, e.endTime, locale.value) : null]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="space-y-8">
    <SectionHeader section="events" :description="vt('eventsIntro')" />
    <ListEditor
      :items="events"
      :item-name="name"
      :add-label="vt('addEvent')"
      :empty-title="generic ? t('noSessionsTitle') : t('noEventsTitle')"
      :empty-body="generic ? t('noSessionsBody') : t('noEventsBody')"
      :list-label="vt('sectionEvents')"
      :max="20"
      :reorder="(ids) => store.reorder('events', ids)"
      :refresh="() => store.refreshCollection('events')"
      :before-close="(item) => store.flushDraft(`events:${item.id}`)"
      :remove="(item) => store.deleteItem('events', item.id)"
    >
      <template #summary="{ item, index }">
        <p class="text-xs font-medium tracking-wide text-rose-600 uppercase">{{ eventTypeLabel(item.type, locale) }}</p>
        <h2 class="mt-0.5 font-display text-xl font-semibold">{{ name(item, index) }}</h2>
        <p v-if="when(item)" class="mt-1 text-sm text-ink-700">{{ when(item) }}</p>
        <p v-if="item.venueName" class="text-sm text-ink-500">{{ item.venueName }}</p>
        <p v-if="item.optional" class="mt-1 inline-flex rounded-full bg-canvas px-2 text-xs text-ink-700 ring-1 ring-line" data-testid="session-optional">{{ t('sessionOptionalBadge') }}</p>
        <p v-if="eventMissing(item).length" class="mt-2 text-xs text-amber-700">
          {{ t('eventIncomplete', { count: eventMissing(item).length }) }}
        </p>
      </template>
      <template #editor="{ item, close }">
        <EventEditor :item="item" @done="close" />
      </template>
      <template #create="{ close }">
        <h2 class="mb-4 font-display text-xl font-semibold">{{ generic ? t('newSession') : t('newEvent') }}</h2>
        <EventEditor @done="close" />
      </template>
    </ListEditor>
  </div>
</template>
