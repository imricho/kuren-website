<script setup lang="ts">
// Working product name; change it here (and in index.html) when branding is final.
withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
  <span class="inline-flex items-center gap-2.5 text-ink-900">
    <svg
      :class="size === 'lg' ? 'size-9' : 'size-7'"
      viewBox="0 0 36 42"
      fill="none"
      aria-hidden="true"
      class="text-[#c6a574]"
    >
      <path d="M15 39c0-14 3-24 12-34M17 29C5 29 3 21 4 15c10 0 15 6 13 14Zm3-11C11 16 11 6 16 2c7 5 8 11 4 16Zm4-4c1-10 7-12 10-11 0 8-4 13-10 11Zm-9 21C5 38 1 33 1 28c8-2 14 0 14 7Zm6-11c8-7 13-5 14-1-6 6-10 7-14 1Z" stroke="currentColor" stroke-width="1.2" />
    </svg>
    <span :class="['font-display font-semibold', size === 'lg' ? 'text-3xl' : 'text-2xl']">Kuren</span>
  </span>
</template>
