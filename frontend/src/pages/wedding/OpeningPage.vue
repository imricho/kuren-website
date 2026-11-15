<script setup lang="ts">
/**
 * Opening: the first screen guests see. The couple's names here are the same
 * data as on the Couple page (couple.groom.name / couple.bride.name).
 */
import { computed } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import DateField from '@/features/cms/components/DateField.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ImageField from '@/features/cms/components/ImageField.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { clean, openingForm, openingPayload, type OpeningForm } from '@/features/cms/forms'
import { fieldId, validateOpening } from '@/features/cms/validation'
import { deriveCoupleNames } from '@/features/wedding/draft'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()

const toPayload = (f: OpeningForm) => ({
  opening: openingPayload(f),
  groom: f.groomName.trim(),
  bride: f.brideName.trim(),
  locale: f.locale,
})

const draft = useSectionDraft({
  key: 'opening',
  source: () => openingForm(store.content!.opening, store.content!.couple, store.content!.locale),
  toPayload,
  validate: validateOpening,
  // Opening details, the couple's names and the website language, live in the preview.
  live: (p) => [
    { kind: 'section', section: 'opening', value: p.opening },
    { kind: 'names', groom: p.groom, bride: p.bride },
    { kind: 'locale', locale: p.locale },
  ],
  // Up to three requests, each only if its part changed; after each success that
  // part of the baseline is resynced, so a later failure leaves only that part dirty.
  async save(payload, _form, { commit }) {
    const saved = () => openingForm(store.content!.opening, store.content!.couple, store.content!.locale)
    if (JSON.stringify(openingPayload(saved())) !== JSON.stringify(payload.opening)) {
      await store.saveSection('opening', payload.opening)
      const f = saved()
      commit({
        weddingTitle: f.weddingTitle,
        weddingDate: f.weddingDate,
        coupleNames: f.coupleNames,
        headline: f.headline,
        introduction: f.introduction,
        coverImage: f.coverImage,
      })
    }
    const couple = store.content!.couple
    if ((couple.groom.name ?? '') !== payload.groom || (couple.bride.name ?? '') !== payload.bride) {
      await store.saveSection('couple', {
        groom: clean({ ...couple.groom, name: payload.groom || undefined }),
        bride: clean({ ...couple.bride, name: payload.bride || undefined }),
      })
      const f = saved()
      commit({ groomName: f.groomName, brideName: f.brideName })
    }
    if (payload.locale !== store.content!.locale) {
      await store.setLocale(payload.locale)
      commit({ locale: saved().locale })
    }
  },
  // Couple-name errors come back from the couple section as "groom.name" / "bride.name".
  mapServerField: (field) => (/^(groom|bride)\./.test(field) ? `couple.${field}` : field),
})
const { form, errors } = draft
useUnsavedChangesGuard()

const derivedNames = computed(() =>
  deriveCoupleNames({
    groom: { name: form.value.groomName, nickname: store.content!.couple.groom.nickname },
    bride: { name: form.value.brideName, nickname: store.content!.couple.bride.nickname },
  }),
)
const coupleNamesHint = computed(() =>
  derivedNames.value ? t('coupleNamesHintDerived', { names: derivedNames.value }) : t('coupleNamesHint'),
)
const needed = t('neededBeforePublishing')
const localeOptions = computed(() => [
  { value: 'en', label: t('english') },
  { value: 'id', label: t('bahasa') },
])
const labels = computed<Record<string, string>>(() => ({
  'couple.groom.name': t('groomName'),
  'couple.bride.name': t('brideName'),
  weddingTitle: t('weddingTitle'),
  weddingDate: t('weddingDate'),
  coupleNames: t('coupleNamesLabel'),
  headline: t('headline'),
  introduction: t('introduction'),
  'coverImage.src': t('coverImage'),
  'coverImage.alt': t('altText'),
}))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="opening-form" @submit.prevent="draft.save()">
    <SectionHeader section="opening" :description="t('openingIntro')" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('theCouple') }}</legend>
      <p class="text-xs text-ink-500">{{ t('namesSharedHint') }}</p>
      <div class="grid min-w-0 gap-4 sm:grid-cols-2">
        <TextField
          :id="fieldId('couple.bride.name')"
          v-model="form.brideName"
          :label="t('brideName')"
          :error="errors['couple.bride.name']"
          :needed-hint="needed"
          autocomplete="off"
        />
        <TextField
          :id="fieldId('couple.groom.name')"
          v-model="form.groomName"
          :label="t('groomName')"
          :error="errors['couple.groom.name']"
          :needed-hint="needed"
          autocomplete="off"
        />
      </div>
    </fieldset>

    <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('theWedding') }}</legend>
      <TextField
        :id="fieldId('weddingTitle')"
        v-model="form.weddingTitle"
        :label="t('weddingTitle')"
        :hint="t('weddingTitleHint')"
        :error="errors.weddingTitle"
        :needed-hint="needed"
      />
      <DateField
        :id="fieldId('weddingDate')"
        v-model="form.weddingDate"
        :label="t('weddingDate')"
        :error="errors.weddingDate"
        :needed-hint="needed"
      />
      <TextField
        :id="fieldId('coupleNames')"
        v-model="form.coupleNames"
        :label="t('coupleNamesLabel')"
        :hint="coupleNamesHint"
        :error="errors.coupleNames"
      />
      <TextField :id="fieldId('headline')" v-model="form.headline" :label="t('headline')" :hint="t('headlineHint')" :error="errors.headline" />
      <TextAreaField
        :id="fieldId('introduction')"
        v-model="form.introduction"
        :label="t('introduction')"
        :error="errors.introduction"
      />
      <SelectField
        :id="fieldId('locale')"
        v-model="form.locale"
        :label="t('websiteLanguage')"
        :hint="t('websiteLanguageHint')"
        :options="localeOptions"
      />
    </fieldset>

    <ImageField v-model="form.coverImage" path="coverImage" :label="t('coverImage')" :errors="errors" :hint="t('coverImageHint')" />
  </form>
</template>
