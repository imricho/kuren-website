<script setup lang="ts">
/** Organization (v2.0, corporate): name, tagline, about, logo upload and an https website link. */
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ImageField from '@/features/cms/components/ImageField.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { organizationForm, organizationPayload, validateOrganization } from '@/features/cms/invitationForms'
import { fieldId } from '@/features/cms/validation'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'organization',
  source: () => organizationForm(store.content!.organization),
  toPayload: organizationPayload,
  validate: validateOrganization,
  save: async (payload) => void (await store.saveSection('organization', payload)),
  live: (value) => ({ kind: 'section', section: 'organization', value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  name: t('organizationName'),
  tagline: t('organizationTagline'),
  description: t('organizationAbout'),
  websiteUrl: t('organizationWebsite'),
  'logo.src': t('organizationLogo'),
  'logo.alt': t('altText'),
}))
</script>

<template>
  <form class="space-y-8" novalidate data-testid="organization-form" @submit.prevent="draft.save()">
    <SectionHeader section="organization" :description="t('organizationIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="organization" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />
    <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>

    <div v-show="form.enabled" class="space-y-6" data-testid="section-fields">
      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
        <TextField :id="fieldId('name')" v-model="form.name" :label="t('organizationName')" autocomplete="organization" :error="errors.name" />
        <TextField :id="fieldId('tagline')" v-model="form.tagline" :label="t('organizationTagline')" :hint="t('optional')" :error="errors.tagline" />
        <TextAreaField :id="fieldId('description')" v-model="form.description" :label="t('organizationAbout')" :hint="t('optional')" :rows="4" :error="errors.description" />
        <TextField
          :id="fieldId('websiteUrl')"
          v-model="form.websiteUrl"
          type="url"
          inputmode="url"
          autocomplete="url"
          :label="t('organizationWebsite')"
          :hint="t('organizationWebsiteHint')"
          placeholder="https://"
          :error="errors.websiteUrl"
        />
      </fieldset>
      <ImageField v-model="form.logo" path="logo" :label="t('organizationLogo')" :hint="t('organizationLogoHint')" :errors="errors" :focal="false" fit="contain" />
    </div>
  </form>
</template>
