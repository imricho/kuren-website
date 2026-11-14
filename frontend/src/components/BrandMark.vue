<script setup lang="ts">
// Working product name; change it here (and in index.html) when branding is final.
withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-ink-900">
    <svg
      :class="size === 'lg' ? 'size-9' : 'size-7'"
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" class="fill-rose-600" />
      <circle cx="13" cy="17" r="6" fill="none" stroke="#fbf8f4" stroke-width="2" />
      <circle cx="19" cy="17" r="6" fill="none" stroke="#fbf8f4" stroke-width="2" />
    </svg>
    <span :class="['font-display font-semibold', size === 'lg' ? 'text-3xl' : 'text-2xl']">Kuren</span>
  </span>
</template>
