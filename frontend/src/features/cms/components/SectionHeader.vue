<script setup lang="ts">
/**
 * Section page header: h1 (focus target on section change), status badge, and
 * the visibility row — an "Always shown" badge for mandatory sections, or the
 * page's <SectionToggle> passed in the `toggle` slot for optional ones.
 */
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import { useInvitationStore } from '@/stores/invitation'

import { isMandatorySection, sectionByKey } from '../sections'
import SectionStatusBadge from './SectionStatusBadge.vue'

const props = defineProps<{ section: SectionKey; description?: string }>()
const { t } = useAppLocale()
const store = useInvitationStore()
const status = computed(() => store.completeness.sections[props.section].status)
const mandatory = computed(() => isMandatorySection(props.section, store.variant))
</script>

<template>
  <header class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold">{{ t(sectionByKey(section, store.variant).label) }}</h1>
      <SectionStatusBadge :status="status" />
      <span
        v-if="mandatory"
        class="inline-flex shrink-0 items-center rounded-full bg-canvas px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-700 ring-1 ring-line"
        data-testid="always-shown"
      >
        {{ t('alwaysShown') }}
      </span>
    </div>
    <p v-if="description" class="max-w-2xl text-sm text-ink-500">{{ description }}</p>
    <slot name="toggle" />
    <slot />
  </header>
</template>
