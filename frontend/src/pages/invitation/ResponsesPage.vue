<script setup lang="ts">
/**
 * RSVP responses (owner only): summary (responses, attending, not attending,
 * attending people, capacity left), the replies (a table on wide screens, cards
 * on phones) with pagination, Export CSV (same-origin download of the CSV
 * endpoint; the session cookie authenticates it) and delete with confirmation.
 * Guest data is shown only here and never logged.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { invitationsApi, type RsvpResponse, type RsvpResponsePage } from '@/api/invitations'
import BaseButton from '@/components/ui/BaseButton.vue'
import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import { invitationName } from '@/features/invitation/catalog'
import { useInvitationStore } from '@/stores/invitation'

const RESPONSES_PAGE_SIZE = 25

const route = useRoute()
const store = useInvitationStore()
const { t, locale } = useAppLocale()
const toast = useToast()
const confirm = useConfirm()

const id = computed(() => String(route.params.id))
const offset = computed(() => {
  const n = Number(route.query.offset)
  return Number.isInteger(n) && n > 0 ? n : 0
})
const page = ref<RsvpResponsePage | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')

let seq = 0
async function load() {
  const mine = ++seq
  state.value = 'loading'
  try {
    const result = await invitationsApi.rsvpResponses(id.value, { limit: RESPONSES_PAGE_SIZE, offset: offset.value })
    if (mine !== seq) return
    page.value = result
    state.value = 'ready'
  } catch {
    if (mine === seq) state.value = 'error'
  }
}
watch([id, offset], () => void load(), { immediate: true })
watch(id, (v) => void store.ensureLoaded(v), { immediate: true })

const name = computed(() => (store.record ? invitationName(store.record, locale.value) : ''))
const s = computed(() => page.value?.summary)
const capacityLeft = computed(() => (s.value && s.value.capacity != null ? Math.max(0, s.value.capacity - s.value.attendingPeople) : null))
const csvUrl = computed(() => invitationsApi.rsvpResponsesCsvUrl(id.value))

const sessionTitle = (sid: string) => store.content?.events.find((e) => e.id === sid)?.title?.trim() || sid
const fieldLabel = (fid: string) => store.content?.rsvp.registrationFields?.find((f) => f.id === fid)?.label || fid
const contact = (r: RsvpResponse) => [r.email, r.phone].filter(Boolean).join(' · ')
const answers = (r: RsvpResponse) =>
  Object.entries(r.answers).map(([k, v]) => `${fieldLabel(k)}: ${typeof v === 'boolean' ? t(v ? 'answerYes' : 'answerNo') : v}`)
const when = (iso: string) =>
  new Intl.DateTimeFormat(locale.value === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const attendanceLabel = (r: RsvpResponse) => t(r.attendance === 'attending' ? 'attending' : 'notAttending')

const total = computed(() => page.value?.total ?? 0)
const from = computed(() => (total.value ? offset.value + 1 : 0))
const to = computed(() => Math.min(offset.value + RESPONSES_PAGE_SIZE, total.value))
const prevQuery = computed(() => ({ ...route.query, offset: offset.value - RESPONSES_PAGE_SIZE > 0 ? String(offset.value - RESPONSES_PAGE_SIZE) : undefined }))
const nextQuery = computed(() => ({ ...route.query, offset: String(offset.value + RESPONSES_PAGE_SIZE) }))

async function remove(r: RsvpResponse) {
  const ok = await confirm.ask({
    title: t('deleteResponseTitle', { name: r.name }),
    message: t('deleteResponseBody'),
    confirmLabel: t('delete'),
    cancelLabel: t('cancel'),
    tone: 'danger',
  })
  if (!ok) return
  try {
    await invitationsApi.deleteRsvpResponse(id.value, r.id)
    toast.success(t('responseDeleted', { name: r.name }))
    await load()
  } catch {
    toast.error(t('responseDeleteFailed'))
  }
}
const linkBtn = ['inline-flex min-h-11 items-center rounded-full border border-ink-500/85 px-4 text-sm font-medium text-ink-700 hover:bg-rose-50 sm:min-h-9', FOCUS_RING]
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6" data-testid="responses-page">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <RouterLink :to="{ name: 'invitations' }" class="text-sm text-rose-700 underline underline-offset-2">‹ {{ t('invitations') }}</RouterLink>
        <h1 class="mt-1 text-3xl font-semibold">{{ t('responses') }}</h1>
        <p v-if="name" class="truncate text-sm text-ink-700" data-testid="responses-invitation">{{ name }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink :to="{ name: 'editor-rsvp', params: { id } }" :class="linkBtn">{{ t('rsvpSettings') }}</RouterLink>
        <a :href="csvUrl" download :class="['inline-flex min-h-11 items-center rounded-full bg-[var(--tv-plum)] px-5 text-sm font-semibold text-white hover:bg-[var(--tv-plum-soft)] sm:min-h-9', FOCUS_RING]" data-action="export-csv">
          {{ t('exportCsv') }}
        </a>
      </div>
    </header>

    <div v-if="state === 'error'" role="alert" class="rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
      <p class="font-medium">{{ t('responsesLoadFailed') }}</p>
      <BaseButton class="mt-3" variant="secondary" data-action="retry" @click="load()">{{ t('tryAgain') }}</BaseButton>
    </div>
    <p v-else-if="state === 'loading' && !page" role="status" class="text-sm text-ink-500">{{ t('loadingResponses') }}</p>

    <template v-if="page && s">
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="responses-summary">
        <div v-for="item in [
          { key: 'responses', label: t('summaryResponses'), value: s.responses },
          { key: 'attending', label: t('summaryAttending'), value: s.attending },
          { key: 'notAttending', label: t('summaryNotAttending'), value: s.notAttending },
          { key: 'attendingPeople', label: t('summaryAttendingPeople'), value: s.attendingPeople },
          { key: 'capacityLeft', label: t('summaryCapacityLeft'), value: capacityLeft === null ? t('noLimit') : capacityLeft },
        ]" :key="item.key" class="rounded-xl border border-line bg-surface p-3" :data-summary="item.key">
          <dt class="text-xs text-ink-500">{{ item.label }}</dt>
          <dd class="mt-1 font-display text-2xl font-semibold lining-nums tabular-nums text-[var(--tv-plum)]">{{ item.value }}</dd>
        </div>
      </dl>

      <p v-if="(s.possibleDuplicates ?? 0) > 0" class="rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" data-testid="responses-duplicates">
        {{ t('duplicatesNotice', { count: s.possibleDuplicates ?? 0 }) }}
      </p>
      <p class="text-xs text-ink-500" data-testid="responses-how-changes-work">{{ t('responsesChangesNote') }}</p>

      <p v-if="page.items.length === 0" class="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-sm text-ink-700" data-testid="responses-empty">
        {{ t('responsesEmpty') }}
      </p>
      <template v-else>
        <!-- Wide screens: an accessible table -->
        <div class="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface md:block">
          <table class="w-full text-left text-sm" data-testid="responses-table">
            <caption class="sr-only">{{ t('responsesTableCaption', { from, to, total }) }}</caption>
            <thead class="bg-canvas text-xs text-ink-700">
              <tr>
                <th scope="col" class="px-3 py-2">{{ t('colName') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colAttendance') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colPartySize') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colContact') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colSessions') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colAnswers') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colMessage') }}</th>
                <th scope="col" class="px-3 py-2">{{ t('colTime') }}</th>
                <th scope="col" class="px-3 py-2"><span class="sr-only">{{ t('colActions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in page.items" :key="r.id" class="border-t border-line align-top" :data-response="r.id">
                <th scope="row" class="px-3 py-2 font-medium">{{ r.name }}<span v-if="r.possibleDuplicate" class="ml-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900" data-badge="duplicate">{{ t('badgePossibleDuplicate') }}</span><span v-if="r.updatedAt" class="ml-1 inline-block rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-700" :title="when(r.updatedAt)" data-badge="updated">{{ t('badgeUpdated') }}</span><span v-if="r.guestLabel" class="block text-xs font-normal text-ink-500">{{ r.guestLabel }}</span></th>
                <td class="px-3 py-2">{{ attendanceLabel(r) }}</td>
                <td class="px-3 py-2">{{ r.partySize }}</td>
                <td class="px-3 py-2 break-all">{{ contact(r) }}</td>
                <td class="px-3 py-2">{{ r.sessionIds.map(sessionTitle).join(', ') }}</td>
                <td class="px-3 py-2"><span v-for="a in answers(r)" :key="a" class="block">{{ a }}</span></td>
                <td class="max-w-xs px-3 py-2 whitespace-pre-line">{{ r.message }}</td>
                <td class="px-3 py-2 whitespace-nowrap">{{ when(r.createdAt) }}</td>
                <td class="px-3 py-2">
                  <button type="button" :class="['min-h-9 rounded-md px-2 text-danger-600 hover:bg-danger-50', FOCUS_RING]" :aria-label="t('deleteResponseNamed', { name: r.name })" data-action="delete-response" @click="remove(r)">
                    {{ t('delete') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Phones: cards -->
        <ul class="space-y-3 md:hidden" data-testid="responses-cards">
          <li v-for="r in page.items" :key="r.id" class="rounded-xl border border-line bg-surface p-4 text-sm">
            <div class="flex items-start justify-between gap-2">
              <h2 class="font-semibold">{{ r.name }}<span v-if="r.possibleDuplicate" class="ml-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900" data-badge="duplicate">{{ t('badgePossibleDuplicate') }}</span><span v-if="r.updatedAt" class="ml-1 inline-block rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-700" :title="when(r.updatedAt)" data-badge="updated">{{ t('badgeUpdated') }}</span></h2>
              <span class="text-xs text-ink-500">{{ when(r.createdAt) }}</span>
            </div>
            <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt class="text-ink-500">{{ t('colAttendance') }}</dt><dd>{{ attendanceLabel(r) }} · {{ r.partySize }}</dd>
              <template v-if="contact(r)"><dt class="text-ink-500">{{ t('colContact') }}</dt><dd class="break-all">{{ contact(r) }}</dd></template>
              <template v-if="r.sessionIds.length"><dt class="text-ink-500">{{ t('colSessions') }}</dt><dd>{{ r.sessionIds.map(sessionTitle).join(', ') }}</dd></template>
              <template v-if="answers(r).length"><dt class="text-ink-500">{{ t('colAnswers') }}</dt><dd><span v-for="a in answers(r)" :key="a" class="block">{{ a }}</span></dd></template>
              <template v-if="r.message"><dt class="text-ink-500">{{ t('colMessage') }}</dt><dd class="whitespace-pre-line">{{ r.message }}</dd></template>
            </dl>
            <button type="button" :class="['mt-2 min-h-11 rounded-md px-2 text-danger-600 hover:bg-danger-50', FOCUS_RING]" :aria-label="t('deleteResponseNamed', { name: r.name })" data-action="delete-response" @click="remove(r)">
              {{ t('delete') }}
            </button>
          </li>
        </ul>
        <nav class="flex flex-wrap items-center justify-between gap-3 text-sm" :aria-label="t('pagination')" data-testid="responses-pagination">
          <p aria-live="polite">{{ t('showingRange', { from, to, total }) }}</p>
          <div class="flex gap-2">
            <RouterLink v-if="offset > 0" :to="{ query: prevQuery }" :class="linkBtn" data-action="prev-page">{{ t('previousPage') }}</RouterLink>
            <RouterLink v-if="to < total" :to="{ query: nextQuery }" :class="linkBtn" data-action="next-page">{{ t('nextPage') }}</RouterLink>
          </div>
        </nav>
      </template>
    </template>
  </div>
</template>
