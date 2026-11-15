<script setup lang="ts">
/** On/off setting: a native checkbox exposed as role="switch" (announced as "on"/"off"). */
import { computed, useId } from 'vue'

const props = defineProps<{ label: string; hint?: string; id?: string }>()
const model = defineModel<boolean>({ required: true })
const generated = useId()
const id = computed(() => props.id ?? generated)
</script>

<template>
  <div class="flex items-start gap-3">
    <span class="relative mt-0.5 inline-flex shrink-0">
      <input
        :id="id"
        v-model="model"
        type="checkbox"
        role="switch"
        :aria-checked="model"
        :aria-describedby="hint ? `${id}-msg` : undefined"
        class="peer h-7 w-12 cursor-pointer appearance-none rounded-full bg-ink-500 transition-colors checked:bg-rose-600 hover:bg-ink-700 checked:hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 motion-reduce:transition-none"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 motion-reduce:transition-none"
      />
    </span>
    <div class="min-w-0">
      <label :for="id" class="block cursor-pointer text-sm font-medium text-ink-700">{{ label }}</label>
      <p v-if="hint" :id="`${id}-msg`" class="mt-0.5 text-xs text-ink-500">{{ hint }}</p>
    </div>
  </div>
</template>
