<script setup lang="ts">
/**
 * Time-zone picker: a search box that filters a native select (keyboard and screen-reader
 * friendly, no custom combobox), with readable names and the current UTC offset.
 */
import { computed, ref } from 'vue'

import { controlClasses } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import type { Locale } from '@/features/invitation/registry'

import { searchTimezones } from '../catalog'

const props = defineProps<{ id: string; label: string; hint?: string; disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const { t, locale } = useAppLocale()
const query = ref('')
const options = computed(() => searchTimezones(query.value, locale.value as Locale, model.value))
const count = computed(() => options.value.length)
</script>

<template>
  <div class="min-w-0 space-y-1.5" data-testid="timezone-field">
    <label :for="`${props.id}-search`" class="block text-sm font-medium text-ink-700">{{ label }}</label>
    <input
      :id="`${props.id}-search`"
      v-model="query"
      type="search"
      autocomplete="off"
      :placeholder="t('timezoneSearchPlaceholder')"
      :aria-describedby="`${props.id}-count`"
      :aria-controls="props.id"
      :disabled="disabled"
      :class="['min-h-11 px-3 py-2', controlClasses()]"
      data-role="timezone-search"
    />
    <p :id="`${props.id}-count`" class="sr-only" aria-live="polite">{{ t('timezoneMatches', { count }) }}</p>
    <select
      :id="props.id"
      v-model="model"
      :aria-label="label"
      :aria-describedby="hint ? `${props.id}-msg` : undefined"
      :disabled="disabled"
      :class="['min-h-11 px-3 py-2.5', controlClasses()]"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <p v-if="hint" :id="`${props.id}-msg`" class="text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
