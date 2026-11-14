<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'error' | 'success' }>(), { tone: 'error' })
</script>

<template>
  <div
    :role="tone === 'error' ? 'alert' : 'status'"
    :class="[
      'rounded-lg px-3.5 py-3 text-sm',
      tone === 'error' ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600',
    ]"
  >
    <slot />
  </div>
</template>
