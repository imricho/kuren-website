<script setup lang="ts">
/**
 * Cover for a collection card. Uses the collection's cover or its first
 * template's thumbnail; otherwise a neutral typographic cover.
 * (No invented cultural imagery for collections that haven't been designed
 * and reviewed yet.)
 */
import { computed } from 'vue'

import { availableTemplatesOf } from '../core/registry'
import type { ThemeCollection } from '../core/types'

const props = defineProps<{ collection: ThemeCollection }>()

const image = computed(() => props.collection.coverImage ?? availableTemplatesOf(props.collection.id)[0]?.previewImage)
</script>

<template>
  <div class="relative aspect-[16/10] overflow-hidden bg-canvas">
    <img
      v-if="image"
      :src="image"
      alt=""
      class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      loading="lazy"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_top,var(--color-rose-50),var(--color-canvas)_70%)] px-6 text-center"
      aria-hidden="true"
    >
      <span class="h-px w-10 bg-rose-500/40" />
      <span class="font-display text-3xl font-semibold text-ink-700">{{ collection.name }}</span>
      <span v-if="collection.reference.region" class="text-xs tracking-wide text-ink-500 uppercase">
        {{ collection.reference.region }}
      </span>
      <span class="h-px w-10 bg-rose-500/40" />
    </div>
  </div>
</template>
