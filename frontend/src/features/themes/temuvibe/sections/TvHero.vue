<script setup lang="ts">
/** Opening: variant kicker, the invitation title as the page's h1, date, optional cover / logo. */
import { computed } from 'vue'

import { formatDate } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import GuestGreeting from '../../core/components/GuestGreeting.vue'
import ThemeImage from '../../core/components/ThemeImage.vue'
import { useHeroHeading } from '../../core/composables/useHeroHeading'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent; title: string; kicker: string; subtitle?: string; showLogo: boolean }>()
const { preset, locale } = useTv()
const heroHeading = useHeroHeading()
const date = computed(() => formatDate(props.content.opening.weddingDate, locale.value, 'full'))
const logo = computed(() => (props.showLogo ? props.content.organization?.logo : undefined))
const orgName = computed(() => (props.showLogo ? props.content.organization?.name?.trim() : undefined))
const cover = computed(() => props.content.opening.coverImage)
</script>

<template>
  <header data-section="opening" class="tv-hero" :class="{ 'tv-hero--cover': cover }">
    <span v-if="preset.hero === 'festive'" class="tv-hero__confetti" aria-hidden="true" />
    <div class="tv-hero__frame">
      <div v-if="logo || orgName" class="tv-hero__brand" data-role="organization-brand">
        <span v-if="logo" class="tv-hero__logo"><ThemeImage :image="logo" eager /></span>
        <span v-if="orgName" class="tv-hero__org" dir="auto">{{ orgName }}</span>
      </div>
      <GuestGreeting :content="content" />
      <p class="tv-kicker tv-hero__kicker" dir="auto">{{ kicker }}</p>
      <h1 v-bind="heroHeading" class="tv-hero__title" dir="auto">{{ title }}</h1>
      <p v-if="subtitle" class="tv-hero__subtitle" dir="auto">{{ subtitle }}</p>
      <span class="tv-rule" aria-hidden="true" />
      <p class="tv-hero__date"><time :datetime="content.opening.weddingDate">{{ date }}</time></p>
    </div>
    <figure v-if="cover" class="tv-hero__media"><ThemeImage :image="cover" eager /></figure>
  </header>
</template>
