<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { formatTemplatePath } from '@/features/themes/picker/format'
import { useAuthStore } from '@/stores/auth'
import { useThemeSelectionStore } from '@/stores/themeSelection'
import { useAppLocale } from '@/composables/useAppLocale'
import type { AppMessageKey } from '@/composables/useAppLocale'

const auth = useAuthStore()
const { t } = useAppLocale()
const selection = useThemeSelectionStore()
const selectedPath = computed(() => formatTemplatePath(selection.selectedThemeId))

interface Step {
  title: AppMessageKey
  body: AppMessageKey
  to?: RouteLocationRaw
}

// Outline of the customer journey. Steps without a link arrive in later workstreams.
const steps: Step[] = [
  {
    title: 'chooseTheme',
    body: 'chooseThemeBody',
    to: { name: 'themes' },
  },
  { title: 'tellStory', body: 'tellStoryBody' },
  { title: 'addPhotos', body: 'addPhotosBody' },
  { title: 'previewPublish', body: 'previewPublishBody' },
]
</script>

<template>
  <div class="space-y-10">
    <section>
      <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">{{ t('dashboardEyebrow') }}</p>
      <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">{{ t('hello', { name: auth.firstName }) }}</h1>
      <p class="mt-3 max-w-xl text-ink-500">
        {{ t('dashboardIntro') }}
      </p>
    </section>

    <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" class="sr-only">{{ t('stepsHeading') }}</h2>
      <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="relative flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]"
          :class="step.to && 'transition-colors hover:border-rose-500'"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-rose-50 font-display text-lg font-semibold text-rose-600"
          >
            {{ index + 1 }}
          </span>
          <h3 class="mt-4 text-2xl font-semibold">
            <RouterLink v-if="step.to" :to="step.to" class="after:absolute after:inset-0">{{ t(step.title) }}</RouterLink>
            <template v-else>{{ t(step.title) }}</template>
          </h3>
          <p class="mt-2 flex-1 text-sm text-ink-500">{{ t(step.body) }}</p>
          <span
            v-if="step.to && index === 0 && selectedPath"
            class="mt-5 w-fit rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
          >
            {{ t('selected', { path: selectedPath }) }}
          </span>
          <span v-else-if="step.to" class="mt-5 w-fit text-sm font-medium text-rose-600">{{ t('browseThemes') }} →</span>
          <span v-else class="mt-5 w-fit rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-500">
            {{ t('comingSoon') }}
          </span>
        </li>
      </ol>
    </section>
  </div>
</template>
