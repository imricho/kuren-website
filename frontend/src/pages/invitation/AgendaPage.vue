<script setup lang="ts">
/**
 * Agenda (v2.0): a timed run-of-show. Inline repeater (≤ 50) with start/end time,
 * title, description, an optional link to one session and (where the variant has
 * speakers) the speakers of the item. Links point at SAVED sessions and speakers;
 * dangling links are dropped when publishing.
 */
import { computed } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import AddRowButton from '@/features/cms/components/AddRowButton.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import RepeaterRow from '@/features/cms/components/RepeaterRow.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useRepeater } from '@/features/cms/composables/useRepeater'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import {
  agendaForm,
  agendaPayload,
  isEmptyAgendaItem,
  mapRowField,
  newAgendaItem,
  validateAgenda,
  type AgendaItemForm,
} from '@/features/cms/invitationForms'
import { fieldId } from '@/features/cms/validation'
import { isSectionOffered } from '@/features/invitation/registry'
import { INVITATION_LIMITS } from '@/features/invitation/validation'
import { eventTypeLabel } from '@/features/wedding/format'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t, locale } = useAppLocale()
useUnsavedChangesGuard()

let rows = (): AgendaItemForm[] => []
const draft = useSectionDraft({
  key: 'agenda',
  source: () => agendaForm(store.content!.agenda),
  toPayload: agendaPayload,
  validate: validateAgenda,
  save: async (payload) => void (await store.saveSection('agenda', payload)),
  live: (value) => ({ kind: 'section', section: 'agenda', value }),
  mapServerField: (field) => mapRowField(field, 'items', rows(), isEmptyAgendaItem),
})
const { form, errors } = draft
rows = () => form.value.items

const sessionOptions = computed(() => [
  { value: '', label: t('agendaNoSession') },
  ...store.content!.events.map((e, i) => ({ value: e.id, label: e.title?.trim() || `${eventTypeLabel(e.type, locale.value)} ${i + 1}` })),
])
const hasSpeakers = computed(() => !!store.variant && isSectionOffered(store.variant, 'speakers'))
const speakers = computed(() => (store.content!.speakers?.people ?? []).filter((p) => p.name?.trim()))

function toggleSpeaker(item: AgendaItemForm, id: string, on: boolean) {
  item.speakerIds = on ? [...new Set([...item.speakerIds, id])] : item.speakerIds.filter((x) => x !== id)
}

const rowName = (item: AgendaItemForm, i: number) => item.title.trim() || t('agendaItemN', { n: i + 1 })
const repeater = useRepeater({
  rows: () => form.value.items,
  setRows: (items) => (form.value.items = items),
  max: INVITATION_LIMITS.agendaItems,
  create: newAgendaItem,
  isEmpty: isEmptyAgendaItem,
  name: rowName,
  firstField: (i) => `items.${i}.time`,
  addAction: 'add-agenda-item',
})
const labels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { title: t('sectionTitleLabel') }
  form.value.items.forEach((item, i) => {
    const n = rowName(item, i)
    out[`items.${i}.time`] = `${n} – ${t('startTime')}`
    out[`items.${i}.endTime`] = `${n} – ${t('endTime')}`
    out[`items.${i}.title`] = `${n} – ${t('agendaItemTitle')}`
    out[`items.${i}.description`] = `${n} – ${t('additionalInfo')}`
  })
  return out
})
</script>

<template>
  <form class="space-y-8" novalidate data-testid="agenda-form" @submit.prevent="draft.save()">
    <SectionHeader section="agenda" :description="t('agendaIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="agenda" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>
    <p class="sr-only" aria-live="polite" data-testid="row-status">{{ repeater.announcement.value }}</p>

    <div v-show="form.enabled" class="space-y-6" data-testid="section-fields">
      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
        <TextField :id="fieldId('title')" v-model="form.title" :label="t('sectionTitleLabel')" :hint="t('optional')" :error="errors.title" />
      </fieldset>
      <section class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="agenda-items">
        <h2 id="agenda-items" class="font-display text-xl font-semibold">{{ t('agendaItems') }}</h2>
        <p v-if="form.items.length === 0" class="text-sm text-ink-500">{{ t('agendaEmpty') }}</p>
        <ol class="space-y-4" data-testid="agenda-rows">
          <RepeaterRow
            v-for="(item, i) in form.items"
            :key="item.id"
            :row-id="item.id"
            :index="i"
            :count="form.items.length"
            :name="rowName(item, i)"
            @move="(d) => repeater.move(i, d)"
            @remove="repeater.remove(i)"
          >
            <div class="grid min-w-0 gap-3 sm:grid-cols-2">
              <TextField :id="fieldId(`items.${i}.time`)" v-model="item.time" type="time" :label="t('startTime')" :hint="t('optional')" :error="errors[`items.${i}.time`]" />
              <TextField :id="fieldId(`items.${i}.endTime`)" v-model="item.endTime" type="time" :label="t('endTime')" :hint="t('optional')" :error="errors[`items.${i}.endTime`]" />
            </div>
            <TextField :id="fieldId(`items.${i}.title`)" v-model="item.title" :label="t('agendaItemTitle')" :error="errors[`items.${i}.title`]" />
            <TextAreaField :id="fieldId(`items.${i}.description`)" v-model="item.description" :label="t('additionalInfo')" :hint="t('optional')" :rows="2" :error="errors[`items.${i}.description`]" />
            <SelectField
              v-if="store.content!.events.length"
              :id="fieldId(`items.${i}.sessionId`)"
              v-model="item.sessionId"
              :label="t('agendaSession')"
              :hint="t('optional')"
              :options="sessionOptions"
            />
            <fieldset v-if="hasSpeakers" class="min-w-0 space-y-2" :data-testid="`agenda-speakers-${i}`">
              <legend class="text-sm font-medium text-ink-700">{{ t('agendaSpeakers') }}</legend>
              <p v-if="speakers.length === 0" class="text-xs text-ink-500">{{ t('agendaNoSpeakers') }}</p>
              <label v-for="sp in speakers" :key="sp.id" class="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
                <input
                  type="checkbox"
                  class="size-4 accent-rose-600"
                  :checked="item.speakerIds.includes(sp.id)"
                  :data-speaker="sp.id"
                  @change="toggleSpeaker(item, sp.id, ($event.target as HTMLInputElement).checked)"
                />
                {{ sp.name }}
              </label>
            </fieldset>
          </RepeaterRow>
        </ol>
        <AddRowButton
          :label="t('addAgendaItem')"
          action="add-agenda-item"
          :at-limit="repeater.atLimit.value"
          :limit-text="t('rowLimitReached', { max: INVITATION_LIMITS.agendaItems })"
          @add="repeater.add()"
        />
      </section>
    </div>
  </form>
</template>
