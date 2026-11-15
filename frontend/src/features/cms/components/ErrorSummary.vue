<script setup lang="ts">
/**
 * "There are problems with this section" box listing every error, each linking
 * to (and focusing) its field. Deliberately NOT a live region: after a failed
 * save, focus moves to the first invalid field, which announces its own error.
 */
import { useAppLocale } from '@/composables/useAppLocale'

import type { ErrorEntry } from '../composables/useSectionDraft'
import { scrollIntoViewRespectingMotion } from '../motion'

defineProps<{ errors: ErrorEntry[]; labels?: Record<string, string> }>()
const { t } = useAppLocale()

function focusField(id: string) {
  const el = document.getElementById(id)
  el?.focus({ preventScroll: true })
  scrollIntoViewRespectingMotion(el, { block: 'center' })
}
</script>

<template>
  <div
    v-if="errors.length"
    tabindex="-1"
    class="rounded-lg border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-600"
    data-testid="error-summary"
  >
    <p class="font-medium">{{ t('errorSummaryTitle', { count: errors.length }) }}</p>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      <li v-for="e in errors" :key="e.field">
        <a :href="`#${e.id}`" class="rounded-sm underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-600" @click.prevent="focusField(e.id)">
          <template v-if="labels?.[e.field]">{{ labels[e.field] }}: </template>{{ e.message }}
        </a>
      </li>
    </ul>
  </div>
</template>
