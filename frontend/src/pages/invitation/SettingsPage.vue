<script setup lang="ts">
/**
 * Invitation settings (record fields, not content: no revision change):
 * internal title, website language, timezone, and the template — limited to
 * templates compatible with the variant. Each change saves on its own (PATCH).
 */
import { computed, ref, watch } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { localizedCatalogText, useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { fieldId } from '@/features/cms/validation'
import { compatibleTemplates, timezoneOptions } from '@/features/invitation/catalog'
import { variantOf, DEFAULT_TIMEZONE } from '@/features/invitation/registry'
import { checkInvitationTitle } from '@/features/invitation/validation'
import type { WeddingLocale } from '@/features/wedding/types'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t, locale: uiLocale } = useAppLocale()
const toast = useToast()

const title = ref(store.title ?? '')
watch(() => store.title, (v) => (title.value = v ?? ''))
const titleError = computed(() => (checkInvitationTitle(title.value).length ? t('errTooLong', { max: 120 }) : undefined))
const saving = ref<string | null>(null)

async function run(key: string, task: () => Promise<void>) {
  saving.value = key
  try {
    await task()
    toast.success(t('settingsSaved'))
  } catch {
    toast.error(t('settingsSaveFailed'))
  } finally {
    saving.value = null
  }
}

function saveTitle() {
  if (titleError.value || title.value.trim() === (store.title ?? '')) return
  void run('title', () => store.updateSettings({ title: title.value.trim() || null }))
}
const localeOptions = computed(() => [
  { value: 'id' as const, label: t('bahasa') },
  { value: 'en' as const, label: t('english') },
])
const timezone = computed(() => store.timezone ?? DEFAULT_TIMEZONE)
const zoneOptions = computed(() => timezoneOptions(timezone.value).map((z) => ({ value: z, label: z })))
const templates = computed(() => (store.variant ? compatibleTemplates(store.variant) : []))
const templateOptions = computed(() => {
  const opts = templates.value.map((tpl) => ({ value: tpl.id, label: localizedCatalogText(tpl.id, 'name', tpl.name) }))
  // A saved template that no longer fits stays visible so the select shows the truth.
  if (store.themeId && !opts.some((o) => o.value === store.themeId)) opts.unshift({ value: store.themeId, label: t('templateNotCompatible', { id: store.themeId }) })
  return opts
})
const variantLabel = computed(() => (store.variant ? variantOf(store.variant).label[uiLocale.value] : ''))
</script>

<template>
  <div class="space-y-8" data-testid="settings-page">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">{{ t('invitationSettings') }}</h1>
      <p class="text-sm text-ink-500">{{ t('invitationSettingsIntro', { variant: variantLabel }) }}</p>
    </header>

    <form class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" novalidate @submit.prevent="saveTitle">
      <TextField :id="fieldId('title', 'st')" v-model="title" :label="t('invitationTitleLabel')" :hint="t('invitationTitleHint')" :error="titleError" autocomplete="off" @blur="saveTitle" />
      <BaseButton type="submit" variant="secondary" :loading="saving === 'title'" data-action="save-title">{{ t('saveChanges') }}</BaseButton>
    </form>

    <div class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
      <SelectField
        :id="fieldId('locale', 'st')"
        :model-value="store.record?.locale ?? 'id'"
        :label="t('websiteLanguage')"
        :hint="t('websiteLanguageHint')"
        :options="localeOptions"
        @update:model-value="(v: WeddingLocale) => run('locale', () => store.setLocale(v))"
      />
      <SelectField
        :id="fieldId('timezone', 'st')"
        :model-value="timezone"
        :label="t('timezone')"
        :hint="t('timezoneHint')"
        :options="zoneOptions"
        @update:model-value="(v: string) => run('timezone', () => store.updateSettings({ timezone: v }))"
      />
      <SelectField
        v-if="templateOptions.length"
        :id="fieldId('themeId', 'st')"
        :model-value="store.themeId ?? templateOptions[0]!.value"
        :label="t('template')"
        :hint="t('templateCompatibleHint')"
        :options="templateOptions"
        @update:model-value="(v: string) => run('theme', () => store.setTheme(v))"
      />
    </div>
  </div>
</template>
