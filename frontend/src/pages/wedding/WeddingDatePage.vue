<script setup lang="ts">
/**
 * Wedding Date & Countdown (mandatory; the countdown is optional).
 *
 * The date is `opening.weddingDate` — the very same value the Opening page
 * edits (there is no second copy). It is saved through the opening section with
 * only the date changed. The countdown switches are their own section
 * ('countdown'), and stay siblings: turning the countdown off never hides the
 * date or the add-to-calendar choice.
 */
import { computed } from 'vue'

import SwitchField from '@/components/ui/SwitchField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import DateField from '@/features/cms/components/DateField.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useVariantCopy } from '@/features/cms/composables/useVariantCopy'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { clean, opt, s } from '@/features/cms/forms'
import { countdownForm, countdownPayload } from '@/features/cms/universalForms'
import { fieldId, validateWeddingDate } from '@/features/cms/validation'
import type { OpeningDraft } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
const { vt } = useVariantCopy()
useUnsavedChangesGuard()

/** The saved opening with only the date replaced (PUT /sections/opening replaces the section). */
const withDate = (date: string): OpeningDraft => clean({ ...store.content!.opening, weddingDate: opt(date) })

const dateDraft = useSectionDraft({
  key: 'weddingDate',
  source: () => ({ weddingDate: s(store.content!.opening.weddingDate) }),
  toPayload: (f) => opt(f.weddingDate) ?? '',
  validate: validateWeddingDate,
  save: async (date) => void (await store.saveSection('opening', withDate(date))),
  live: (date) => ({ kind: 'section', section: 'opening', value: withDate(date) }),
})
const countdownDraft = useSectionDraft({
  key: 'countdown',
  source: () => countdownForm(store.content!.countdown),
  toPayload: countdownPayload,
  save: async (payload) => void (await store.saveSection('countdown', payload)),
  live: (value) => ({ kind: 'section', section: 'countdown', value }),
  idScope: 'cd',
})
const dateForm = dateDraft.form
const countdown = countdownDraft.form
const labels = computed<Record<string, string>>(() => ({ weddingDate: vt('weddingDate') }))

async function saveAll() {
  await Promise.all([dateDraft.save(), countdownDraft.save()])
}
</script>

<template>
  <form class="space-y-8" novalidate data-testid="weddingDate-form" @submit.prevent="saveAll">
    <SectionHeader section="weddingDate" :description="vt('weddingDateIntro')" />
    <ErrorSummary :errors="dateDraft.errorList.value" :labels="labels" />
    <p v-if="dateDraft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ dateDraft.formError.value }}</p>

    <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <legend class="px-1 font-display text-xl font-semibold">{{ vt('weddingDate') }}</legend>
      <DateField
        :id="fieldId('weddingDate')"
        v-model="dateForm.weddingDate"
        :label="vt('weddingDate')"
        :hint="t('weddingDateShared')"
        :error="dateDraft.errors.value.weddingDate"
        :needed-hint="t('neededBeforePublishing')"
      />
    </fieldset>

    <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="countdown-options">
      <legend class="px-1 font-display text-xl font-semibold">{{ t('countdownOptions') }}</legend>
      <SwitchField :id="fieldId('enabled', 'cd')" v-model="countdown.enabled" :label="t('showCountdown')" :hint="vt('showCountdownHint')" />
      <SwitchField
        :id="fieldId('addToCalendar', 'cd')"
        v-model="countdown.addToCalendar"
        :label="t('addToCalendar')"
        :hint="t('addToCalendarHint')"
      />
    </fieldset>
  </form>
</template>
