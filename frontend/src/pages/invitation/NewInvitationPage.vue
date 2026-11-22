<script setup lang="ts">
/**
 * New invitation wizard: Category → Variant → Template → Name → Create → editor.
 *
 * Every choice lives in the URL query (`step`, `category`, `variant`, `template`,
 * `locale`, `timezone`), so reload and Back keep it; the internal title is typed
 * on the last step and stays in the page. Choices are native radio groups
 * (arrow keys move, Space selects); the stepper links to completed steps only.
 * Only templates compatible with the variant are offered; `?template=` (from the
 * gallery / "use template") is preselected when it is compatible.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'

import { ApiError } from '@/api/http'
import { FOCUS_RING } from '@/components/ui/styles'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { localizedCatalogText, useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { focusMainHeading } from '@/composables/useRouteA11y'
import { fieldId } from '@/features/cms/validation'
import { compatibleTemplates, DEFAULT_TIMEZONE, timezoneOptions } from '@/features/invitation/catalog'
import { CATEGORIES, isCategoryId, isVariantId, variantOf, variantsOf, type CategoryId, type VariantId } from '@/features/invitation/registry'
import { checkInvitationTitle } from '@/features/invitation/validation'
import type { WeddingLocale } from '@/features/wedding/types'
import { useInvitationsStore } from '@/stores/invitations'

const route = useRoute()
const router = useRouter()
const list = useInvitationsStore()
const { t, locale: uiLocale } = useAppLocale()

const STEPS = ['category', 'variant', 'template', 'name'] as const
type Step = (typeof STEPS)[number]
const STEP_LABEL: Record<Step, AppMessageKey> = {
  category: 'wizardStepCategory',
  variant: 'wizardStepVariant',
  template: 'wizardStepTemplate',
  name: 'wizardStepName',
}

const q = (key: string) => (typeof route.query[key] === 'string' ? (route.query[key] as string) : undefined)
const category = computed<CategoryId | undefined>(() => (isCategoryId(q('category')) ? (q('category') as CategoryId) : undefined))
const variant = computed<VariantId | undefined>(() => {
  const v = q('variant')
  return isVariantId(v) && category.value && variantOf(v).category === category.value ? v : undefined
})
const templates = computed(() => (variant.value ? compatibleTemplates(variant.value) : []))
const requestedTemplate = computed(() => q('template'))
const template = computed(() => templates.value.find((x) => x.id === requestedTemplate.value)?.id)
/** A `?template=` that this variant can't use (explained on the template step). */
const incompatibleRequest = computed(() => !!variant.value && !!requestedTemplate.value && !template.value)
const locale = computed<WeddingLocale>(() => (q('locale') === 'en' ? 'en' : 'id'))
const timezone = computed(() => q('timezone') || DEFAULT_TIMEZONE)

/** The furthest step whose prerequisites are met. */
const reachable = computed<Step>(() => (!category.value ? 'category' : !variant.value ? 'variant' : !template.value ? 'template' : 'name'))
const step = computed<Step>(() => {
  // No (or an unknown) step starts at the beginning; a step past a missing choice falls back to it.
  const raw = q('step') as Step | undefined
  const asked: Step = raw && STEPS.includes(raw) ? raw : 'category'
  return STEPS.indexOf(asked) <= STEPS.indexOf(reachable.value) ? asked : reachable.value
})

function go(patch: LocationQueryRaw, replace = false) {
  const query: LocationQueryRaw = { ...route.query, ...patch }
  for (const k of Object.keys(query)) if (query[k] === undefined) delete query[k]
  return replace ? router.replace({ query }) : router.push({ query })
}
const next = (to: Step) => go({ step: to })
function back() {
  const i = STEPS.indexOf(step.value)
  if (i > 0) void go({ step: STEPS[i - 1] })
  else void router.push({ name: 'invitations' })
}

function chooseCategory(id: CategoryId) {
  // Another category invalidates the variant (the template is kept if it fits the next variant).
  void go({ category: id, variant: id === category.value ? q('variant') : undefined }, true)
}
function chooseVariant(id: VariantId) {
  void go({ variant: id }, true)
}
function chooseTemplate(id: string) {
  void go({ template: id }, true)
}

// Focus the step heading when the step changes (keyboard and screen reader users stay oriented).
watch(step, () => nextTick(() => void focusMainHeading()))

const title = ref('')
const titleError = computed(() => (checkInvitationTitle(title.value).length ? t('errTooLong', { max: 120 }) : undefined))
const creating = ref(false)
const createError = ref<string | null>(null)
const localeOptions = computed(() => [
  { value: 'id' as const, label: t('bahasa') },
  { value: 'en' as const, label: t('english') },
])
const zoneOptions = computed(() => timezoneOptions(timezone.value).map((z) => ({ value: z, label: zoneLabel(z) })))
function zoneLabel(z: string) {
  const short: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' }
  return short[z] ? `${z} (${short[z]})` : z
}

async function create() {
  if (!category.value || !variant.value || !template.value || creating.value || titleError.value) return
  creating.value = true
  createError.value = null
  try {
    const rec = await list.create({
      category: category.value,
      variant: variant.value,
      themeId: template.value,
      title: title.value.trim() || undefined,
      locale: locale.value,
      timezone: timezone.value,
    })
    await router.replace({ name: 'editor', params: { id: rec.id } })
  } catch (err) {
    createError.value =
      err instanceof ApiError && err.code === 'limit_reached'
        ? t('createLimitReached')
        : err instanceof ApiError && err.code === 'template_incompatible'
          ? t('createTemplateIncompatible')
          : t('createFailed')
  } finally {
    creating.value = false
  }
}

const card = (selected: boolean) => [
  'flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-colors motion-reduce:transition-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose-600',
  selected ? 'border-[var(--tv-plum)] ring-2 ring-[var(--tv-gold)]' : 'border-line hover:bg-rose-50',
]
const primary = [
  'inline-flex min-h-11 items-center rounded-full bg-[var(--tv-plum)] px-6 text-sm font-semibold text-white hover:bg-[var(--tv-plum-soft)] disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING,
]
const secondary = ['inline-flex min-h-11 items-center rounded-full border border-ink-500/85 px-5 text-sm font-medium text-ink-700 hover:bg-rose-50', FOCUS_RING]
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6" data-testid="new-invitation">
    <nav :aria-label="t('wizardSteps')">
      <ol class="flex flex-wrap gap-2 text-sm" data-testid="wizard-steps">
        <li v-for="(s, i) in STEPS" :key="s">
          <RouterLink
            v-if="s !== step && STEPS.indexOf(s) <= STEPS.indexOf(reachable)"
            :to="{ query: { ...route.query, step: s } }"
            :class="['inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-ink-700 hover:bg-rose-50 sm:min-h-9', FOCUS_RING]"
            :data-step="s"
          >
            <span class="inline-flex size-6 items-center justify-center rounded-full bg-[var(--tv-gold-soft)] text-xs font-semibold" aria-hidden="true">{{ i + 1 }}</span>
            {{ t(STEP_LABEL[s]) }}
          </RouterLink>
          <span
            v-else
            :aria-current="s === step ? 'step' : undefined"
            :class="['inline-flex min-h-11 items-center gap-2 rounded-full px-3 sm:min-h-9', s === step ? 'bg-[var(--tv-plum)] font-semibold text-white' : 'text-ink-500']"
            :data-step="s"
          >
            <span class="inline-flex size-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold" aria-hidden="true">{{ i + 1 }}</span>
            {{ t(STEP_LABEL[s]) }}
          </span>
        </li>
      </ol>
    </nav>

    <!-- 1. Category -->
    <section v-if="step === 'category'" aria-labelledby="wizard-h" data-testid="step-category">
      <h1 id="wizard-h" tabindex="-1" class="text-3xl font-semibold">{{ t('wizardCategoryTitle') }}</h1>
      <fieldset class="mt-4">
        <legend class="sr-only">{{ t('wizardStepCategory') }}</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="c in CATEGORIES" :key="c.id" :class="card(category === c.id)">
            <input type="radio" name="category" class="mt-1 size-4 accent-[var(--tv-plum)]" :value="c.id" :checked="category === c.id" :data-category="c.id" @change="chooseCategory(c.id)" />
            <span>
              <span class="block font-semibold">{{ c.label[uiLocale] }}</span>
              <span class="block text-xs text-ink-500">{{ variantsOf(c.id).map((v) => v.label[uiLocale]).join(' · ') }}</span>
            </span>
          </label>
        </div>
      </fieldset>
    </section>

    <!-- 2. Variant -->
    <section v-else-if="step === 'variant' && category" aria-labelledby="wizard-h" data-testid="step-variant">
      <h1 id="wizard-h" tabindex="-1" class="text-3xl font-semibold">{{ t('wizardVariantTitle') }}</h1>
      <fieldset class="mt-4">
        <legend class="sr-only">{{ t('wizardStepVariant') }}</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="v in variantsOf(category)" :key="v.id" :class="card(variant === v.id)">
            <input type="radio" name="variant" class="mt-1 size-4 accent-[var(--tv-plum)]" :value="v.id" :checked="variant === v.id" :data-variant="v.id" @change="chooseVariant(v.id)" />
            <span class="font-semibold">{{ v.label[uiLocale] }}</span>
          </label>
        </div>
      </fieldset>
    </section>

    <!-- 3. Template -->
    <section v-else-if="step === 'template' && variant" aria-labelledby="wizard-h" data-testid="step-template">
      <h1 id="wizard-h" tabindex="-1" class="text-3xl font-semibold">{{ t('wizardTemplateTitle') }}</h1>
      <p v-if="incompatibleRequest" role="note" class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="template-incompatible">
        {{ t('wizardTemplateIncompatible') }}
      </p>
      <p v-if="templates.length === 0" class="mt-3 text-sm text-ink-700" data-testid="no-templates">{{ t('wizardNoTemplates') }}</p>
      <fieldset v-else class="mt-4">
        <legend class="sr-only">{{ t('wizardStepTemplate') }}</legend>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label v-for="tpl in templates" :key="tpl.id" :class="[...card(template === tpl.id), 'flex-col']">
            <img :src="tpl.previewImage" alt="" class="aspect-[4/5] w-full rounded-md border border-line object-cover" loading="lazy" />
            <span class="flex items-start gap-2">
              <input type="radio" name="template" class="mt-1 size-4 accent-[var(--tv-plum)]" :value="tpl.id" :checked="template === tpl.id" :data-template="tpl.id" @change="chooseTemplate(tpl.id)" />
              <span>
                <span class="block font-semibold">{{ localizedCatalogText(tpl.id, 'name', tpl.name) }}</span>
                <span class="block text-xs text-ink-500">{{ localizedCatalogText(tpl.id, 'tagline', tpl.tagline) }}</span>
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </section>

    <!-- 4. Name & settings -->
    <section v-else-if="step === 'name'" aria-labelledby="wizard-h" data-testid="step-name">
      <h1 id="wizard-h" tabindex="-1" class="text-3xl font-semibold">{{ t('wizardNameTitle') }}</h1>
      <div class="mt-4 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <TextField :id="fieldId('title', 'wz')" v-model="title" :label="t('invitationTitleLabel')" :hint="t('invitationTitleHint')" :error="titleError" autocomplete="off" />
        <SelectField
          :id="fieldId('locale', 'wz')"
          :model-value="locale"
          :label="t('websiteLanguage')"
          :hint="t('websiteLanguageHint')"
          :options="localeOptions"
          @update:model-value="(v: WeddingLocale) => go({ locale: v }, true)"
        />
        <SelectField
          :id="fieldId('timezone', 'wz')"
          :model-value="timezone"
          :label="t('timezone')"
          :hint="t('timezoneHint')"
          :options="zoneOptions"
          @update:model-value="(v: string) => go({ timezone: v }, true)"
        />
      </div>
      <p v-if="createError" role="alert" class="mt-3 text-sm text-danger-600" data-testid="create-error">{{ createError }}</p>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <button type="button" :class="secondary" data-action="back" @click="back">{{ t('back') }}</button>
      <button v-if="step === 'category'" type="button" :class="primary" :disabled="!category" data-action="next" @click="next('variant')">{{ t('continue') }}</button>
      <button v-else-if="step === 'variant'" type="button" :class="primary" :disabled="!variant" data-action="next" @click="next('template')">{{ t('continue') }}</button>
      <button v-else-if="step === 'template'" type="button" :class="primary" :disabled="!template" data-action="next" @click="next('name')">{{ t('continue') }}</button>
      <button v-else type="button" :class="primary" :disabled="creating || !!titleError" :aria-busy="creating" data-action="create" @click="create">
        {{ creating ? t('creatingInvitation') : t('createInvitation') }}
      </button>
    </div>
  </div>
</template>
