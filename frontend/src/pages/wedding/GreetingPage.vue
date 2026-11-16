<script setup lang="ts">
/**
 * Greeting & Introduction (optional). With nothing stored yet the form starts
 * from the legacy Opening headline/introduction — switched off, and saved only
 * once the couple changes something.
 */
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
import { greetingForm, greetingPayload } from '@/features/cms/universalForms'
import { fieldId, validateGreeting } from '@/features/cms/validation'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'greeting',
  source: () => greetingForm(store.content!.greeting, store.content!.opening),
  toPayload: greetingPayload,
  validate: validateGreeting,
  save: async (payload) => void (await store.saveSection('greeting', payload)),
  live: (value) => ({ kind: 'section', section: 'greeting', value }),
})
const { form, errors } = draft
const seeded = computed(() => !store.content!.greeting && !!(store.content!.opening.headline || store.content!.opening.introduction))
const labels = computed<Record<string, string>>(() => ({
  title: t('greetingTitle'),
  message: t('greetingMessage'),
  prayer: t('greetingPrayer'),
}))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="greeting-form" @submit.prevent="draft.save()">
    <SectionHeader section="greeting" :description="t('greetingIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="greeting" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset v-show="form.enabled" class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="section-fields">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionGreeting') }}</legend>
      <p v-if="seeded" class="text-xs text-ink-500" data-testid="greeting-seeded">{{ t('greetingSeeded') }}</p>
      <TextField :id="fieldId('title')" v-model="form.title" :label="t('greetingTitle')" :error="errors.title" />
      <TextAreaField :id="fieldId('message')" v-model="form.message" :label="t('greetingMessage')" :rows="4" :error="errors.message" />
      <TextAreaField :id="fieldId('prayer')" v-model="form.prayer" :label="t('greetingPrayer')" :hint="t('optional')" :rows="3" :error="errors.prayer" />
    </fieldset>
  </form>
</template>
