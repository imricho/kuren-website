<script setup lang="ts">
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ImageField from '@/features/cms/components/ImageField.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { closingForm, closingPayload } from '@/features/cms/forms'
import { fieldId, validateClosing } from '@/features/cms/validation'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'closing',
  source: () => closingForm(store.content!.closing),
  toPayload: closingPayload,
  validate: validateClosing,
  save: async (payload) => void (await store.saveSection('closing', payload)),
  live: (value) => ({ kind: 'section', section: 'closing', value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  message: t('closingMessage'),
  thankYou: t('thankYouLine'),
  'image.src': t('photo'),
  'image.alt': t('altText'),
  familyAcknowledgments: t('familyAcknowledgments'),
}))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="closing-form" @submit.prevent="draft.save()">
    <SectionHeader section="closing" :description="t('closingIntro')" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionClosing') }}</legend>
      <TextAreaField
        :id="fieldId('message')"
        v-model="form.message"
        :label="t('closingMessage')"
        :hint="t('closingMessageHint')"
        :error="errors.message"
        :needed-hint="t('neededBeforePublishing')"
      />
      <TextField :id="fieldId('thankYou')" v-model="form.thankYou" :label="t('thankYouLine')" :hint="t('thankYouHint')" :error="errors.thankYou" />
      <TextAreaField
        :id="fieldId('familyAcknowledgments')"
        v-model="form.familyAcknowledgments"
        :label="t('familyAcknowledgments')"
        :hint="t('familyAcknowledgmentsHint')"
        :rows="4"
        :error="errors.familyAcknowledgments"
      />
    </fieldset>
    <ImageField v-model="form.image" path="image" :label="t('photo')" :errors="errors" />
  </form>
</template>
