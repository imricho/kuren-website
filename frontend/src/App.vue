<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Toasts are app-wide so full-screen pages (previews) can show them too. Loaded
// asynchronously so the UI message tables stay out of the entry chunk.
const ToastRegion = defineAsyncComponent(() => import('@/components/ui/ToastRegion.vue'))
// Localized document titles and focus-on-navigate (async for the same reason).
const RouteA11y = defineAsyncComponent(() => import('@/features/shell/RouteA11y.vue'))
</script>

<template>
  <RouterView />
  <ToastRegion />
  <RouteA11y />
</template>
