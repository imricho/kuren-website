<script setup lang="ts">
/**
 * Milestone (v2.0): what is being celebrated. Only the fields the variant uses are
 * shown (age + party theme for birthdays, years for anniversaries, …); the backend
 * publishes only those, so hidden values are kept but never shown to guests.
 */
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { milestoneFieldsFor, milestoneForm, milestonePayload, validateMilestone } from '@/features/cms/invitationForms'
import { fieldId } from '@/features/cms/validation'
import type { MilestoneField } from '@/features/invitation/registry'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'milestone',
  source: () => milestoneForm(store.content!.milestone),
  toPayload: milestonePayload,
  validate: validateMilestone,
  save: async (payload) => void (await store.saveSection('milestone', payload)),
  live: (value) => ({ kind: 'section', section: 'milestone', value }),
})
const { form, errors } = draft

const FIELD: Record<MilestoneField, { label: AppMessageKey; hint: AppMessageKey; numeric?: boolean }> = {
  age: { label: 'milestoneAge', hint: 'milestoneAgeHint', numeric: true },
  years: { label: 'milestoneYears', hint: 'milestoneYearsHint', numeric: true },
  occasion: { label: 'milestoneOccasion', hint: 'milestoneOccasionHint' },
  institution: { label: 'milestoneInstitution', hint: 'optional' },
  program: { label: 'milestoneProgram', hint: 'optional' },
  degree: { label: 'milestoneDegree', hint: 'optional' },
  partyTheme: { label: 'milestonePartyTheme', hint: 'milestonePartyThemeHint' },
}
const fields = computed(() => milestoneFieldsFor(store.variant))
const labels = computed<Record<string, string>>(() => ({
  title: t('sectionTitleLabel'),
  description: t('additionalInfo'),
  ...Object.fromEntries(fields.value.map((f) => [f, t(FIELD[f].label)])),
}))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="milestone-form" @submit.prevent="draft.save()">
    <SectionHeader section="milestone" :description="t('milestoneIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="milestone" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset v-show="form.enabled" class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="section-fields">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
      <TextField :id="fieldId('title')" v-model="form.title" :label="t('sectionTitleLabel')" :hint="t('optional')" :error="errors.title" />
      <TextField
        v-for="f in fields"
        :id="fieldId(f)"
        :key="f"
        v-model="form[f]"
        :label="t(FIELD[f].label)"
        :hint="t(FIELD[f].hint)"
        :inputmode="FIELD[f].numeric ? 'numeric' : undefined"
        :error="errors[f]"
        :data-field="f"
      />
      <TextAreaField :id="fieldId('description')" v-model="form.description" :label="t('additionalInfo')" :hint="t('optional')" :rows="3" :error="errors.description" />
    </fieldset>
  </form>
</template>
