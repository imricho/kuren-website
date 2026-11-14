<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'
const { t } = useAppLocale()
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
    <p class="font-display text-7xl text-rose-500">404</p>
    <h1 class="mt-4 text-3xl font-semibold">{{ t('pageNotFound') }}</h1>
    <RouterLink to="/" class="mt-6 text-sm font-medium text-rose-600 hover:text-rose-700">{{ t('backHome') }}</RouterLink>
  </main>
</template>
