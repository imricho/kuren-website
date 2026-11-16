<script setup lang="ts">
/**
 * Holy Recite 1 or 2: an optional sacred text, stored and shown exactly as the
 * couple enters it. The two are independent sections; nothing is ever copied
 * from one to the other, suggested or pre-filled.
 */
import { computed } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { controlClasses } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import ErrorSummary from '../ErrorSummary.vue'
import SectionHeader from '../SectionHeader.vue'
import SectionHiddenNote from '../SectionHiddenNote.vue'
import SectionToggle from '../SectionToggle.vue'
import { useSectionDraft } from '../../composables/useSectionDraft'
import { useUnsavedChangesGuard } from '../../composables/useUnsavedChangesGuard'
import { holyReciteForm, holyRecitePayload } from '../../universalForms'
import { fieldId, validateHolyRecite } from '../../validation'
import { useWeddingStore } from '@/stores/wedding'
import { langOrUndefined, SCRIPTURE_LANGUAGES } from '@/features/wedding/languages'

const props = defineProps<{ section: 'holyRecite1' | 'holyRecite2' }>()
const store = useWeddingStore()
const { t } = useAppLocale()
// Fixed for this instance: the page re-creates the editor (key) when the route switches 1 ↔ 2.
const section = props.section
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: section,
  source: () => holyReciteForm(store.content![section]),
  toPayload: holyRecitePayload,
  validate: validateHolyRecite,
  save: async (payload) => void (await store.saveSection(section, payload)),
  live: (value) => ({ kind: 'section', section, value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  title: t('reciteHeading'),
  tradition: t('reciteTradition'),
  book: t('reciteBook'),
  reference: t('reciteReference'),
  originalScript: t('reciteOriginal'),
  passage: t('recitePassage'),
  translation: t('reciteTranslation'),
  translationLanguage: t('reciteTranslationLanguage'),
  originalLanguage: t('reciteOriginalLanguage'),
  attribution: t('reciteAttribution'),
}))
const originalId = fieldId('originalScript')
/** Language choices; a stored code outside the list is kept as its own option. */
function languageOptions(current: string) {
  const list = [{ value: '', label: t('languageNotSpecified') }, ...SCRIPTURE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))]
  return current && !list.some((o) => o.value === current) ? [...list, { value: current, label: current }] : list
}
const originalLang = computed(() => langOrUndefined(form.value.originalLanguage))
const originalDescribedBy = computed(() => (errors.value.originalScript ? `${originalId}-msg` : `${originalId}-hint`))
</script>

<template>
  <form class="space-y-8" novalidate :data-testid="`${section}-form`" :data-recite="section" @submit.prevent="draft.save()">
    <SectionHeader :section="section" :description="t('holyReciteIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" :section="section" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <div v-show="form.enabled" class="space-y-8" data-testid="section-fields">
      <p class="rounded-md bg-canvas px-3 py-2 text-sm text-ink-700 ring-1 ring-line" data-testid="recite-guidance">
        {{ t('reciteGuidance') }}
      </p>

      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('reciteText') }}</legend>
        <TextField :id="fieldId('title')" v-model="form.title" :label="t('reciteHeading')" :hint="t('optional')" :error="errors.title" />

        <div class="min-w-0 space-y-1.5">
          <label :for="originalId" class="block text-sm font-medium text-ink-700">{{ t('reciteOriginal') }}</label>
          <!-- Any script, incl. RTL: the browser picks the direction; no language is assumed. -->
          <textarea
            :id="originalId"
            v-model="form.originalScript"
            dir="auto"
            :lang="originalLang"
            rows="5"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            :aria-invalid="errors.originalScript ? true : undefined"
            :aria-describedby="originalDescribedBy"
            :class="['resize-y px-3.5 py-2.5 text-xl leading-loose', controlClasses(errors.originalScript)]"
            style="font-family: Amiri, 'Scheherazade New', 'Noto Naskh Arabic', 'Geeza Pro', serif"
            data-testid="original-script"
          />
          <p v-if="errors.originalScript" :id="`${originalId}-msg`" class="text-xs text-danger-600">{{ errors.originalScript }}</p>
          <p v-else :id="`${originalId}-hint`" class="text-xs text-ink-500">{{ t('reciteOriginalHint') }}</p>
        </div>
        <SelectField
          :id="fieldId('originalLanguage')"
          v-model="form.originalLanguage"
          :label="t('reciteOriginalLanguage')"
          :hint="t('reciteLanguageHint')"
          :options="languageOptions(form.originalLanguage)"
          :error="errors.originalLanguage"
        />

        <TextAreaField
          :id="fieldId('passage')"
          v-model="form.passage"
          :label="t('recitePassage')"
          :hint="t('reciteLineBreaks')"
          :rows="4"
          :error="errors.passage"
        />
        <TextAreaField
          :id="fieldId('translation')"
          v-model="form.translation"
          :label="t('reciteTranslation')"
          :hint="t('reciteLineBreaks')"
          :rows="4"
          :error="errors.translation"
        />
        <SelectField
          :id="fieldId('translationLanguage')"
          v-model="form.translationLanguage"
          :label="t('reciteTranslationLanguage')"
          :hint="t('reciteLanguageHint')"
          :options="languageOptions(form.translationLanguage)"
          :error="errors.translationLanguage"
        />
      </fieldset>

      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('reciteSource') }}</legend>
        <div class="grid min-w-0 gap-4 sm:grid-cols-2">
          <TextField :id="fieldId('tradition')" v-model="form.tradition" :label="t('reciteTradition')" :hint="t('optional')" :error="errors.tradition" />
          <TextField :id="fieldId('book')" v-model="form.book" :label="t('reciteBook')" :hint="t('optional')" :error="errors.book" />
        </div>
        <TextField :id="fieldId('reference')" v-model="form.reference" :label="t('reciteReference')" :hint="t('reciteReferenceHint')" :error="errors.reference" />
        <TextField :id="fieldId('attribution')" v-model="form.attribution" :label="t('reciteAttribution')" :hint="t('reciteAttributionHint')" :error="errors.attribution" />
      </fieldset>
    </div>
  </form>
</template>
