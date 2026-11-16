<script setup lang="ts">
/** Optional prayer/blessing line of the Greeting section (line breaks preserved). */
import { computed } from 'vue'

const props = defineProps<{ prayer?: string }>()
const text = computed(() => props.prayer?.trim())
</script>

<template>
  <p v-if="text" class="universal-text greeting-prayer whitespace-pre-line" dir="auto" data-role="prayer">{{ text }}</p>
</template>

<style>
.greeting-prayer { font-style: italic; margin-block-start: 1.25rem; }
</style>
