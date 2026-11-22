<script setup lang="ts">
/** Wishes & Prayers (optional). There is no online guestbook yet, and we say so. */
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { wishesForm, wishesPayload } from '@/features/cms/universalForms'
import { fieldId, validateWishes } from '@/features/cms/validation'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'wishes',
  source: () => wishesForm(store.content!.wishes),
  toPayload: wishesPayload,
  validate: validateWishes,
  save: async (payload) => void (await store.saveSection('wishes', payload)),
  live: (value) => ({ kind: 'section', section: 'wishes', value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({ title: t('sectionTitleLabel'), introduction: t('introduction') }))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="wishes-form" @submit.prevent="draft.save()">
    <SectionHeader section="wishes" :description="t('wishesIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="wishes" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <p class="rounded-md bg-canvas px-3 py-2 text-sm text-ink-700 ring-1 ring-line" role="note" data-testid="wishes-coming-soon">
      {{ t('wishesComingSoon') }}
    </p>
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset v-show="form.enabled" class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="section-fields">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
      <TextField :id="fieldId('title')" v-model="form.title" :label="t('sectionTitleLabel')" :error="errors.title" />
      <TextAreaField :id="fieldId('introduction')" v-model="form.introduction" :label="t('introduction')" :rows="3" :error="errors.introduction" />
    </fieldset>
  </form>
</template>
