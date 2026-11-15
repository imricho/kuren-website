<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'

const { locale, setLocale, t } = useAppLocale()
// Accessible names start with the visible code ("EN · English") so voice-control
// users can say what they see (WCAG 2.5.3 Label in Name).
</script>

<template>
  <div class="inline-flex rounded-lg border border-line bg-surface p-1" role="group" :aria-label="t('language')">
    <button
      type="button"
      class="min-h-8 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500"
      :class="locale === 'en' ? 'bg-rose-50 text-ink-900' : 'text-ink-500 hover:text-ink-900'"
      :aria-pressed="locale === 'en'"
      :aria-label="`EN · ${t('english')}`"
      @click="setLocale('en')"
    >
      EN
    </button>
    <button
      type="button"
      class="min-h-8 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500"
      :class="locale === 'id' ? 'bg-rose-50 text-ink-900' : 'text-ink-500 hover:text-ink-900'"
      :aria-pressed="locale === 'id'"
      :aria-label="`ID · ${t('bahasa')}`"
      @click="setLocale('id')"
    >
      ID
    </button>
  </div>
</template>
