<script setup lang="ts">
/** Polite live region for publish/unpublish outcomes (mounted once, in the editor layout). */
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()
const text = computed(() => {
  const a = store.publishAnnouncement
  if (!a) return ''
  switch (a.kind) {
    case 'published':
      return t('publishedAnnouncement')
    case 'updated':
      return t('publishedUpdateAnnouncement')
    case 'blocked':
      return t('publishBlockedAnnouncement', { count: a.count ?? 0 })
    case 'unpublished':
      return t('unpublishedAnnouncement')
    case 'unpublish_failed':
      return t('unpublishFailed')
    default:
      return t('publishFailedAnnouncement')
  }
})
</script>

<template>
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="publish-live">
    <span v-if="store.publishAnnouncement" :key="store.publishAnnouncement.seq">{{ text }}</span>
  </p>
</template>
