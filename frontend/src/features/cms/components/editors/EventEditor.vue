<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import SwitchField from '@/components/ui/SwitchField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { FOCUS_RING } from '@/components/ui/styles'
import { applyPreset, EVENT_PRESETS, type EventPreset, type EventPresetKey } from '@/features/cms/eventPresets'
import { eventForm, eventPayload } from '@/features/cms/forms'
import { fieldId, validateEvent } from '@/features/cms/validation'
import type { EventDraft } from '@/features/wedding/draft'
import { eventTypeLabel } from '@/features/wedding/format'
import { EVENT_TYPES } from '@/features/wedding/types'
import { useWeddingStore } from '@/stores/wedding'

import { useSectionDraft } from '../../composables/useSectionDraft'
import DateField from '../DateField.vue'
import ErrorSummary from '../ErrorSummary.vue'
import ItemEditorActions from './ItemEditorActions.vue'

const props = defineProps<{ item?: EventDraft }>()
const emit = defineEmits<{ done: [] }>()
const store = useWeddingStore()
const { t, locale } = useAppLocale()
const scope = `ev-${props.item?.id ?? 'new'}`

const saved = () => (props.item ? (store.items('events').find((e) => e.id === props.item!.id) ?? props.item) : undefined)
const draft = useSectionDraft({
  key: `events:${props.item?.id ?? 'new'}`,
  source: () => eventForm(saved()),
  toPayload: eventPayload,
  validate: validateEvent,
  idScope: scope,
  async save(payload) {
    if (props.item) await store.updateItem('events', props.item.id, payload)
    else await store.createItem('events', payload)
  },
  // Saved items autosave; a new item is only created by an explicit Add.
  autosave: !!props.item,
  live: (payload) => ({ kind: 'item', collection: 'events', itemId: props.item?.id ?? null, value: payload }),
  successMessage: (): string => t('itemAdded', { name: draft.form.value.title || t('event') }),
  failureMessage: () => t('itemSaveFailed'),
})
const { form, errors } = draft

const typeOptions = computed(() => EVENT_TYPES.map((type) => ({ value: type, label: eventTypeLabel(type, locale.value) })))
const needed = t('neededBeforePublishing')
const id = (field: string) => fieldId(field, scope)

/** A new event needs at least one detail before it can be added. */
const emptyError = ref(false)
const titleError = computed(() => errors.value.title ?? (emptyError.value ? t('errEmptyItem') : undefined))

const chosenPreset = ref<EventPresetKey | null>(null)
const presetLabel = (p: EventPreset) => (p.key === 'custom' ? t('presetCustom') : p.title[locale.value])
function choosePreset(preset: EventPreset) {
  chosenPreset.value = preset.key
  emptyError.value = false
  const next = applyPreset(form.value, preset, locale.value)
  form.value.type = next.type
  form.value.title = next.title
  if (preset.key === 'custom') nextTick(() => document.getElementById(id('title'))?.focus())
}

async function submit() {
  if (!props.item && !draft.isDirty.value) {
    emptyError.value = true
    document.getElementById(id('title'))?.focus()
    return
  }
  emptyError.value = false
  if (await draft.save()) {
    if (!props.item) emit('done') // added: close the new-item form
  }
}
/** Saved item: save anything pending, then close (stays open if it couldn't be saved). */
async function done() {
  if (await draft.flush()) emit('done')
}
function cancel() {
  draft.discard()
  emit('done')
}
</script>

<template>
  <form class="space-y-4" novalidate data-testid="event-editor" @submit.prevent="submit">
    <ErrorSummary :errors="draft.errorList.value" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>
    <fieldset v-if="!item" class="min-w-0" data-testid="event-presets">
      <legend class="mb-2 text-sm font-medium text-ink-700">{{ t('presetLegend') }}</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="preset in EVENT_PRESETS"
          :key="preset.key"
          type="button"
          :class="[
            'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none sm:min-h-9',
            FOCUS_RING,
            chosenPreset === preset.key
              ? 'border-rose-600 bg-rose-50 text-rose-700'
              : 'border-ink-500/85 bg-surface text-ink-700 hover:bg-rose-50',
          ]"
          :aria-pressed="chosenPreset === preset.key"
          :data-preset="preset.key"
          @click="choosePreset(preset)"
        >
          {{ presetLabel(preset) }}
        </button>
      </div>
      <p class="mt-2 text-xs text-ink-500">{{ t('presetHint') }}</p>
    </fieldset>
    <div class="grid gap-4 sm:grid-cols-2">
      <TextField
        :id="id('title')"
        v-model="form.title"
        :label="t('eventTitle')"
        :error="titleError"
        :needed-hint="needed"
        @update:model-value="emptyError = false"
      />
      <SelectField :id="id('type')" v-model="form.type" :label="t('eventType')" :options="typeOptions" :error="errors.type" />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <DateField :id="id('date')" v-model="form.date" class="sm:col-span-2" :label="t('date')" :error="errors.date" :needed-hint="needed" />
      <TextField :id="id('startTime')" v-model="form.startTime" type="time" :label="t('startTime')" :error="errors.startTime" :needed-hint="needed" />
      <TextField :id="id('endTime')" v-model="form.endTime" type="time" :label="t('endTime')" :hint="t('optional')" :error="errors.endTime" />
    </div>
    <TextField :id="id('venueName')" v-model="form.venueName" :label="t('venueName')" :error="errors.venueName" :needed-hint="needed" />
    <TextAreaField :id="id('address')" v-model="form.address" :label="t('address')" :rows="2" :error="errors.address" :needed-hint="needed" />
    <TextField
      :id="id('mapsUrl')"
      v-model="form.mapsUrl"
      :label="t('mapsUrl')"
      :hint="t('mapsUrlHint')"
      :error="errors.mapsUrl"
      inputmode="url"
    />
    <TextAreaField :id="id('description')" v-model="form.description" :label="t('additionalInfo')" :hint="t('additionalInfoHint')" :rows="3" :error="errors.description" />
    <div class="space-y-3 rounded-lg border border-line p-4" data-testid="event-dress-code">
      <SwitchField :id="id('dressCode.enabled')" v-model="form.dressCodeEnabled" :label="t('dressCode')" />
      <div v-show="form.dressCodeEnabled || errors['dressCode.text']">
        <TextField :id="id('dressCode.text')" v-model="form.dressCodeText" :label="t('dressCodeText')" :error="errors['dressCode.text']" />
      </div>
      <p v-if="!form.dressCodeEnabled && form.dressCodeText.trim()" class="text-xs text-ink-500">{{ t('extraKept') }}</p>
    </div>
    <div class="space-y-3 rounded-lg border border-line p-4" data-testid="event-livestream">
      <SwitchField :id="id('livestream.enabled')" v-model="form.livestreamEnabled" :label="t('livestream')" />
      <div v-show="form.livestreamEnabled || errors['livestream.url'] || errors['livestream.label']" class="space-y-3">
        <TextField
          :id="id('livestream.url')"
          v-model="form.livestreamUrl"
          type="url"
          inputmode="url"
          autocomplete="off"
          :label="t('livestreamUrl')"
          :hint="t('livestreamUrlHint')"
          :error="errors['livestream.url']"
        />
        <TextField :id="id('livestream.label')" v-model="form.livestreamLabel" :label="t('livestreamLabel')" :hint="t('optional')" :error="errors['livestream.label']" />
      </div>
      <p v-if="!form.livestreamEnabled && (form.livestreamUrl.trim() || form.livestreamLabel.trim())" class="text-xs text-ink-500">{{ t('extraKept') }}</p>
    </div>
    <ItemEditorActions :saving="draft.submitting.value" :is-new="!item" @cancel="cancel" @done="done" />
  </form>
</template>
