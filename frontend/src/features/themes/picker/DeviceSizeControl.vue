<script setup lang="ts">
/**
 * Single-choice device size control. Native radio inputs give the correct
 * semantics ("radio, 1 of 3, checked") and arrow-key behaviour for free;
 * they are visually styled as a segmented control.
 */
import { useId } from 'vue'

import type { Device } from '../preview/DevicePreview.vue'

const device = defineModel<Device>({ required: true })
const name = `device-${useId()}`

const options: { id: Device; label: string }[] = [
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
]
</script>

<template>
  <fieldset class="inline-flex rounded-lg border border-line bg-surface p-1">
    <legend class="sr-only">Preview size</legend>
    <label v-for="o in options" :key="o.id" class="relative">
      <input v-model="device" class="peer sr-only" type="radio" :name="name" :value="o.id" />
      <span
        class="block cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors peer-checked:bg-rose-50 peer-checked:text-ink-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-rose-500 hover:text-ink-900"
      >
        {{ o.label }}
      </span>
    </label>
  </fieldset>
</template>
