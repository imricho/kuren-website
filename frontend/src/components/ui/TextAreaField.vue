<script setup lang="ts">
import { computed, useId } from 'vue'

import { controlClasses } from './styles'

const props = defineProps<{
  label: string
  hint?: string
  error?: string
  id?: string
  rows?: number
  maxlength?: number
  placeholder?: string
  neededHint?: string
  /** Visible "(required)" marker text for required fields; also sets aria-required. */
  requiredMarker?: string
}>()

const model = defineModel<string>({ required: true })
const generated = useId()
const id = computed(() => props.id ?? generated)
const showNeeded = computed(() => !!props.neededHint && !props.error && model.value.trim() === '')
const describedBy = computed(() =>
  [props.error || props.hint ? `${id.value}-msg` : null, showNeeded.value ? `${id.value}-needed` : null]
    .filter(Boolean)
    .join(' ') || undefined,
)
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <label :for="id" class="block text-sm font-medium text-ink-700">
      {{ label }}<span v-if="requiredMarker" class="font-normal text-ink-500">{{ ` ${requiredMarker}` }}</span>
    </label>
    <textarea
      :id="id"
      v-model="model"
      :rows="rows ?? 4"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :aria-required="!!requiredMarker || undefined"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      :class="['resize-y px-3.5 py-2.5', controlClasses(error)]"
    />
    <p v-if="error" :id="`${id}-msg`" class="text-xs text-danger-600">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="text-xs text-ink-500">{{ hint }}</p>
    <p v-if="showNeeded" :id="`${id}-needed`" class="text-xs text-amber-700" data-needed>{{ neededHint }}</p>
  </div>
</template>
