<script setup lang="ts">
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import { useWeddingStore } from '@/stores/wedding'

import { sectionByKey } from '../sections'
import SectionStatusBadge from './SectionStatusBadge.vue'

const props = defineProps<{ section: SectionKey; description?: string }>()
const { t } = useAppLocale()
const store = useWeddingStore()
const status = computed(() => store.completeness.sections[props.section].status)
</script>

<template>
  <header class="space-y-2">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold">{{ t(sectionByKey(section).label) }}</h1>
      <SectionStatusBadge :status="status" />
    </div>
    <p v-if="description" class="max-w-2xl text-sm text-ink-500">{{ description }}</p>
    <slot />
  </header>
</template>
