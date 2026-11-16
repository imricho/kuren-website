<script setup lang="ts">
/**
 * "Show on website" switch for an optional section, in a row under the section
 * h1. Changing it announces "{section} shown/hidden …" politely; focus stays on
 * the switch. Pair with <SectionHiddenNote> and hide (v-show) the form fields
 * while off — drafts are kept.
 */
import { computed, ref, watch } from 'vue'

import SwitchField from '@/components/ui/SwitchField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'

import { sectionByKey } from '../sections'
import { fieldId } from '../validation'

const props = withDefaults(defineProps<{ section: SectionKey; id?: string; hint?: string }>(), { id: undefined, hint: undefined })
const model = defineModel<boolean>({ required: true })
const { t } = useAppLocale()

const name = computed(() => t(sectionByKey(props.section).label))
const announcement = ref('')
watch(model, (on, before) => {
  if (on === before) return
  announcement.value = t(on ? 'sectionShownAnnounce' : 'sectionHiddenAnnounce', { section: name.value })
})
</script>

<template>
  <div class="rounded-lg border border-line bg-surface px-4 py-3" data-testid="section-toggle">
    <SwitchField :id="id ?? fieldId('enabled')" v-model="model" :label="t('showOnWebsite')" :hint="hint ?? t('showSectionHint')" />
    <p class="sr-only" aria-live="polite" data-testid="section-toggle-status">{{ announcement }}</p>
  </div>
</template>
