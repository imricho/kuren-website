<script setup lang="ts">
/** Closing "Turut mengundang" names (line breaks preserved). */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

const props = defineProps<{ content: WeddingContent }>()
const text = computed(() => props.content.closing.familyAcknowledgments?.trim())
</script>

<template>
  <div v-if="text" class="closing-family" data-role="family-acknowledgments">
    <p class="closing-family__label">{{ content.locale === 'id' ? 'Turut Mengundang' : 'Together with our families' }}</p>
    <p class="universal-text whitespace-pre-line" dir="auto">{{ text }}</p>
  </div>
</template>

<style>
.closing-family { margin-block: 1.5rem; }
.closing-family p { margin: 0; }
.closing-family__label { font-size: 0.75em; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; margin-block-end: 0.5rem !important; }
</style>
