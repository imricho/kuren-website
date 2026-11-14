<script setup lang="ts">
/** Original floral sprig: curved stem, paired leaves, five-petal blossom and buds. */
withDefaults(defineProps<{ petal?: string; centre?: string; leaf?: string }>(), {
  petal: 'var(--conv-rose)',
  centre: 'var(--conv-gold)',
  leaf: 'var(--conv-sage)',
})
</script>

<template>
  <svg class="conv-sprig" viewBox="0 0 120 170" aria-hidden="true" focusable="false">
    <path d="M60 168 C56 130 66 96 60 52" fill="none" :stroke="leaf" stroke-width="2" stroke-linecap="round" />
    <path d="M60 116 C42 112 30 98 30 84 C46 86 58 98 60 116Z" :fill="leaf" />
    <path d="M61 96 C78 92 90 80 92 66 C76 66 63 78 61 96Z" :fill="leaf" opacity="0.85" />
    <path d="M59 140 C46 138 38 128 37 118 C49 120 57 128 59 140Z" :fill="leaf" opacity="0.75" />
    <path d="M62 78 C70 70 74 62 72 54" fill="none" :stroke="leaf" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="72" cy="52" r="4.5" :fill="petal" opacity="0.7" />
    <path d="M60 104 C50 98 44 90 44 82" fill="none" :stroke="leaf" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="44" cy="80" r="3.5" :fill="petal" opacity="0.6" />
    <g transform="translate(60 38)">
      <ellipse v-for="i in 5" :key="i" rx="9" ry="15" cy="-12" :fill="petal" :transform="`rotate(${i * 72})`" opacity="0.92" />
      <circle r="6" :fill="centre" />
    </g>
  </svg>
</template>
