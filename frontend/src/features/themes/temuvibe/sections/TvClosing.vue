<script setup lang="ts">
/** Closing message, thanks, family acknowledgements and a signature line. */
import type { WeddingContent } from '@/features/wedding/types'

import FamilyAcknowledgments from '../../core/components/FamilyAcknowledgments.vue'
import ThemeImage from '../../core/components/ThemeImage.vue'

defineProps<{ content: WeddingContent; signature?: string }>()
</script>

<template>
  <footer data-section="closing" class="tv-closing">
    <div class="tv-inner tv-center">
      <div v-if="content.closing.image" class="tv-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <span class="tv-rule" aria-hidden="true" />
      <p class="tv-closing__message tv-pre" dir="auto">{{ content.closing.message }}</p>
      <p v-if="content.closing.thankYou" class="tv-body tv-pre" dir="auto">{{ content.closing.thankYou }}</p>
      <FamilyAcknowledgments :content="content" />
      <p v-if="signature" class="tv-closing__signature" dir="auto">{{ signature }}</p>
    </div>
  </footer>
</template>
