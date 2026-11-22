<script setup lang="ts">
/** "Add …" button for an inline repeater, with the limit note once it is full. */
import { FOCUS_RING } from '@/components/ui/styles'

defineProps<{ label: string; action: string; atLimit: boolean; limitText: string }>()
defineEmits<{ add: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      :class="[
        'min-h-11 rounded-md border border-ink-500/85 bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9',
        FOCUS_RING,
      ]"
      :disabled="atLimit"
      :data-action="action"
      @click="$emit('add')"
    >
      {{ label }}
    </button>
    <p v-if="atLimit" class="text-xs text-ink-500" data-testid="row-limit">{{ limitText }}</p>
  </div>
</template>
