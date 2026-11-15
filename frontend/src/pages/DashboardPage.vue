<script setup lang="ts">
/**
 * Dashboard: the couple's website at a glance. A hero with their names, date,
 * countdown and how complete the site is, plus ONE next step (the first
 * required section still to do, or a preview once everything is done).
 * A brand-new wedding is sent to the welcome flow once (features/shell/firstRun).
 */
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import { localizedCatalogText, useAppLocale } from '@/composables/useAppLocale'
import CompletionMeter from '@/features/cms/components/CompletionMeter.vue'
import { EDITOR_SECTIONS } from '@/features/cms/sections'
import { daysUntil } from '@/features/shell/countdown'
import { markWelcomeSeen, shouldStartWelcome } from '@/features/shell/firstRun'
import { nextStep, PREVIEW_ROUTE } from '@/features/shell/nextStep'
import { deriveCoupleNames, isIsoDate } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { useAuthStore } from '@/stores/auth'
import { useThemeSelectionStore } from '@/stores/themeSelection'
import { useWeddingStore } from '@/stores/wedding'

const auth = useAuthStore()
const wedding = useWeddingStore()
const selection = useThemeSelectionStore()
const router = useRouter()
const { t, locale } = useAppLocale()

onMounted(() => void wedding.ensureLoaded())

// First run: once per user, a wedding with no names and no date starts at /welcome.
watch(
  () => wedding.loadState,
  (state) => {
    const userId = auth.user?.id
    if (state === 'ready' && userId && shouldStartWelcome(wedding.content, userId)) {
      markWelcomeSeen(userId)
      void router.replace({ name: 'welcome' })
    }
  },
  { immediate: true },
)

const ready = computed(() => wedding.loadState === 'ready' && !!wedding.content)
const coupleNames = computed(() => {
  const c = wedding.content
  if (!c) return undefined
  return c.opening.coupleNames?.trim() || deriveCoupleNames(c.couple)
})
const weddingDate = computed(() => {
  const d = wedding.content?.opening.weddingDate
  return isIsoDate(d) ? d : undefined
})
const dateText = computed(() => (weddingDate.value ? formatDate(weddingDate.value, locale.value, 'full') : undefined))
const countdown = computed(() => {
  const days = daysUntil(weddingDate.value)
  if (days === undefined || days < 0) return undefined
  if (days === 0) return t('heroToday')
  if (days === 1) return t('heroOneDayToGo')
  return t('heroDaysToGo', { count: new Intl.NumberFormat(locale.value === 'id' ? 'id-ID' : 'en-GB').format(days) })
})

const completeness = computed(() => wedding.completeness)
const step = computed(() => nextStep(completeness.value))

const theme = computed(() => selection.selectedTheme)
const themeTagline = computed(() => (theme.value ? localizedCatalogText(theme.value.id, 'tagline', theme.value.tagline) : ''))

/** Section rows: done (quiet check), to do (required) or optional — no status pills. */
const rows = computed(() =>
  EDITOR_SECTIONS.filter((s) => s.key !== 'theme').map((s) => {
    const c = completeness.value.sections[s.key]
    const state = c.status === 'complete' ? 'done' : c.required ? 'todo' : 'optional'
    return { ...s, state, isNext: s.key === step.value.key }
  }),
)
</script>

<template>
  <div class="space-y-8 sm:space-y-10">
    <div
      v-if="wedding.loadState === 'error' || wedding.loadState === 'none'"
      class="space-y-6"
    >
      <h1 class="text-3xl font-semibold break-words sm:text-4xl">{{ t('hello', { name: auth.firstName }) }}</h1>
      <div role="alert" class="max-w-xl rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
        <p class="font-medium">{{ t('loadFailed') }}</p>
        <BaseButton class="mt-4 min-h-11" variant="secondary" @click="wedding.reload()">{{ t('tryAgain') }}</BaseButton>
      </div>
    </div>

    <div v-else-if="!ready" class="space-y-6" role="status" aria-live="polite" data-testid="dashboard-loading">
      <h1 class="text-3xl font-semibold break-words sm:text-4xl">{{ t('hello', { name: auth.firstName }) }}</h1>
      <span class="sr-only">{{ t('loadingWebsite') }}</span>
      <div class="h-64 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
    </div>

    <template v-else>
      <!-- Hero: who, when, how far along, and the one thing to do next. -->
      <section
        aria-labelledby="dashboard-heading"
        class="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-8 lg:p-10"
        data-testid="dashboard-hero"
      >
        <div class="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full border border-rose-100" aria-hidden="true" />
        <div class="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
          <div class="min-w-0">
            <p class="text-sm font-medium text-rose-700">{{ t('hello', { name: auth.firstName }) }}</p>
            <h1
              id="dashboard-heading"
              class="mt-2 text-4xl leading-tight font-semibold break-words sm:text-5xl"
              :class="!coupleNames && 'text-ink-700'"
              data-testid="website-name"
            >
              {{ coupleNames ?? t('heroNamesPlaceholder') }}
            </h1>
            <p v-if="dateText" class="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-ink-700">
              <span data-testid="wedding-date">{{ dateText }}</span>
              <span v-if="countdown" class="text-sm font-medium text-rose-700" data-testid="countdown">{{ countdown }}</span>
            </p>
            <CompletionMeter class="mt-6 max-w-sm" :done="completeness.done" :total="completeness.total" />
          </div>

          <div class="rounded-xl bg-rose-50 p-5" data-testid="next-step" :data-step="step.key">
            <p class="text-xs font-semibold tracking-wide text-rose-700 uppercase">{{ t('heroNextStep') }}</p>
            <p class="mt-1 text-sm text-ink-700">{{ t(step.hint) }}</p>
            <RouterLink
              :to="step.to"
              class="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              data-testid="next-step-action"
            >
              {{ t(step.action) }} <span aria-hidden="true">→</span>
            </RouterLink>
            <RouterLink
              v-if="step.key !== 'preview'"
              :to="PREVIEW_ROUTE"
              class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-rose-700 hover:text-rose-600 hover:underline"
              data-testid="preview-website"
            >
              {{ t('previewWebsite') }}
            </RouterLink>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section aria-labelledby="theme-heading" class="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 id="theme-heading" class="text-2xl font-semibold">{{ t('sectionTheme') }}</h2>
          <div v-if="theme" class="mt-4 space-y-3">
            <img :src="theme.previewImage" alt="" class="aspect-[8/5] w-full rounded-lg object-cover ring-1 ring-line" loading="lazy" />
            <div>
              <p class="font-medium break-words">{{ theme.name }}</p>
              <p class="text-sm text-ink-700">{{ themeTagline }}</p>
            </div>
          </div>
          <p v-else class="mt-3 text-sm text-ink-700">{{ t('noThemeYet') }}</p>
          <RouterLink :to="{ name: 'themes' }" class="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-rose-700 hover:text-rose-600 hover:underline">
            {{ theme ? t('changeTheme') : t('browseThemes') }} <span aria-hidden="true" class="ml-1">→</span>
          </RouterLink>
        </section>

        <section aria-labelledby="checklist-heading" class="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 id="checklist-heading" class="text-2xl font-semibold">{{ t('websiteSections') }}</h2>
          <ul class="mt-3 divide-y divide-line" data-testid="section-checklist">
            <li v-for="s in rows" :key="s.key">
              <RouterLink
                :to="s.to"
                class="group flex min-h-12 items-center gap-3 rounded-md py-2 text-sm hover:text-rose-700"
                :data-section="s.key"
                :data-state="s.state"
              >
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full"
                  :class="s.state === 'done' ? 'bg-success-50 text-success-600' : 'border border-ink-300'"
                  aria-hidden="true"
                >
                  <svg v-if="s.state === 'done'" class="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clip-rule="evenodd" />
                  </svg>
                </span>
                <span class="min-w-0 flex-1 font-medium break-words" :class="s.state === 'done' && 'text-ink-700'">
                  {{ t(s.label) }}
                  <span v-if="s.state === 'done'" class="sr-only">({{ t('statusComplete') }})</span>
                </span>
                <span v-if="s.state === 'todo'" class="text-xs font-medium text-rose-700">{{ t('sectionToDo') }}</span>
                <span v-else-if="s.state === 'optional'" class="text-xs text-ink-700">{{ t('statusOptional') }}</span>
                <span aria-hidden="true" class="text-ink-500 group-hover:text-rose-700">→</span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
