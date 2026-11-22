<script setup lang="ts">
/**
 * Profiles (v2.0): the celebrant, child, graduate, hosts or organizers. Roles are
 * limited to what the variant allows, and only the person fields the variant uses
 * are shown (e.g. parents for khitanan, birth date for aqiqah); values in hidden
 * fields are kept. Inline repeater, ≤ 20 people.
 */
import { computed } from 'vue'

import SelectField from '@/components/ui/SelectField.vue'
import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import AddRowButton from '@/features/cms/components/AddRowButton.vue'
import DateField from '@/features/cms/components/DateField.vue'
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
  isEmptyProfile,
  mapRowField,
  newProfilePerson,
  profileFieldsFor,
  profileRolesFor,
  profilesForm,
  profilesPayload,
  validateProfiles,
  type ProfileField,
  type ProfilePersonForm,
} from '@/features/cms/invitationForms'
import { fieldId } from '@/features/cms/validation'
import { INVITATION_LIMITS } from '@/features/invitation/validation'
import type { ProfileRole } from '@/features/invitation/registry'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const roles = computed(() => profileRolesFor(store.variant))
const shown = computed(() => new Set<ProfileField>(profileFieldsFor(store.variant)))

let rows = (): ProfilePersonForm[] => []
const draft = useSectionDraft({
  key: 'profiles',
  source: () => profilesForm(store.content!.profiles),
  toPayload: profilesPayload,
  validate: (f) => validateProfiles(f, roles.value),
  save: async (payload) => void (await store.saveSection('profiles', payload)),
  live: (value) => ({ kind: 'section', section: 'profiles', value }),
  mapServerField: (field) => mapRowField(field, 'people', rows(), isEmptyProfile),
})
const { form, errors } = draft
rows = () => form.value.people

const ROLE_LABEL: Record<ProfileRole, AppMessageKey> = {
  celebrant: 'roleCelebrant',
  child: 'roleChild',
  graduate: 'roleGraduate',
  host: 'roleHost',
  partner: 'rolePartner',
  organizer: 'roleOrganizer',
}
const roleOptions = computed(() => roles.value.map((r) => ({ value: r, label: t(ROLE_LABEL[r]) })))
const rowName = (p: ProfilePersonForm, i: number) => p.name.trim() || t('personN', { n: i + 1 })

const repeater = useRepeater({
  rows: () => form.value.people,
  setRows: (people) => (form.value.people = people),
  max: INVITATION_LIMITS.profiles,
  create: () => newProfilePerson(roles.value[0]!),
  isEmpty: isEmptyProfile,
  name: rowName,
  firstField: (i) => `people.${i}.name`,
  addAction: 'add-person',
})

const labels = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { title: t('sectionTitleLabel') }
  form.value.people.forEach((p, i) => {
    const n = rowName(p, i)
    out[`people.${i}.name`] = `${n} – ${t('fullName')}`
    out[`people.${i}.role`] = `${n} – ${t('profileRole')}`
    out[`people.${i}.nickname`] = `${n} – ${t('nickname')}`
    out[`people.${i}.description`] = `${n} – ${t('shortBio')}`
    out[`people.${i}.parents`] = `${n} – ${t('parentsLabel')}`
    out[`people.${i}.birthDate`] = `${n} – ${t('birthDate')}`
    out[`people.${i}.image.src`] = `${n} – ${t('photo')}`
    out[`people.${i}.image.alt`] = `${n} – ${t('altText')}`
  })
  return out
})
</script>

<template>
  <form class="space-y-8" novalidate data-testid="profiles-form" @submit.prevent="draft.save()">
    <SectionHeader section="profiles" :description="t('profilesIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="profiles" />
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

      <section class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="profiles-people">
        <h2 id="profiles-people" class="font-display text-xl font-semibold">{{ t('profilesPeople') }}</h2>
        <p v-if="form.people.length === 0" class="text-sm text-ink-500">{{ t('profilesEmpty') }}</p>
        <ol class="space-y-4" data-testid="people-rows">
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
              <SelectField
                v-if="roleOptions.length > 1"
                :id="fieldId(`people.${i}.role`)"
                v-model="p.role"
                :label="t('profileRole')"
                :options="roleOptions"
                :error="errors[`people.${i}.role`]"
              />
              <TextField
                v-if="shown.has('nickname')"
                :id="fieldId(`people.${i}.nickname`)"
                v-model="p.nickname"
                :label="t('nickname')"
                :hint="t('optional')"
                autocomplete="off"
                :error="errors[`people.${i}.nickname`]"
              />
              <DateField
                v-if="shown.has('birthDate')"
                :id="fieldId(`people.${i}.birthDate`)"
                v-model="p.birthDate"
                :label="t('birthDate')"
                :hint="t('optional')"
                :error="errors[`people.${i}.birthDate`]"
              />
            </div>
            <TextField
              v-if="shown.has('parents')"
              :id="fieldId(`people.${i}.parents`)"
              v-model="p.parents"
              :label="t('parentsLabel')"
              :hint="t('profileParentsHint')"
              autocomplete="off"
              :error="errors[`people.${i}.parents`]"
            />
            <TextAreaField
              v-if="shown.has('description')"
              :id="fieldId(`people.${i}.description`)"
              v-model="p.description"
              :label="t('shortBio')"
              :hint="t('optional')"
              :rows="3"
              :error="errors[`people.${i}.description`]"
            />
            <ImageField v-if="shown.has('image')" v-model="p.image" :path="`people.${i}.image`" :label="t('photo')" :errors="errors" />
          </RepeaterRow>
        </ol>
        <AddRowButton
          :label="t('addPerson')"
          action="add-person"
          :at-limit="repeater.atLimit.value"
          :limit-text="t('rowLimitReached', { max: INVITATION_LIMITS.profiles })"
          @add="repeater.add()"
        />
      </section>
    </div>
  </form>
</template>
