<script setup lang="ts">
/** Speakers (v2.0): inline repeater (≤ 30) with name, role, organization, bio and photo. */
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import AddRowButton from '@/features/cms/components/AddRowButton.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ImageField from '@/features/cms/components/ImageField.vue'
import RepeaterRow from '@/features/cms/components/RepeaterRow.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useRepeater } from '@/features/cms/composables/useRepeater'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import {
  isEmptySpeaker,
  mapRowField,
  newSpeaker,
  speakersForm,
  speakersPayload,
  validateSpeakers,
  type SpeakerForm,
} from '@/features/cms/invitationForms'
import { fieldId } from '@/features/cms/validation'
import { INVITATION_LIMITS } from '@/features/invitation/validation'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

let rows = (): SpeakerForm[] => []
const draft = useSectionDraft({
  key: 'speakers',
  source: () => speakersForm(store.content!.speakers),
  toPayload: speakersPayload,
  validate: validateSpeakers,
  save: async (payload) => void (await store.saveSection('speakers', payload)),
  live: (value) => ({ kind: 'section', section: 'speakers', value }),
  mapServerField: (field) => mapRowField(field, 'people', rows(), isEmptySpeaker),
})
const { form, errors } = draft
rows = () => form.value.people

const rowName = (p: SpeakerForm, i: number) => p.name.trim() || t('speakerN', { n: i + 1 })
const repeater = useRepeater({
  rows: () => form.value.people,
  setRows: (people) => (form.value.people = people),
  max: INVITATION_LIMITS.speakers,
  create: newSpeaker,
  isEmpty: isEmptySpeaker,
  name: rowName,
  firstField: (i) => `people.${i}.name`,
  addAction: 'add-speaker',
})
const labels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { title: t('sectionTitleLabel') }
  form.value.people.forEach((p, i) => {
    const n = rowName(p, i)
    out[`people.${i}.name`] = `${n} – ${t('fullName')}`
    out[`people.${i}.role`] = `${n} – ${t('speakerRole')}`
    out[`people.${i}.organization`] = `${n} – ${t('speakerOrganization')}`
    out[`people.${i}.bio`] = `${n} – ${t('shortBio')}`
    out[`people.${i}.image.src`] = `${n} – ${t('photo')}`
    out[`people.${i}.image.alt`] = `${n} – ${t('altText')}`
  })
  return out
})
</script>

<template>
  <form class="space-y-8" novalidate data-testid="speakers-form" @submit.prevent="draft.save()">
    <SectionHeader section="speakers" :description="t('speakersIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="speakers" />
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
      <section class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="speakers-people">
        <h2 id="speakers-people" class="font-display text-xl font-semibold">{{ t('sectionSpeakers') }}</h2>
        <p v-if="form.people.length === 0" class="text-sm text-ink-500">{{ t('speakersEmpty') }}</p>
        <ol class="space-y-4" data-testid="speaker-rows">
          <RepeaterRow
            v-for="(p, i) in form.people"
            :key="p.id"
            :row-id="p.id"
            :index="i"
            :count="form.people.length"
            :name="rowName(p, i)"
            @move="(d) => repeater.move(i, d)"
            @remove="repeater.remove(i)"
          >
            <div class="grid min-w-0 gap-3 sm:grid-cols-2">
              <TextField :id="fieldId(`people.${i}.name`)" v-model="p.name" :label="t('fullName')" autocomplete="off" :error="errors[`people.${i}.name`]" />
              <TextField :id="fieldId(`people.${i}.role`)" v-model="p.role" :label="t('speakerRole')" :hint="t('speakerRoleHint')" :error="errors[`people.${i}.role`]" />
            </div>
            <TextField :id="fieldId(`people.${i}.organization`)" v-model="p.organization" :label="t('speakerOrganization')" :hint="t('optional')" :error="errors[`people.${i}.organization`]" />
            <TextAreaField :id="fieldId(`people.${i}.bio`)" v-model="p.bio" :label="t('shortBio')" :hint="t('optional')" :rows="3" :error="errors[`people.${i}.bio`]" />
            <ImageField v-model="p.image" :path="`people.${i}.image`" :label="t('photo')" :errors="errors" />
          </RepeaterRow>
        </ol>
        <AddRowButton
          :label="t('addSpeaker')"
          action="add-speaker"
          :at-limit="repeater.atLimit.value"
          :limit-text="t('rowLimitReached', { max: INVITATION_LIMITS.speakers })"
          @add="repeater.add()"
        />
      </section>
    </div>
  </form>
</template>
