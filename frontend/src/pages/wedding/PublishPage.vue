<script setup lang="ts">
/**
 * Finishing Touches → Preview & Publish.
 *
 *  status card ─ privacy note ─ blocking errors / warnings (links focus the field)
 *  Publish / Publish update · Unpublish · public URL + Copy · View published · Preview draft
 *
 * The checklist is computed on the SAVED draft (store.publishChecklist); the server's
 * 422 publish_blocked details (store.publishIssues) are merged in after an attempt.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { INVITATION_PREVIEW_ROUTE_NAME } from '@/features/cms/editorRoutes'
import { sectionByKey } from '@/features/cms/sections'
import type { SectionKey } from '@/features/wedding/completeness'
import { blockingIssues, publicDisclosure, warningIssues, type PublishIssue } from '@/features/wedding/publishChecks'
import PersonalLinkGenerator from '@/features/cms/components/PersonalLinkGenerator.vue'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const route = useRoute()
const { t, locale } = useAppLocale()

const issues = computed<PublishIssue[]>(() => {
  const seen = new Set<string>()
  return [...store.publishIssues, ...store.publishChecklist].filter((i) => {
    const key = `${i.severity}|${i.section}|${i.field}|${i.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const errors = computed(() => blockingIssues(issues.value))
const warnings = computed(() => warningIssues(issues.value))

// Ask the server what publishing would say about the SAVED draft, whenever it changes
// (revision or template), so "all clear" is only claimed once the server agrees.
watch(
  () => [store.record?.id, store.revision, store.themeId, store.saveState] as const,
  ([id, , , save]) => {
    if (id && save === 'saved' && !store.serverCheckCurrent) void store.refreshServerCheck()
  },
  { immediate: true },
)
const serverPending = computed(() => !store.serverCheckCurrent && store.serverCheckState !== 'failed')

const state = computed(() => store.publishState)
const publishedTime = computed(() => {
  const at = store.publication?.publishedAt
  if (!at) return ''
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
})
const statusText = computed(() => {
  switch (state.value) {
    case 'publishing':
      return t('publishStatusPublishing')
    case 'failed':
      return t('publishStatusFailed')
    case 'unpublished_changes':
      return t('publishStatusChanges')
    case 'published':
      return t('publishStatusPublished', { time: publishedTime.value })
    default:
      return t('publishStatusDraft')
  }
})
const statusTone = computed(() =>
  state.value === 'failed'
    ? 'border-danger-600/30 bg-danger-50 text-danger-600'
    : state.value === 'published'
      ? 'border-emerald-700/20 bg-emerald-50 text-emerald-800'
      : state.value === 'unpublished_changes'
        ? 'border-amber-700/20 bg-amber-50 text-amber-800'
        : 'border-line bg-surface text-ink-900',
)

/** Why Publish is disabled (null = enabled). */
const disabledReason = computed<string | null>(() => {
  if (store.publishState === 'publishing') return null // loading state instead
  if (store.saveState === 'conflict') return t('publishConflictReason')
  if (store.saveState === 'saving') return t('publishSavingReason')
  if (errors.value.length) return t('publishBlockedReason')
  if (store.saveState !== 'saved' && store.saveState !== 'unsaved') return t('publishUnsavedReason')
  if (state.value === 'published') return t('publishUpToDate')
  return null
})
const publishLabel = computed(() => (store.isPublished ? t('publishUpdateAction') : t('publishAction')))

async function onPublish() {
  if (disabledReason.value) return
  await store.publish()
}

const disclosure = computed(() => (store.content ? publicDisclosure(store.content) : { bankAccounts: 0, qris: false, physical: [] }))
const physicalFields = computed(() =>
  disclosure.value.physical
    .map((k) => t(({ recipient: 'privacyRecipient', address: 'privacyAddress', phone: 'privacyPhone', note: 'privacyNote' } as const)[k]))
    .join(', '),
)
const hasDisclosure = computed(() => disclosure.value.bankAccounts > 0 || disclosure.value.qris || disclosure.value.physical.length > 0)

function sectionLabel(section: PublishIssue['section']): string {
  if (section === 'theme') return t('sectionTheme')
  try {
    return t(sectionByKey(section as SectionKey, store.variant).label)
  } catch {
    return section
  }
}

// --- Copy link ------------------------------------------------------------------
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')
const linkInput = ref<HTMLInputElement | null>(null)
async function copyLink() {
  if (!store.publicUrl) return
  try {
    await navigator.clipboard.writeText(store.publicUrl)
    copyStatus.value = 'copied'
  } catch {
    copyStatus.value = 'failed'
    linkInput.value?.select()
  }
}

const previewTo = computed(() => ({ name: INVITATION_PREVIEW_ROUTE_NAME, query: { from: route.fullPath } }))

// The Unpublish button disappears once it succeeds; put focus on Publish instead of <body> (WCAG 2.4.3).
async function unpublishAndRefocus() {
  if (await store.unpublish()) {
    await nextTick()
    document.querySelector<HTMLElement>('[data-action="publish"]')?.focus()
  }
}
</script>

<template>
  <div class="space-y-8" data-testid="publish-page">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold">{{ t('sectionPublish') }}</h1>
    </header>

    <!-- Status -->
    <section
      :class="['rounded-[var(--radius-card)] border p-4 sm:p-6', statusTone]"
      :aria-label="t('publishStatusLabel')"
      data-testid="publish-status"
      :data-state="state"
    >
      <p class="font-medium" data-testid="publish-status-text">{{ statusText }}</p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <BaseButton
          class="min-h-11 sm:min-h-0"
          :loading="state === 'publishing'"
          :disabled="!!disabledReason"
          :aria-describedby="disabledReason ? 'publish-disabled-reason' : undefined"
          data-action="publish"
          @click="onPublish"
        >
          {{ publishLabel }}
        </BaseButton>
        <BaseButton
          v-if="store.isPublished"
          variant="secondary"
          class="min-h-11 sm:min-h-0"
          :disabled="state === 'publishing'"
          data-action="unpublish"
          @click="unpublishAndRefocus"
        >
          {{ t('unpublishAction') }}
        </BaseButton>
        <RouterLink
          :to="previewTo"
          class="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-rose-700 underline underline-offset-2 hover:bg-rose-50 sm:min-h-9"
          data-action="preview-draft"
        >
          {{ t('previewDraft') }}
        </RouterLink>
      </div>
      <p v-if="disabledReason" id="publish-disabled-reason" class="mt-2 text-sm opacity-90" data-testid="publish-disabled-reason">
        {{ disabledReason }}
      </p>
    </section>

    <!-- Public link -->
    <section class="space-y-2" data-testid="publish-link">
      <h2 class="text-lg font-semibold">{{ t('publicLinkLabel') }}</h2>
      <template v-if="store.publicUrl && store.isPublished">
        <div class="flex flex-wrap items-center gap-2">
          <label for="public-url" class="sr-only">{{ t('publicLinkLabel') }}</label>
          <input
            id="public-url"
            ref="linkInput"
            :value="store.publicUrl"
            readonly
            class="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm sm:min-h-9"
            data-testid="public-url"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <BaseButton variant="secondary" class="min-h-11 sm:min-h-0" data-action="copy-link" @click="copyLink">{{ t('copyLink') }}</BaseButton>
        </div>
        <p class="text-sm text-ink-500" role="status" data-testid="copy-status">
          <template v-if="copyStatus === 'copied'">{{ t('linkCopied') }}</template>
          <template v-else-if="copyStatus === 'failed'">{{ t('copyFailed') }}</template>
        </p>
        <a
          :href="store.publicUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-11 items-center text-sm font-medium text-rose-700 underline underline-offset-2 sm:min-h-0"
          data-action="view-published"
        >
          {{ t('viewPublished') }}<span aria-hidden="true">&nbsp;↗</span><span class="sr-only"> {{ t('opensInNewTab') }}</span>
        </a>
      </template>
      <p v-else class="text-sm text-ink-500" data-testid="public-url-pending">{{ t('publicLinkPending') }}</p>
    </section>

    <PersonalLinkGenerator :public-url="store.isPublished ? store.publicUrl : null" />

    <!-- Privacy -->
    <section class="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" data-testid="publish-privacy">
      <h2 class="text-lg font-semibold">{{ t('publishPrivacyTitle') }}</h2>
      <p class="text-sm text-ink-700">{{ t('publishPrivacyIntro') }}</p>
      <ul v-if="hasDisclosure" class="list-disc space-y-1 pl-5 text-sm text-ink-700">
        <li v-if="disclosure.bankAccounts" data-privacy="bank">{{ t('privacyBankAccounts', { count: disclosure.bankAccounts }) }}</li>
        <li v-if="disclosure.qris" data-privacy="qris">{{ t('privacyQris') }}</li>
        <li v-if="disclosure.physical.length" data-privacy="physical">{{ t('privacyPhysical', { fields: physicalFields }) }}</li>
      </ul>
      <p v-else class="text-sm text-ink-500" data-privacy="none">{{ t('publishPrivacyNone') }}</p>
      <p class="text-xs text-ink-500">{{ t('privacyNoindex') }}</p>
    </section>

    <!-- Checklist -->
    <section v-if="errors.length" class="space-y-3" aria-labelledby="publish-errors-title" data-testid="publish-errors">
      <h2 id="publish-errors-title" class="text-lg font-semibold text-danger-600">{{ t('publishErrorsTitle') }} ({{ errors.length }})</h2>
      <ul class="space-y-2">
        <li
          v-for="issue in errors"
          :key="`${issue.section}-${issue.field}-${issue.code}`"
          class="rounded-lg border border-danger-600/20 bg-danger-50 px-3 py-2 text-sm"
          :data-issue="`${issue.section}.${issue.field}`"
        >
          <p class="text-ink-900">{{ issue.message }}</p>
          <RouterLink :to="issue.to" class="font-medium text-danger-600 underline underline-offset-2" data-action="fix-issue">
            {{ t('publishFixLink', { section: sectionLabel(issue.section) }) }}
          </RouterLink>
        </li>
      </ul>
    </section>
    <p v-else-if="store.serverCheckCurrent" class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" data-testid="publish-all-clear">{{ t('publishAllClear') }}</p>
    <p v-else-if="serverPending" class="rounded-lg bg-canvas px-3 py-2 text-sm text-ink-700" role="status" data-testid="publish-server-pending">{{ t('serverCheckPending') }}</p>
    <p v-else class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="publish-server-failed">{{ t('serverCheckFailed') }}</p>

    <section v-if="warnings.length" class="space-y-3" aria-labelledby="publish-warnings-title" data-testid="publish-warnings">
      <h2 id="publish-warnings-title" class="text-lg font-semibold">{{ t('publishWarningsTitle') }} ({{ warnings.length }})</h2>
      <ul class="space-y-2">
        <li
          v-for="issue in warnings"
          :key="`${issue.section}-${issue.field}-${issue.code}`"
          class="rounded-lg border border-amber-700/20 bg-amber-50 px-3 py-2 text-sm"
          :data-issue="`${issue.section}.${issue.field}`"
        >
          <p class="text-ink-900">{{ issue.message }}</p>
          <RouterLink :to="issue.to" class="font-medium text-amber-800 underline underline-offset-2" data-action="fix-issue">
            {{ t('publishFixLink', { section: sectionLabel(issue.section) }) }}
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
