<script setup lang="ts">
/**
 * Compact publishing status chip + "Publish" link for the editor header row
 * (desktop) and the mobile tab bar. Opens the Preview & Publish page.
 */
import { computed } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import { PUBLISH_ROUTE_NAME } from '@/features/cms/sections'
import { useInvitationStore } from '@/stores/invitation'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const store = useInvitationStore()
const { t } = useAppLocale()

const chip = computed(() => {
  switch (store.publishState) {
    case 'publishing':
      return { label: t('publishChipPublishing'), tone: 'bg-rose-50 text-rose-700 ring-rose-700/20' }
    case 'failed':
      return { label: t('publishChipFailed'), tone: 'bg-danger-50 text-danger-600 ring-danger-600/30' }
    case 'unpublished_changes':
      return { label: t('publishChipChanges'), tone: 'bg-amber-50 text-amber-800 ring-amber-700/20' }
    case 'published':
      return { label: t('publishChipPublished'), tone: 'bg-emerald-50 text-emerald-800 ring-emerald-700/20' }
    default:
      return { label: t('publishChipDraft'), tone: 'bg-canvas text-ink-700 ring-line' }
  }
})
const action = computed(() => (store.publishState === 'unpublished_changes' ? t('publishUpdateAction') : t('publishAction')))
</script>

<template>
  <div class="flex shrink-0 items-center gap-2" data-testid="publish-chip" :data-state="store.publishState">
    <span
      :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1', chip.tone, compact && 'max-sm:sr-only']"
      data-testid="publish-chip-status"
    >
      <span class="sr-only">{{ t('publishStatusLabel') }}: </span>{{ chip.label }}
    </span>
    <RouterLink
      :to="{ name: PUBLISH_ROUTE_NAME }"
      :class="[
        'inline-flex items-center rounded-lg bg-rose-600 px-3 text-sm font-medium whitespace-nowrap text-white shadow-sm hover:bg-rose-700',
        compact ? 'min-h-11' : 'h-8',
        FOCUS_RING,
      ]"
      data-action="open-publish"
    >
      {{ action }}
    </RouterLink>
  </div>
</template>
