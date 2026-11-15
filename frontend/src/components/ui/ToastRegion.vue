<script setup lang="ts">
/**
 * Live regions for toasts. Both regions are always in the DOM so screen readers
 * announce messages as they are inserted. Errors persist until closed.
 */
import { computed } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
const { t } = useAppLocale()
const polite = computed(() => toasts.value.filter((x) => x.tone !== 'error'))
const errors = computed(() => toasts.value.filter((x) => x.tone === 'error'))
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:top-20 sm:bottom-auto sm:items-end sm:px-6"
  >
    <div role="alert" class="flex w-full max-w-sm flex-col gap-2" data-testid="toast-errors">
      <div
        v-for="toast in errors"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-600 shadow-[var(--shadow-soft)]"
      >
        <p class="flex-1">{{ toast.message }}</p>
        <button
          type="button"
          class="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-danger-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-600 sm:size-8"
          :aria-label="t('closeNotification')"
          @click="dismiss(toast.id)"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
    <div role="status" aria-live="polite" class="flex w-full max-w-sm flex-col gap-2" data-testid="toast-status">
      <p
        v-for="toast in polite"
        :key="toast.id"
        class="pointer-events-auto rounded-lg border border-line bg-ink-900 px-4 py-3 text-sm text-white shadow-[var(--shadow-soft)]"
      >
        {{ toast.message }}
      </p>
    </div>
  </div>
</template>
