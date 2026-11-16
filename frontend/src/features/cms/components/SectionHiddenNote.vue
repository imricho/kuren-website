<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'

const { t } = useAppLocale()
</script>

<template>
  <p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="section-hidden-note">
    {{ t('sectionHiddenFromInvitation') }}
  </p>
</template>
