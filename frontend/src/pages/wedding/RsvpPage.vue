<script setup lang="ts">
import { computed } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import SwitchField from '@/components/ui/SwitchField.vue'
import { FOCUS_RING } from '@/components/ui/styles'
import AddRowButton from '@/features/cms/components/AddRowButton.vue'
import RepeaterRow from '@/features/cms/components/RepeaterRow.vue'
import { useRepeater } from '@/features/cms/composables/useRepeater'
import { useVariantCopy } from '@/features/cms/composables/useVariantCopy'
import type { RegistrationFieldForm } from '@/features/cms/forms'
import { newRowId } from '@/features/cms/universalForms'
import { REGISTRATION_FIELD_TYPES, RSVP_CONTACT_MODES, type RegistrationFieldType, type RsvpContactMode } from '@/features/invitation/registry'
import { INVITATION_LIMITS } from '@/features/invitation/validation'
import type { AppMessageKey } from '@/composables/useAppLocale'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import DateField from '@/features/cms/components/DateField.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { rsvpForm, rsvpPayload } from '@/features/cms/forms'
import { fieldId, validateRsvp } from '@/features/cms/validation'
import { isIsoDate } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t, locale } = useAppLocale()
const { vt } = useVariantCopy()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'rsvp',
  source: () => rsvpForm(store.content!.rsvp),
  toPayload: rsvpPayload,
  validate: validateRsvp,
  save: async (payload) => void (await store.saveSection('rsvp', payload)),
  live: (value) => ({ kind: 'section', section: 'rsvp', value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  enabled: t('showOnWebsite'),
  title: t('heading'),
  introduction: t('introduction'),
  confirmationMessage: t('confirmationMessage'),
  deadline: t('replyDeadline'),
  maxGuestsPerResponse: t('maxGuests'),
  capacity: t('rsvpCapacity'),
  registrationFields: t('registrationFields'),
  ...Object.fromEntries(
    form.value.registrationFields.flatMap((f, i) => [
      [`registrationFields.${i}.label`, `${fieldName(f, i)} – ${t('registrationLabel')}`],
      [`registrationFields.${i}.options`, `${fieldName(f, i)} – ${t('registrationOptions')}`],
      ...f.options.map((_, j) => [`registrationFields.${i}.options.${j}`, `${fieldName(f, i)} – ${t('registrationOptionN', { n: j + 1 })}`]),
    ]),
  ),
}))

// --- v2.0 settings ------------------------------------------------------------------
const CONTACT_LABEL: Record<RsvpContactMode, AppMessageKey> = {
  none: 'contactNone',
  email: 'contactEmail',
  phone: 'contactPhone',
  email_or_phone: 'contactEmailOrPhone',
}
const contactOptions = computed(() => RSVP_CONTACT_MODES.map((m) => ({ value: m, label: t(CONTACT_LABEL[m]) })))
const TYPE_LABEL: Record<RegistrationFieldType, AppMessageKey> = {
  text: 'fieldTypeText',
  textarea: 'fieldTypeTextarea',
  email: 'fieldTypeEmail',
  phone: 'fieldTypePhone',
  select: 'fieldTypeSelect',
  checkbox: 'fieldTypeCheckbox',
}
const typeOptions = computed(() => REGISTRATION_FIELD_TYPES.map((v) => ({ value: v, label: t(TYPE_LABEL[v]) })))
/** Session choice only makes sense with optional sessions. */
const optionalSessions = computed(() => store.content!.events.filter((e) => e.optional).length)

const fieldName = (f: RegistrationFieldForm, i: number) => f.label.trim() || t('registrationFieldN', { n: i + 1 })
const isEmptyField = (f: RegistrationFieldForm) => !f.label.trim() && f.options.every((o) => !o.trim())
const repeater = useRepeater({
  rows: () => form.value.registrationFields,
  setRows: (rows) => (form.value.registrationFields = rows),
  max: INVITATION_LIMITS.registrationFields,
  create: (): RegistrationFieldForm => ({ id: newRowId(), label: '', type: 'text', required: false, options: [] }),
  isEmpty: isEmptyField,
  name: fieldName,
  firstField: (i) => `registrationFields.${i}.label`,
  addAction: 'add-registration-field',
})
function setType(f: RegistrationFieldForm, type: RegistrationFieldType) {
  f.type = type
  if (type === 'select' && f.options.length === 0) f.options = ['', '']
}
function addOption(f: RegistrationFieldForm) {
  if (f.options.length < INVITATION_LIMITS.registrationOptions) f.options = [...f.options, '']
}
function removeOption(f: RegistrationFieldForm, j: number) {
  f.options = f.options.filter((_, k) => k !== j)
}

const weddingDate = computed(() => store.content!.opening.weddingDate)
const deadlineAfterWedding = computed(
  () => isIsoDate(form.value.deadline) && isIsoDate(weddingDate.value) && form.value.deadline > weddingDate.value,
)
</script>

<template>
  <form class="space-y-8" novalidate data-testid="rsvp-form" @submit.prevent="draft.save()">
    <SectionHeader section="rsvp" :description="t('rsvpIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="rsvp" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <p class="rounded-md bg-canvas px-3 py-2 text-sm text-ink-700 ring-1 ring-line" role="note" data-testid="rsvp-offline-note">
      {{ t('rsvpOfflineNote') }}
      <RouterLink :to="{ name: 'invitation-responses' }" class="ml-1 font-medium text-rose-700 underline underline-offset-2" data-testid="rsvp-responses-link">{{ t('viewResponses') }}</RouterLink>
    </p>
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset v-show="form.enabled" class="min-w-0 space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionRsvp') }}</legend>
      <TextField :id="fieldId('title')" v-model="form.title" :label="t('heading')" :hint="t('rsvpHeadingHint')" :error="errors.title" />
      <TextAreaField :id="fieldId('introduction')" v-model="form.introduction" :label="t('introduction')" :rows="3" :error="errors.introduction" />
      <TextAreaField
        :id="fieldId('confirmationMessage')"
        v-model="form.confirmationMessage"
        :label="t('confirmationMessage')"
        :hint="t('confirmationMessageHint')"
        :rows="2"
        :error="errors.confirmationMessage"
      />
      <div class="grid min-w-0 gap-4 sm:grid-cols-2">
        <div class="min-w-0">
          <DateField :id="fieldId('deadline')" v-model="form.deadline" :label="t('replyDeadline')" :hint="t('optional')" :error="errors.deadline" />
          <p v-if="deadlineAfterWedding && !errors.deadline" class="mt-1.5 text-xs text-amber-700" role="status" data-testid="deadline-warning">
            {{ vt('deadlineAfterWedding', { date: formatDate(weddingDate!, locale, 'long') }) }}
          </p>
        </div>
        <TextField
          :id="fieldId('maxGuestsPerResponse')"
          v-model="form.maxGuestsPerResponse"
          inputmode="numeric"
          :label="t('maxGuests')"
          :hint="t('maxGuestsHint')"
          :error="errors.maxGuestsPerResponse"
        />
      </div>
      <TextField
        :id="fieldId('capacity')"
        v-model="form.capacity"
        inputmode="numeric"
        :label="t('rsvpCapacity')"
        :hint="t('rsvpCapacityHint')"
        :error="errors.capacity"
      />
      <SelectField :id="fieldId('collectContact')" v-model="form.collectContact" :label="t('collectContact')" :hint="t('collectContactHint')" :options="contactOptions" />
      <div class="space-y-1">
        <SwitchField :id="fieldId('allowSessionChoice')" v-model="form.allowSessionChoice" :label="t('allowSessionChoice')" :hint="t('allowSessionChoiceHint')" />
        <p v-if="form.allowSessionChoice && optionalSessions === 0" class="text-xs text-amber-700" role="status" data-testid="no-optional-sessions">{{ t('noOptionalSessions') }}</p>
      </div>
    </fieldset>

    <section v-show="form.enabled" class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="rsvp-fields" data-testid="registration-builder">
      <h2 id="rsvp-fields" class="font-display text-xl font-semibold">{{ t('registrationFields') }}</h2>
      <p class="text-sm text-ink-500">{{ t('registrationFieldsIntro') }}</p>
      <p class="sr-only" aria-live="polite" data-testid="row-status">{{ repeater.announcement.value }}</p>
      <p v-if="errors.registrationFields" class="text-sm text-danger-600">{{ errors.registrationFields }}</p>
      <ol class="space-y-4" data-testid="registration-rows">
        <RepeaterRow
          v-for="(f, i) in form.registrationFields"
          :key="f.id"
          :row-id="f.id"
          :index="i"
          :count="form.registrationFields.length"
          :name="fieldName(f, i)"
          @move="(d) => repeater.move(i, d)"
          @remove="repeater.remove(i)"
        >
          <div class="grid min-w-0 gap-3 sm:grid-cols-2">
            <TextField :id="fieldId(`registrationFields.${i}.label`)" v-model="f.label" :label="t('registrationLabel')" :error="errors[`registrationFields.${i}.label`]" />
            <SelectField
              :id="fieldId(`registrationFields.${i}.type`)"
              :model-value="f.type"
              :label="t('registrationType')"
              :options="typeOptions"
              @update:model-value="(v: RegistrationFieldType) => setType(f, v)"
            />
          </div>
          <SwitchField :id="fieldId(`registrationFields.${i}.required`)" v-model="f.required" :label="t('registrationRequired')" />
          <fieldset v-if="f.type === 'select'" class="min-w-0 space-y-2" :data-testid="`options-${i}`">
            <legend class="text-sm font-medium text-ink-700">{{ t('registrationOptions') }}</legend>
            <p v-if="errors[`registrationFields.${i}.options`]" :id="`${fieldId(`registrationFields.${i}.options`)}`" class="text-xs text-danger-600" tabindex="-1">
              {{ errors[`registrationFields.${i}.options`] }}
            </p>
            <div v-for="(_, j) in f.options" :key="j" class="flex items-end gap-2">
              <div class="min-w-0 flex-1">
                <TextField :id="fieldId(`registrationFields.${i}.options.${j}`)" :model-value="f.options[j] ?? ''" :label="t('registrationOptionN', { n: j + 1 })" :error="errors[`registrationFields.${i}.options.${j}`]" @update:model-value="(v: string) => (f.options[j] = v)" />
              </div>
              <button
                type="button"
                :class="['min-h-11 rounded-md px-3 text-sm text-danger-600 hover:bg-danger-50', FOCUS_RING]"
                :aria-label="t('removeOptionN', { n: j + 1 })"
                data-action="remove-option"
                @click="removeOption(f, j)"
              >
                {{ t('remove') }}
              </button>
            </div>
            <button
              type="button"
              :class="['min-h-11 rounded-md px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 sm:min-h-9', FOCUS_RING]"
              :disabled="f.options.length >= INVITATION_LIMITS.registrationOptions"
              data-action="add-option"
              @click="addOption(f)"
            >
              {{ t('addOption') }}
            </button>
          </fieldset>
        </RepeaterRow>
      </ol>
      <AddRowButton
        :label="t('addRegistrationField')"
        action="add-registration-field"
        :at-limit="repeater.atLimit.value"
        :limit-text="t('rowLimitReached', { max: INVITATION_LIMITS.registrationFields })"
        @add="repeater.add()"
      />
    </section>
  </form>
</template>
