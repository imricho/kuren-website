<script setup lang="ts">
/**
 * Native date input plus the full readable date in the UI language
 * (e.g. "Sabtu, 12 Juni 2027"), linked to the input with aria-describedby.
 */
import { computed } from 'vue'

import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { isIsoDate } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'

defineProps<{
  id: string
  label: string
  hint?: string
  error?: string
  neededHint?: string
}>()
const model = defineModel<string>({ required: true })
const { locale } = useAppLocale()

const readable = computed(() => {
  const value = model.value.trim()
  if (!isIsoDate(value)) return undefined
  try {
    return formatDate(value, locale.value, 'full')
  } catch {
    return undefined
  }
})
</script>

<template>
  <TextField
    :id="id"
    v-model="model"
    type="date"
    :label="label"
    :hint="hint"
    :error="error"
    :needed-hint="neededHint"
    :extra-hint="error ? undefined : readable"
  />
</template>
