<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-ink-900">
    <svg :class="size === 'lg' ? 'size-9' : 'size-7'" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="10" class="fill-rose-600" />
      <path d="M5 16c3-7 8-7 11 0s8 7 11 0M5 16c3 7 8 7 11 0s8-7 11 0" stroke="#fff7ef" stroke-width="2" stroke-linecap="round" />
    </svg>
    <span :class="['font-display font-semibold tracking-tight', size === 'lg' ? 'text-3xl' : 'text-2xl']">temuvibe.</span>
  </span>
</template>
