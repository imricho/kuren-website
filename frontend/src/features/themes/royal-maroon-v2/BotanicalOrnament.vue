<script setup lang="ts">
import spray from './assets/botanical-engraving.webp'
import corner from './assets/botanical-corner.webp'
import vine from './assets/botanical-vine.webp'
import wreath from './assets/botanical-wreath.webp'

withDefaults(defineProps<{ kind?: 'spray' | 'wreath' | 'vine' | 'corner' | 'rosette' }>(), { kind: 'spray' })
const artwork = { spray, corner, vine, wreath }
</script>

<template>
  <svg v-if="kind === 'rosette'" class="rm2-art rm2-art--rosette" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="60" cy="60" r="45" stroke-width=".65" />
      <circle cx="60" cy="60" r="36" stroke-dasharray="1 5" stroke-linecap="round" />
      <g v-for="n in 8" :key="n" :transform="`rotate(${n * 45} 60 60)`">
        <path d="M60 60C44 50 44 35 60 22C76 35 76 50 60 60Z" fill="currentColor" fill-opacity=".13" />
        <path d="M60 57V27M60 42L54 35M60 48L67 39" stroke-width=".8" />
      </g>
      <circle cx="60" cy="60" r="9" fill="currentColor" fill-opacity=".65" />
      <circle cx="60" cy="60" r="4" />
      <path d="M60 7V12M60 108V113M7 60H12M108 60H113" />
    </g>
  </svg>
  <span v-else class="rm2-art" :class="`rm2-art--${kind}`" :style="{ backgroundImage: `url(${artwork[kind]})` }" aria-hidden="true" />
</template>
