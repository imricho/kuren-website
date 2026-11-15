<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'
const { t } = useAppLocale()
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
    <p class="font-display text-7xl text-rose-600" aria-hidden="true">404</p>
    <h1 class="mt-4 text-3xl font-semibold break-words">{{ t('pageNotFound') }}</h1>
    <RouterLink to="/" class="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-rose-700 hover:underline">{{ t('backHome') }}</RouterLink>
  </main>
</template>
