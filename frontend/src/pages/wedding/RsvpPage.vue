<script setup lang="ts">
import { computed } from 'vue'

import SwitchField from '@/components/ui/SwitchField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import DateField from '@/features/cms/components/DateField.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { rsvpForm, rsvpPayload } from '@/features/cms/forms'
import { fieldId, validateRsvp } from '@/features/cms/validation'
import { isIsoDate } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t, locale } = useAppLocale()
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
  enabled: t('showRsvp'),
  title: t('heading'),
  introduction: t('introduction'),
  confirmationMessage: t('confirmationMessage'),
  deadline: t('replyDeadline'),
  maxGuestsPerResponse: t('maxGuests'),
}))

const weddingDate = computed(() => store.content!.opening.weddingDate)
const deadlineAfterWedding = computed(
  () => isIsoDate(form.value.deadline) && isIsoDate(weddingDate.value) && form.value.deadline > weddingDate.value,
)
</script>

<template>
  <form class="space-y-8" novalidate data-testid="rsvp-form" @submit.prevent="draft.save()">
    <SectionHeader section="rsvp" :description="t('rsvpIntro')" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset class="min-w-0 space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionRsvp') }}</legend>
      <SwitchField :id="fieldId('enabled')" v-model="form.enabled" :label="t('showRsvp')" :hint="t('showRsvpHint')" />
      <TextField :id="fieldId('title')" v-model="form.title" :label="t('heading')" :hint="t('rsvpHeadingHint')" :error="errors.title" :needed-hint="t('neededBeforePublishing')" />
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
            {{ t('deadlineAfterWedding', { date: formatDate(weddingDate!, locale, 'long') }) }}
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
    </fieldset>
  </form>
</template>
