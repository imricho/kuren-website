<script setup lang="ts">
/**
 * First run, three short steps: (1) names & wedding date, (2) a theme, (3) see the site.
 * Each step is its own URL (?step=n) so it is resumable and works with Back; every step
 * can be skipped, and "Skip setup" always leads to the dashboard. Saves go through the
 * wedding store's existing section APIs (same data as the Opening and Couple editors).
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { localizedCatalogText, useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { clean } from '@/features/cms/forms'
import { LIMITS } from '@/features/cms/validation'
import { markWelcomeSeen, resumeStep, type WelcomeStep } from '@/features/shell/firstRun'
import { PREVIEW_ROUTE } from '@/features/shell/nextStep'
import { FAMILIES, getFamily, getTheme, THEMES } from '@/features/themes/core/registry'
import type { RenderableTemplate } from '@/features/themes/core/types'
import { deriveCoupleNames, isIsoDate, type PersonDraft } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { useAuthStore } from '@/stores/auth'
import { useThemeSelectionStore } from '@/stores/themeSelection'
import { StaleError, useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const selection = useThemeSelectionStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t, locale } = useAppLocale()

const TOTAL = 3
const STEPS: { n: WelcomeStep; label: AppMessageKey }[] = [
  { n: 1, label: 'welcomeStepNames' },
  { n: 2, label: 'welcomeStepTheme' },
  { n: 3, label: 'welcomeStepSite' },
]

onMounted(() => {
  // Visiting the flow (even to skip it) means the dashboard never sends this user here again.
  if (auth.user?.id) markWelcomeSeen(auth.user.id)
  void store.ensureLoaded()
})

const ready = computed(() => store.loadState === 'ready' && !!store.content)
const step = computed<WelcomeStep>(() => resumeStep(route.query.step, store.content, store.themeId))

const heading = ref<HTMLElement | null>(null)
async function goTo(n: WelcomeStep) {
  formError.value = null
  await router.push({ query: { ...route.query, step: String(n) } })
  await nextTick()
  // Same page, new step: put keyboard/screen-reader users at the new step's heading.
  heading.value?.focus()
}

// --- Step 1: names & date --------------------------------------------------------
const form = reactive({ groomName: '', groomNickname: '', brideName: '', brideNickname: '', weddingDate: '' })
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

function fillForm() {
  const c = store.content
  if (!c) return
  form.groomName = c.couple.groom.name ?? ''
  form.groomNickname = c.couple.groom.nickname ?? ''
  form.brideName = c.couple.bride.name ?? ''
  form.brideNickname = c.couple.bride.nickname ?? ''
  form.weddingDate = isIsoDate(c.opening.weddingDate) ? c.opening.weddingDate : ''
}
watch(ready, (isReady) => isReady && fillForm(), { immediate: true })

const opt = (value: string) => value.trim() || undefined
const person = (base: PersonDraft, name: string, nickname: string): PersonDraft =>
  clean({ ...base, name: opt(name), nickname: opt(nickname) })

async function saveNames() {
  const c = store.content
  if (!c) return
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  formError.value = null
  saving.value = true
  try {
    const groom = person(c.couple.groom, form.groomName, form.groomNickname)
    const bride = person(c.couple.bride, form.brideName, form.brideNickname)
    if (JSON.stringify({ groom, bride }) !== JSON.stringify(c.couple)) await store.saveSection('couple', { groom, bride })
    const date = opt(form.weddingDate)
    const opening = store.content!.opening
    if (date !== opening.weddingDate) await store.saveSection('opening', clean({ ...opening, weddingDate: date }))
    await goTo(2)
  } catch (err) {
    if (err instanceof StaleError) return
    if (err instanceof ApiError && err.status === 422 && err.fieldErrors.length) {
      // Server field paths: "groom.name", "bride.nickname" (couple) or "weddingDate" (opening).
      for (const fe of err.fieldErrors) {
        const key = fe.field.replace(/^couple\./, '').replace(/\.(\w)/, (_, c: string) => c.toUpperCase())
        if (key in form) fieldErrors[key] = t('welcomeFieldInvalid')
      }
      if (!Object.keys(fieldErrors).length) formError.value = t('welcomeSaveFailed')
    } else {
      formError.value = t('welcomeSaveFailed')
    }
  } finally {
    saving.value = false
  }
}

// --- Step 2: theme ---------------------------------------------------------------
/** One starting template per family (plus the current choice if it came from the studio). */
const themeOptions = computed<RenderableTemplate[]>(() => {
  const firsts = FAMILIES.map((f) => THEMES.find((th) => th.familyId === f.id)).filter((th): th is RenderableTemplate => !!th)
  const current = getTheme(store.themeId)
  return current && !firsts.some((th) => th.id === current.id) ? [current, ...firsts] : firsts
})
const chosenTheme = ref<string | null>(null)
watch(
  () => store.themeId,
  (id) => (chosenTheme.value = id),
  { immediate: true },
)
const themeError = ref<string | null>(null)

async function saveTheme() {
  themeError.value = null
  if (!chosenTheme.value || chosenTheme.value === store.themeId) return goTo(3)
  const ok = await selection.select(chosenTheme.value)
  if (ok) await goTo(3)
  else themeError.value = t('welcomeThemeFailed')
}

const familyName = (th: RenderableTemplate) => {
  const f = getFamily(th.familyId)
  return f ? localizedCatalogText(f.id, 'name', f.name) : ''
}

// --- Step 3: summary -------------------------------------------------------------
const summaryNames = computed(() => {
  const c = store.content
  return c ? c.opening.coupleNames?.trim() || deriveCoupleNames(c.couple) : undefined
})
const summaryDate = computed(() => {
  const d = store.content?.opening.weddingDate
  return isIsoDate(d) ? formatDate(d, locale.value, 'full') : undefined
})

const stepTitle = computed<AppMessageKey>(() =>
  step.value === 1 ? 'welcomeNamesTitle' : step.value === 2 ? 'welcomeThemeTitle' : 'welcomeSiteTitle',
)
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm font-medium text-rose-700" data-testid="welcome-step-of">
        {{ t('welcomeStepOf', { n: step, total: TOTAL }) }}
      </p>
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-ink-700 hover:text-ink-900 hover:underline"
        data-testid="welcome-skip-all"
      >
        {{ t('welcomeSkipAll') }}
      </RouterLink>
    </div>

    <ol class="mt-3 grid grid-cols-3 gap-2" :aria-label="t('welcomeProgress')" data-testid="welcome-steps">
      <li
        v-for="s in STEPS"
        :key="s.n"
        :aria-current="s.n === step ? 'step' : undefined"
        class="min-w-0"
      >
        <span
          class="block h-1 rounded-full"
          :class="s.n <= step ? 'bg-rose-600' : 'bg-rose-100'"
          aria-hidden="true"
        />
        <span class="mt-2 block truncate text-xs" :class="s.n === step ? 'font-semibold text-ink-900' : 'text-ink-700'">
          {{ t(s.label) }}
        </span>
      </li>
    </ol>

    <div v-if="store.loadState === 'error' || store.loadState === 'none'" class="mt-8 space-y-4">
      <h1 ref="heading" tabindex="-1" class="text-3xl font-semibold sm:text-4xl">{{ t('welcomeTitle') }}</h1>
      <FormAlert>{{ t('loadFailed') }}</FormAlert>
      <BaseButton class="min-h-11" variant="secondary" @click="store.reload()">{{ t('tryAgain') }}</BaseButton>
    </div>

    <div v-else-if="!ready" class="mt-8" role="status" aria-live="polite">
      <h1 ref="heading" tabindex="-1" class="text-3xl font-semibold sm:text-4xl">{{ t('welcomeTitle') }}</h1>
      <p class="mt-3 text-sm text-ink-700">{{ t('loadingWebsite') }}</p>
    </div>

    <template v-else>
      <header class="mt-8">
        <h1 ref="heading" tabindex="-1" class="text-3xl leading-tight font-semibold break-words focus:outline-none sm:text-4xl">
          {{ t(stepTitle) }}
        </h1>
        <p class="mt-3 text-ink-700">
          {{ step === 1 ? t('welcomeNamesBody') : step === 2 ? t('welcomeThemeBody') : t('welcomeSiteBody') }}
        </p>
      </header>

      <!-- Step 1 -->
      <form v-if="step === 1" class="mt-8 space-y-6" novalidate data-testid="welcome-names" @submit.prevent="saveNames">
        <FormAlert v-if="formError">{{ formError }}</FormAlert>
        <fieldset class="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <legend class="px-1 font-display text-xl font-semibold">{{ t('theGroom') }}</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <TextField
              id="welcome-groom-name"
              v-model="form.groomName"
              :label="t('fullName')"
              :placeholder="t('welcomeGroomNamePlaceholder')"
              :maxlength="LIMITS.title"
              :error="fieldErrors.groomName"
              autocomplete="off"
            />
            <TextField
              id="welcome-groom-nickname"
              v-model="form.groomNickname"
              :label="t('nickname')"
              :placeholder="t('welcomeGroomNicknamePlaceholder')"
              :maxlength="LIMITS.nickname"
              :error="fieldErrors.groomNickname"
              autocomplete="off"
            />
          </div>
        </fieldset>
        <fieldset class="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <legend class="px-1 font-display text-xl font-semibold">{{ t('theBride') }}</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <TextField
              id="welcome-bride-name"
              v-model="form.brideName"
              :label="t('fullName')"
              :placeholder="t('welcomeBrideNamePlaceholder')"
              :maxlength="LIMITS.title"
              :error="fieldErrors.brideName"
              autocomplete="off"
            />
            <TextField
              id="welcome-bride-nickname"
              v-model="form.brideNickname"
              :label="t('nickname')"
              :placeholder="t('welcomeBrideNicknamePlaceholder')"
              :maxlength="LIMITS.nickname"
              :error="fieldErrors.brideNickname"
              autocomplete="off"
            />
          </div>
          <p class="text-xs text-ink-700">{{ t('nicknameHint') }}</p>
        </fieldset>
        <div class="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
          <TextField id="welcome-date" v-model="form.weddingDate" type="date" :label="t('weddingDate')" :error="fieldErrors.weddingDate" />
        </div>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <BaseButton variant="ghost" class="min-h-11" data-testid="welcome-skip" @click="goTo(2)">{{ t('welcomeSkipStep') }}</BaseButton>
          <BaseButton type="submit" class="min-h-11" :loading="saving">{{ saving ? t('saving') : t('welcomeSaveContinue') }}</BaseButton>
        </div>
      </form>

      <!-- Step 2 -->
      <form v-else-if="step === 2" class="mt-8 space-y-6" novalidate data-testid="welcome-theme" @submit.prevent="saveTheme">
        <FormAlert v-if="themeError">{{ themeError }}</FormAlert>
        <fieldset>
          <legend class="sr-only">{{ t('welcomeThemeLegend') }}</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              v-for="th in themeOptions"
              :key="th.id"
              class="flex cursor-pointer gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-colors hover:border-rose-500 has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose-500"
              :data-theme="th.id"
            >
              <input v-model="chosenTheme" type="radio" name="welcome-theme" :value="th.id" class="sr-only" />
              <img :src="th.previewImage" alt="" class="h-16 w-24 shrink-0 rounded-md object-cover ring-1 ring-line" loading="lazy" />
              <span class="min-w-0 flex-1">
                <span class="block font-medium break-words text-ink-900">{{ th.name }}</span>
                <span class="block text-xs text-ink-700">{{ familyName(th) }}</span>
                <span class="mt-1 block text-xs text-ink-700">{{ localizedCatalogText(th.id, 'tagline', th.tagline) }}</span>
              </span>
              <svg
                v-if="chosenTheme === th.id"
                class="size-5 shrink-0 text-rose-600"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.58 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clip-rule="evenodd" />
              </svg>
            </label>
          </div>
        </fieldset>
        <RouterLink :to="{ name: 'themes' }" class="inline-flex min-h-11 items-center text-sm font-medium text-rose-700 hover:text-rose-600 hover:underline">
          {{ t('welcomeBrowseAll') }} <span aria-hidden="true" class="ml-1">→</span>
        </RouterLink>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BaseButton variant="secondary" class="min-h-11" data-testid="welcome-back" @click="goTo(1)">{{ t('back') }}</BaseButton>
          <div class="flex flex-col-reverse gap-3 sm:flex-row">
            <BaseButton variant="ghost" class="min-h-11" data-testid="welcome-skip" @click="goTo(3)">{{ t('welcomeSkipStep') }}</BaseButton>
            <BaseButton type="submit" class="min-h-11" :loading="!!selection.pendingThemeId">
              {{ chosenTheme && chosenTheme !== store.themeId ? t('welcomeSaveContinue') : t('welcomeContinue') }}
            </BaseButton>
          </div>
        </div>
      </form>

      <!-- Step 3 -->
      <div v-else class="mt-8 space-y-6" data-testid="welcome-site">
        <dl class="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface px-5 sm:px-6">
          <div class="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <dt class="text-sm text-ink-700">{{ t('welcomeSummaryNames') }}</dt>
            <dd class="font-medium break-words">{{ summaryNames ?? t('welcomeNotSet') }}</dd>
          </div>
          <div class="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <dt class="text-sm text-ink-700">{{ t('weddingDate') }}</dt>
            <dd class="font-medium break-words">{{ summaryDate ?? t('welcomeNotSet') }}</dd>
          </div>
          <div class="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <dt class="text-sm text-ink-700">{{ t('sectionTheme') }}</dt>
            <dd class="font-medium break-words">{{ selection.selectedTheme?.name ?? t('welcomeNotSet') }}</dd>
          </div>
        </dl>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BaseButton variant="secondary" class="min-h-11" data-testid="welcome-back" @click="goTo(2)">{{ t('back') }}</BaseButton>
          <div class="flex flex-col-reverse gap-3 sm:flex-row">
            <RouterLink
              :to="{ name: 'dashboard' }"
              class="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-900 hover:bg-rose-50"
              data-testid="welcome-dashboard"
            >
              {{ t('welcomeToDashboard') }}
            </RouterLink>
            <RouterLink
              :to="PREVIEW_ROUTE"
              class="inline-flex min-h-11 items-center justify-center rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
              data-testid="welcome-see-site"
            >
              {{ t('welcomeSeeSite') }}
            </RouterLink>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
