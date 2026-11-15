<script setup lang="ts">
import { computed, useId } from 'vue'

import { controlClasses } from './styles'

const props = defineProps<{
  label: string
  type?: string
  autocomplete?: string
  hint?: string
  error?: string
  required?: boolean
  /** Fixed id (e.g. so an error summary can link to the field). */
  id?: string
  placeholder?: string
  inputmode?: 'text' | 'url' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search' | 'none'
  maxlength?: number
  /** Shows a soft "needed before publishing" hint while empty; never blocks saving. */
  neededHint?: string
  /** Visible "(required)" marker text for required fields; also sets aria-required. */
  requiredMarker?: string
  /** Extra description shown under the field (e.g. the readable form of a date). */
  extraHint?: string
}>()

const model = defineModel<string>({ required: true })
const generated = useId()
const id = computed(() => props.id ?? generated)
const showNeeded = computed(() => !!props.neededHint && !props.error && model.value.trim() === '')
const describedBy = computed(() =>
  [
    props.extraHint ? `${id.value}-extra` : null,
    props.error || props.hint ? `${id.value}-msg` : null,
    showNeeded.value ? `${id.value}-needed` : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined,
)
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <label :for="id" class="block text-sm font-medium text-ink-700">
      {{ label }}<span v-if="requiredMarker" class="font-normal text-ink-500">{{ ` ${requiredMarker}` }}</span>
    </label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :required="required"
      :aria-required="required || !!requiredMarker || undefined"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="describedBy"
      :class="['min-h-11 px-3.5 py-2.5', controlClasses(error)]"
    />
    <p v-if="extraHint" :id="`${id}-extra`" class="text-xs font-medium text-ink-700" data-testid="extra-hint">{{ extraHint }}</p>
    <p v-if="error" :id="`${id}-msg`" class="text-xs text-danger-600">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="text-xs text-ink-500">{{ hint }}</p>
    <p v-if="showNeeded" :id="`${id}-needed`" class="text-xs text-amber-700" data-needed>{{ neededHint }}</p>
  </div>
</template>
