<script setup lang="ts">
/**
 * Image with the behaviour every theme needs: lazy loading, focal-point
 * cropping, safe sources, and a graceful placeholder when the image is
 * missing or fails to load. Themes control size/shape via the wrapper.
 */
import { computed, ref, watch } from 'vue'

import { isDisplayableImageSrc } from '@/features/wedding/draft'
import { focalPosition } from '@/features/wedding/format'
import type { ImageAsset } from '@/features/wedding/types'

const props = withDefaults(
  defineProps<{
    image?: ImageAsset
    /** Load immediately (above-the-fold images such as the cover). */
    eager?: boolean
  }>(),
  { eager: false },
)

const failed = ref(false)
watch(
  () => props.image?.src,
  () => (failed.value = false),
)

const usable = computed(() => !failed.value && isDisplayableImageSrc(props.image?.src))
</script>

<template>
  <img
    v-if="usable && image"
    class="theme-image"
    :src="image.src"
    :alt="image.alt"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : undefined"
    decoding="async"
    :style="{ objectPosition: focalPosition(image) }"
    @error="failed = true"
  />
  <span v-else class="theme-image--placeholder" role="img" :aria-label="image?.alt || 'Image unavailable'" />
</template>
