<script setup lang="ts" generic="V extends string">
import { computed, useId } from 'vue'

import { controlClasses } from './styles'

const props = defineProps<{
  label: string
  options: readonly { value: V; label: string }[]
  hint?: string
  error?: string
  id?: string
}>()

const model = defineModel<V>({ required: true })
const generated = useId()
const id = computed(() => props.id ?? generated)
</script>

<template>
  <div class="min-w-0 space-y-1.5">
    <label :for="id" class="block text-sm font-medium text-ink-700">{{ label }}</label>
    <select
      :id="id"
      v-model="model"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error || hint ? `${id}-msg` : undefined"
      :class="['min-h-11 px-3 py-2.5', controlClasses(error)]"
    >
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <p v-if="error" :id="`${id}-msg`" class="text-xs text-danger-600">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
