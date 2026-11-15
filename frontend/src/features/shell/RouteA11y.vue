<script setup lang="ts">
// Renderless: localized document titles + focus management on route change.
import { useRouteA11y } from '@/composables/useRouteA11y'

useRouteA11y()
</script>

<template>
  <span hidden />
</template>
