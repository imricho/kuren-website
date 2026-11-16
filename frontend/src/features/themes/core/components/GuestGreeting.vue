<script setup lang="ts">
/**
 * "Kepada Yth. <guest>" line in the opening. The guest name comes from `?to=`
 * on the published page only (sanitised, text only). In the editor preview a
 * neutral sample name shows where it will appear. Omitted when there is no name.
 */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import { useRenderContext } from '../composables/useRenderMode'

const props = defineProps<{ content: WeddingContent }>()
const { mode, guestName } = useRenderContext()
const isId = computed(() => props.content.locale === 'id')
const greeting = computed(() => props.content.opening.guestGreeting)
const name = computed(() => (mode.value === 'public' ? guestName.value : isId.value ? 'Nama Tamu' : 'Guest Name'))
const label = computed(() => greeting.value?.label?.trim() || (isId.value ? 'Kepada Yth.' : 'Dear'))
</script>

<template>
  <p v-if="greeting?.enabled && name" class="guest-greeting" data-testid="guest-greeting">
    <span class="guest-greeting__label" dir="auto">{{ label }}</span>{{ ' ' }}<strong class="guest-greeting__name" dir="auto" :data-sample="mode === 'public' ? undefined : 'true'">{{ name }}</strong>
  </p>
</template>

<style>
.guest-greeting { display: grid; gap: 0.15rem; justify-items: center; margin-block: 0 1rem; position: relative; z-index: 2; }
.guest-greeting__label { font-size: 0.8em; letter-spacing: 0.1em; opacity: 0.85; }
.guest-greeting__name { font-weight: 600; font-size: 1.1em; overflow-wrap: anywhere; unicode-bidi: isolate; }
</style>
