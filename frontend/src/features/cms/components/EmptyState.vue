<script setup lang="ts">
defineProps<{ title: string; body?: string }>()
</script>

<template>
  <div class="rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-6 py-10 text-center">
    <p class="font-display text-2xl font-semibold text-ink-900">{{ title }}</p>
    <p v-if="body" class="mx-auto mt-2 max-w-md text-sm text-ink-500">{{ body }}</p>
    <div v-if="$slots.default" class="mt-5 flex justify-center"><slot /></div>
  </div>
</template>
