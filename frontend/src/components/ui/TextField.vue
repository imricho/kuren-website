<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  label: string
  type?: string
  autocomplete?: string
  hint?: string
  error?: string
  required?: boolean
}>()

const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="space-y-1.5">
    <label :for="id" class="block text-sm font-medium text-ink-700">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :autocomplete="autocomplete"
      :required="required"
      :aria-invalid="error ? true : undefined"
      :aria-describedby="error || hint ? `${id}-msg` : undefined"
      :class="[
        'block w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300',
        'transition-colors focus:outline-none focus:ring-2',
        error
          ? 'border-danger-600 focus:ring-danger-600/20'
          : 'border-line focus:border-rose-500 focus:ring-rose-500/20',
      ]"
    />
    <p v-if="error" :id="`${id}-msg`" class="text-xs text-danger-600">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-msg`" class="text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
