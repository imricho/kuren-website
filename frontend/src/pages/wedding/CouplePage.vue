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
import { coupleForm, couplePayload } from '@/features/cms/forms'
import { fieldId, validateCouple } from '@/features/cms/validation'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()

const draft = useSectionDraft({
  key: 'couple',
  source: () => coupleForm(store.content!.couple),
  toPayload: couplePayload,
  validate: validateCouple,
  save: async (payload) => void (await store.saveSection('couple', payload)),
  live: (value) => ({ kind: 'section', section: 'couple', value }),
})
const { form, errors } = draft
useUnsavedChangesGuard()

const people = computed(() => [
  { role: 'groom' as const, legend: t('theGroom'), parentsPlaceholder: t('parentsPlaceholderGroom') },
  { role: 'bride' as const, legend: t('theBride'), parentsPlaceholder: t('parentsPlaceholderBride') },
])
const needed = t('neededBeforePublishing')
const labels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const p of people.value) {
    out[`${p.role}.name`] = `${p.legend} · ${t('fullName')}`
    out[`${p.role}.nickname`] = `${p.legend} · ${t('nickname')}`
    out[`${p.role}.description`] = `${p.legend} · ${t('shortBio')}`
    out[`${p.role}.parents`] = `${p.legend} · ${t('parentsLabel')}`
    out[`${p.role}.instagramUrl`] = `${p.legend} · ${t('instagramUrl')}`
    out[`${p.role}.image.src`] = `${p.legend} · ${t('photo')}`
    out[`${p.role}.image.alt`] = `${p.legend} · ${t('altText')}`
  }
  return out
})
</script>

<template>
  <form class="space-y-8" novalidate data-testid="couple-form" @submit.prevent="draft.save()">
    <SectionHeader section="couple" :description="t('coupleIntro')" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <fieldset
      v-for="p in people"
      :key="p.role"
      class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6"
    >
      <legend class="px-1 font-display text-xl font-semibold">{{ p.legend }}</legend>
      <div class="grid min-w-0 gap-4 sm:grid-cols-2">
        <TextField
          :id="fieldId(`${p.role}.name`)"
          v-model="form[p.role].name"
          :label="t('fullName')"
          :error="errors[`${p.role}.name`]"
          :needed-hint="needed"
          autocomplete="off"
        />
        <TextField
          :id="fieldId(`${p.role}.nickname`)"
          v-model="form[p.role].nickname"
          :label="t('nickname')"
          :hint="t('nicknameHint')"
          :error="errors[`${p.role}.nickname`]"
          autocomplete="off"
        />
      </div>
      <TextField
        :id="fieldId(`${p.role}.parents`)"
        v-model="form[p.role].parents"
        :label="t('parentsLabel')"
        :hint="t('parentsHint')"
        :placeholder="p.parentsPlaceholder"
        :error="errors[`${p.role}.parents`]"
        :maxlength="200"
        autocomplete="off"
      />
      <TextAreaField
        :id="fieldId(`${p.role}.description`)"
        v-model="form[p.role].description"
        :label="t('shortBio')"
        :hint="t('shortBioHint')"
        :error="errors[`${p.role}.description`]"
        :rows="3"
      />
      <TextField
        :id="fieldId(`${p.role}.instagramUrl`)"
        v-model="form[p.role].instagramUrl"
        :label="t('instagramUrl')"
        :hint="t('instagramHint')"
        :error="errors[`${p.role}.instagramUrl`]"
        inputmode="url"
        placeholder="https://www.instagram.com/…"
      />
      <ImageField v-model="form[p.role].image" :path="`${p.role}.image`" :label="t('photo')" :errors="errors" />
    </fieldset>
  </form>
</template>
