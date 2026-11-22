<script setup lang="ts">
/**
 * The guest RSVP form of the published invitation (public mode only — the editor shows
 * a non-submitting sample instead). Text follows the invitation's language.
 *
 * Accessibility: native controls with visible labels; required fields carry
 * `aria-required` and a visible mark; each error is linked with `aria-describedby`;
 * on a failed submit an error summary receives focus and links to each field; the
 * success message receives focus. The honeypot (`website`) is visually hidden,
 * `aria-hidden`, out of the tab order and never autofilled.
 *
 * Privacy: nothing the guest types is stored on the device. After a reply the device
 * keeps a "you already replied" flag and the reply's private edit token, which lets
 * THIS guest change THIS reply (never matched by name or email). The token is sent in
 * a header, and the personal link carries it in the URL fragment (never sent to servers).
 *
 * Changing a reply REPLACES it (same row on the server: totals and capacity count only
 * the latest answer). "Send a separate reply" adds a new one, e.g. for another person.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'

import { publishingApi, type PublicOwnReply, type PublicRsvpReceipt } from '@/api/publishing'
import { formatDate } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import { tvTranslator } from '../themes/temuvibe/wording'
import {
  EMAIL_MAX,
  FIELD_MAX,
  MESSAGE_MAX,
  NAME_MAX,
  PHONE_MAX,
  formConfig,
  hasReplied,
  initialValues,
  isPastDeadline,
  editLink,
  markReplied,
  outcomeOf,
  storeEditToken,
  storedEditToken,
  takeTokenFromFragment,
  toSubmission,
  validate,
  valuesFromReply,
  type FieldErrorCode,
  type FieldErrors,
} from './rsvpFormLogic'

const props = defineProps<{ content: WeddingContent; slug: string; timezone?: string; guestName?: string }>()

const uid = useId()
const t = computed(() => tvTranslator(props.content.locale))
const config = computed(() => formConfig(props.content.rsvp, props.content.events))
const values = reactive(initialValues(config.value, props.guestName))
/** Typed v-model targets for registration answers (merged into `values.answers` on submit). */
const textAnswers = reactive<Record<string, string>>({})
const checkAnswers = reactive<Record<string, boolean>>({})
function resetAnswers() {
  for (const f of config.value.fields) {
    if (f.type === 'checkbox') checkAnswers[f.id] = checkAnswers[f.id] ?? false
    else textAnswers[f.id] = textAnswers[f.id] ?? ''
  }
}
resetAnswers()
watch(config, resetAnswers)
function syncAnswers() {
  values.answers = Object.fromEntries(
    config.value.fields.map((f) => [f.id, f.type === 'checkbox' ? checkAnswers[f.id] === true : (textAnswers[f.id] ?? '')]),
  )
}

type Phase = 'loading' | 'existing' | 'form' | 'submitting' | 'success'
const phase = ref<Phase>('form')
/** new = POST a new reply; edit = PUT over the guest's own reply (needs `token`). */
const mode = ref<'new' | 'edit'>('new')
const token = ref<string | null>(null)
const ownReply = ref<PublicOwnReply | null>(null)
const linkLost = ref(false)
const copied = ref(false)
const lastWasUpdate = ref(false)
const errors = ref<FieldErrors>({})
const banner = ref<{ kind: 'rateLimited' | 'network' | 'failed' | 'capacity'; extra?: string[] } | null>(null)
const serverClosed = ref<'closed' | 'full' | null>(null)
const receipt = ref<PublicRsvpReceipt | null>(null)
const showSummary = ref(false)
const alreadyReplied = ref(hasReplied(props.slug))
const existingEl = ref<HTMLElement | null>(null)

async function loadOwnReply(): Promise<void> {
  if (!token.value) return
  try {
    ownReply.value = await publishingApi.getOwnRsvp(props.slug, token.value)
    phase.value = 'existing'
  } catch (err) {
    if (outcomeOf(err, config.value).kind === 'linkInvalid') forgetToken()
    else ownLoadFailed.value = true // offline / busy: say so, keep the token, offer a retry
    phase.value = 'form'
  }
}
const ownLoadFailed = ref(false)
function retryOwnReply() {
  ownLoadFailed.value = false
  phase.value = 'loading'
  void loadOwnReply()
}

/**
 * Shared device (family tablet, venue kiosk): someone else wants to reply. Forget this
 * device's link to the previous guest's reply (they still have their personal link) and
 * start a blank, separate reply.
 */
async function notMe() {
  storeEditToken(props.slug, null)
  token.value = null
  ownReply.value = null
  linkLost.value = false
  replyAgain()
  await nextTick()
  document.getElementById(id('name'))?.focus()
}

function forgetToken() {
  storeEditToken(props.slug, null)
  token.value = null
  ownReply.value = null
  linkLost.value = true
  mode.value = 'new'
}

onMounted(() => {
  token.value = takeTokenFromFragment(props.slug) ?? storedEditToken(props.slug)
  if (token.value) {
    phase.value = 'loading'
    void loadOwnReply()
  }
  window.addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))

/** A personal link opened in a tab that already shows this invitation. */
function onHashChange() {
  const fromLink = takeTokenFromFragment(props.slug)
  if (!fromLink || fromLink === token.value) return
  token.value = fromLink
  linkLost.value = false
  mode.value = 'new'
  phase.value = 'loading'
  void loadOwnReply()
}

function fillFrom(next: ReturnType<typeof initialValues>) {
  Object.assign(values, next)
  for (const f of config.value.fields) {
    const v = next.answers[f.id]
    if (f.type === 'checkbox') checkAnswers[f.id] = v === true
    else textAnswers[f.id] = typeof v === 'string' ? v : ''
  }
}

async function startEdit() {
  if (!ownReply.value) return
  fillFrom(valuesFromReply(config.value, ownReply.value))
  errors.value = {}
  banner.value = null
  mode.value = 'edit'
  phase.value = 'form'
  await nextTick()
  document.getElementById(id('name'))?.focus()
}

async function cancelEdit() {
  mode.value = 'new'
  phase.value = ownReply.value ? 'existing' : 'form'
  await nextTick()
  existingEl.value?.focus()
}

async function copyLink() {
  if (!token.value) return
  try {
    await navigator.clipboard.writeText(editLink(props.slug, token.value))
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    document.getElementById(id('edit-link'))?.focus()
    ;(document.getElementById(id('edit-link')) as HTMLInputElement | null)?.select()
  }
}
const personalLink = computed(() => (token.value ? editLink(props.slug, token.value) : ''))
const people = (n: number) => (n === 1 ? t.value('tvRsvpPerson') : t.value('tvRsvpPeople'))
const replyDate = (iso: string | null | undefined) => {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(props.content.locale === 'id' ? 'id-ID' : 'en-GB', {
      dateStyle: 'long', timeStyle: 'short', timeZone: props.timezone || undefined,
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

const summaryEl = ref<HTMLElement | null>(null)
const successEl = ref<HTMLElement | null>(null)
const bannerEl = ref<HTMLElement | null>(null)

const pastDeadline = computed(() => isPastDeadline(props.content.rsvp.deadline, props.timezone))
const closedState = computed<'closed' | 'full' | null>(() => {
  if (serverClosed.value) return serverClosed.value
  if (props.content.rsvp.full === true) return 'full'
  if (pastDeadline.value) return 'closed'
  return null
})
/** The guest may change their own reply while the RSVP is open; a full event still lets them
 *  change it (their own seats are not counted twice), only the deadline closes it. */
const canChange = computed(() => !!ownReply.value && !!token.value && closedState.value !== 'closed')
const editing = computed(() => mode.value === 'edit' && canChange.value)
const deadlineText = computed(() => (props.content.rsvp.deadline ? formatDate(props.content.rsvp.deadline, props.content.locale, 'long') : ''))
const attending = computed(() => values.attendance === 'attending')
const partyOptions = computed(() => Array.from({ length: config.value.partyLimit }, (_, i) => i + 1))
const contact = computed(() => config.value.collectContact)

const id = (key: string) => `${uid}-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`
const errorId = (key: string) => `${id(key)}-error`
const describedBy = (key: string, hint?: boolean) => [hint ? `${id(key)}-hint` : '', errors.value[key] ? errorId(key) : ''].filter(Boolean).join(' ') || undefined

function errorText(e: FieldErrorCode): string {
  switch (e.code) {
    case 'required': return t.value('tvRsvpErrRequired')
    case 'choose': return t.value('tvRsvpErrChoose')
    case 'name': return t.value('tvRsvpErrName')
    case 'tooLong': return t.value('tvRsvpErrTooLong', { max: e.max })
    case 'email': return t.value('tvRsvpErrEmail')
    case 'phone': return t.value('tvRsvpErrPhone')
    case 'partySize': return t.value('tvRsvpErrPartySize', { max: e.max })
    case 'contact': return t.value('tvRsvpErrContact')
    case 'checkbox': return t.value('tvRsvpErrCheckbox')
    case 'server': return t.value('tvRsvpErrServer')
  }
}

/** Field label for the error summary. */
function labelOf(key: string): string {
  if (key.startsWith('answers.')) return config.value.fields.find((f) => `answers.${f.id}` === key)?.label ?? key
  const map: Record<string, string> = {
    name: t.value('tvRsvpName'), attendance: t.value('tvRsvpAttendance'), partySize: t.value('tvRsvpPartySize'),
    email: t.value('tvRsvpEmail'), phone: t.value('tvRsvpPhone'), sessionIds: t.value('tvRsvpSessions'), message: t.value('tvRsvpMessage'),
  }
  return map[key] ?? key
}
/** The element a summary link focuses (radio/checkbox groups: their first control). */
const targetId = (key: string) => (key === 'attendance' ? id('attendance-yes') : key === 'sessionIds' ? id(`session-${config.value.optionalSessions[0]?.id ?? ''}`) : id(key))
const errorList = computed(() => Object.entries(errors.value).map(([key, e]) => ({ key, label: labelOf(key), text: errorText(e) })))

function focusField(key: string) {
  document.getElementById(targetId(key))?.focus()
}

async function submit() {
  if (phase.value === 'submitting' || (closedState.value && !editing.value)) return
  banner.value = null
  syncAnswers()
  const found = validate(values, config.value)
  errors.value = found
  if (Object.keys(found).length) {
    showSummary.value = true
    await nextTick()
    summaryEl.value?.focus()
    return
  }
  showSummary.value = false
  phase.value = 'submitting'
  const isEdit = editing.value
  try {
    const body = toSubmission(values, config.value, props.guestName)
    receipt.value = isEdit
      ? await publishingApi.updateOwnRsvp(props.slug, token.value!, body)
      : await publishingApi.submitRsvp(props.slug, body)
    if (!isEdit && receipt.value.editToken) {
      token.value = receipt.value.editToken
      storeEditToken(props.slug, token.value)
      linkLost.value = false
    }
    lastWasUpdate.value = isEdit
    mode.value = 'new'
    phase.value = 'success'
    markReplied(props.slug)
    alreadyReplied.value = true
    if (token.value) publishingApi.getOwnRsvp(props.slug, token.value).then((r) => (ownReply.value = r)).catch(() => undefined)
    await nextTick()
    successEl.value?.focus()
  } catch (err) {
    phase.value = 'form'
    const outcome = outcomeOf(err, config.value)
    switch (outcome.kind) {
      case 'linkInvalid':
        forgetToken()
        await nextTick()
        bannerEl.value?.focus()
        return
      case 'closed':
      case 'limit':
        serverClosed.value = 'closed'
        return
      case 'full':
        serverClosed.value = 'full'
        return
      case 'fields':
        errors.value = outcome.errors
        if (Object.keys(outcome.errors).length) {
          showSummary.value = true
          await nextTick()
          summaryEl.value?.focus()
        }
        if (outcome.unmapped.length) banner.value = { kind: 'failed', extra: outcome.unmapped }
        return
      default:
        banner.value = { kind: outcome.kind }
        await nextTick()
        bannerEl.value?.focus()
    }
  }
}

/** A separate, NEW reply (e.g. for another person). It never changes the guest's own reply. */
function replyAgain() {
  Object.assign(values, initialValues(config.value, props.guestName))
  for (const k of Object.keys(textAnswers)) textAnswers[k] = ''
  for (const k of Object.keys(checkAnswers)) checkAnswers[k] = false
  errors.value = {}
  receipt.value = null
  mode.value = 'new'
  phase.value = 'form'
}

const successMessage = computed(() => {
  const fromServer = receipt.value?.confirmationMessage?.trim()
  if (fromServer) return fromServer
  if (props.content.rsvp.confirmationMessage?.trim()) return props.content.rsvp.confirmationMessage.trim()
  return receipt.value?.attendance === 'not_attending' ? t.value('tvRsvpSuccessDeclined') : t.value('tvRsvpSuccessDefault')
})
const bannerText = computed(() => {
  const b = banner.value
  if (!b) return ''
  if (b.kind === 'capacity') return t.value('tvRsvpCapacityBody', { count: values.partySize })
  if (b.kind === 'rateLimited') return t.value('tvRsvpRateLimited')
  if (b.kind === 'network') return t.value('tvRsvpNetwork')
  return t.value('tvRsvpFailed')
})
const fieldMax = (type: keyof typeof FIELD_MAX) => FIELD_MAX[type] || undefined
</script>

<template>
  <div class="tvf" data-testid="rsvp-live">
    <p v-if="phase === 'loading'" class="tvf-note" role="status" data-testid="rsvp-loading">{{ t('tvRsvpLoadingOwn') }}</p>

    <!-- The guest's own reply (they hold its edit token): change it, or add a separate one. -->
    <div v-else-if="phase === 'existing' && ownReply" ref="existingEl" class="tvf-state tvf-own" tabindex="-1" data-testid="rsvp-own">
      <p class="tvf-state__title">{{ t('tvRsvpYourReply') }}</p>
      <p data-testid="rsvp-own-summary"><strong dir="auto">{{ ownReply.name }}</strong> ·
        {{ ownReply.attendance === 'attending' ? t('tvRsvpYouAttend', { count: ownReply.partySize, people: people(ownReply.partySize) }) : t('tvRsvpYouDecline') }}</p>
      <p class="tvf-note">{{ ownReply.updatedAt ? t('tvRsvpUpdatedOn', { date: replyDate(ownReply.updatedAt) }) : t('tvRsvpSentOn', { date: replyDate(ownReply.createdAt) }) }}</p>
      <p v-if="closedState === 'closed'" class="tvf-note" role="status" data-testid="rsvp-own-closed">{{ t('tvRsvpClosedBody') }}</p>
      <div class="tvf-actions">
        <button v-if="canChange" type="button" class="tvf-submit" data-action="rsvp-change" @click="startEdit">{{ t('tvRsvpChange') }}</button>
        <button v-if="!closedState" type="button" class="tvf-link" data-action="rsvp-again" :aria-describedby="id('separate-hint')" @click="replyAgain">{{ t('tvRsvpReplyAgain') }}</button>
      </div>
      <p v-if="!closedState" :id="id('separate-hint')" class="tvf-note">{{ t('tvRsvpSeparateHint') }}</p>
      <button v-if="!closedState" type="button" class="tvf-link" data-action="rsvp-not-me" @click="notMe">{{ t('tvRsvpNotMe') }}</button>
    </div>

    <div v-else-if="phase === 'success'" ref="successEl" class="tvf-state tvf-state--success" role="status" tabindex="-1" data-testid="rsvp-success">
      <p class="tvf-state__title">{{ lastWasUpdate ? t('tvRsvpUpdatedTitle') : t('tvRsvpSuccessTitle') }}</p>
      <p dir="auto" class="tvf-pre">{{ successMessage }}</p>
      <div v-if="token" class="tvf-editlink" data-testid="rsvp-edit-link">
        <label class="tvf-label" :for="id('edit-link')">{{ t('tvRsvpLinkTitle') }}</label>
        <div class="tvf-editlink__row">
          <input :id="id('edit-link')" class="tvf-input" type="text" readonly :value="personalLink" :aria-describedby="id('edit-link-hint')" @focus="($event.target as HTMLInputElement).select()" />
          <button type="button" class="tvf-copy" data-action="rsvp-copy-link" @click="copyLink">{{ copied ? t('tvRsvpCopied') : t('tvRsvpCopyLink') }}</button>
        </div>
        <p :id="id('edit-link-hint')" class="tvf-note">{{ t('tvRsvpLinkHint') }}</p>
        <span class="universal-visually-hidden" aria-live="polite">{{ copied ? t('tvRsvpCopied') : '' }}</span>
      </div>
      <div class="tvf-actions">
        <button v-if="canChange" type="button" class="tvf-link" data-action="rsvp-change" @click="startEdit">{{ t('tvRsvpChange') }}</button>
        <button v-if="!closedState" type="button" class="tvf-link" data-action="rsvp-again" @click="replyAgain">{{ t('tvRsvpReplyAgain') }}</button>
      </div>
    </div>

    <!-- Closed for NEW replies: deadline passed (published time zone), RSVP full, or the server said so. -->
    <div v-else-if="closedState && !editing" class="tvf-state" role="status" :data-state="closedState" data-testid="rsvp-closed">
      <p class="tvf-state__title">{{ closedState === 'full' ? t('tvRsvpFullTitle') : t('tvRsvpClosedTitle') }}</p>
      <p>{{ closedState === 'full' ? t('tvRsvpFullBody') : t('tvRsvpClosedBody') }}</p>
    </div>

    <form v-else class="tvf-form" novalidate :aria-busy="phase === 'submitting' ? 'true' : undefined" :data-mode="mode" data-testid="rsvp-form" @submit.prevent="submit">
      <p v-if="deadlineText" class="tvf-note">{{ t('tvRsvpBy', { date: deadlineText }) }}</p>
      <p v-if="editing && ownReply" class="tvf-note tvf-note--strong" data-testid="rsvp-editing">{{ t('tvRsvpEditing', { date: replyDate(ownReply.createdAt) }) }}</p>
      <p v-else-if="linkLost" class="tvf-note" role="status" data-testid="rsvp-link-lost">{{ t('tvRsvpLinkLost') }}</p>
      <div v-else-if="ownLoadFailed && token" class="tvf-note" role="status" data-testid="rsvp-own-failed">
        {{ t('tvRsvpOwnLoadFailed') }}
        <button type="button" class="tvf-link" data-action="rsvp-retry-own" @click="retryOwnReply">{{ t('tvRsvpRetry') }}</button>
      </div>
      <p v-else-if="alreadyReplied && !token" class="tvf-note" data-testid="rsvp-already">{{ t('tvRsvpAlreadyReplied') }}</p>

      <div v-if="showSummary && errorList.length" ref="summaryEl" class="tvf-summary" tabindex="-1" role="alert" data-testid="rsvp-error-summary">
        <p class="tvf-summary__title">{{ errorList.length === 1 ? t('tvRsvpErrorSummaryOne') : t('tvRsvpErrorSummary', { count: errorList.length }) }}</p>
        <ul>
          <li v-for="e in errorList" :key="e.key">
            <a :href="`#${targetId(e.key)}`" @click.prevent="focusField(e.key)">{{ e.label }}: {{ e.text }}</a>
          </li>
        </ul>
      </div>

      <div v-if="banner" ref="bannerEl" class="tvf-banner" role="alert" tabindex="-1" :data-error="banner.kind" data-testid="rsvp-banner">
        <p>{{ bannerText }}</p>
        <p v-for="(m, i) in banner.extra ?? []" :key="i" dir="auto">{{ m }}</p>
        <button v-if="banner.kind === 'network' || banner.kind === 'failed' || banner.kind === 'rateLimited'" type="submit" class="tvf-link" data-action="rsvp-retry">{{ t('tvRsvpRetry') }}</button>
      </div>

      <!-- Name -->
      <div class="tvf-field">
        <label class="tvf-label" :for="id('name')">{{ t('tvRsvpName') }} <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></label>
        <input :id="id('name')" v-model="values.name" class="tvf-input" type="text" name="name" autocomplete="name" dir="auto" :maxlength="NAME_MAX" aria-required="true" :aria-invalid="errors.name ? 'true' : undefined" :aria-describedby="describedBy('name')" />
        <p v-if="errors.name" :id="errorId('name')" class="tvf-error">{{ errorText(errors.name) }}</p>
      </div>

      <!-- Attendance -->
      <fieldset class="tvf-field tvf-group" :aria-invalid="errors.attendance ? 'true' : undefined" :aria-describedby="describedBy('attendance')">
        <legend class="tvf-label">{{ t('tvRsvpAttendance') }} <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></legend>
        <label class="tvf-choice"><input :id="id('attendance-yes')" v-model="values.attendance" type="radio" :name="id('attendance')" value="attending" /> <span>{{ t('tvRsvpAttending') }}</span></label>
        <label class="tvf-choice"><input :id="id('attendance-no')" v-model="values.attendance" type="radio" :name="id('attendance')" value="not_attending" /> <span>{{ t('tvRsvpNotAttending') }}</span></label>
        <p v-if="errors.attendance" :id="errorId('attendance')" class="tvf-error">{{ errorText(errors.attendance) }}</p>
      </fieldset>

      <!-- Party size (attending only) -->
      <div v-if="attending && config.partyLimit > 1" class="tvf-field">
        <label class="tvf-label" :for="id('partySize')">{{ t('tvRsvpPartySize') }}</label>
        <p :id="`${id('partySize')}-hint`" class="tvf-hint">{{ t('tvRsvpPartySizeHint', { max: config.partyLimit }) }}</p>
        <select :id="id('partySize')" v-model.number="values.partySize" class="tvf-input tvf-select" name="partySize" :aria-invalid="errors.partySize ? 'true' : undefined" :aria-describedby="describedBy('partySize', true)">
          <option v-for="n in partyOptions" :key="n" :value="n">{{ n }}</option>
        </select>
        <p v-if="errors.partySize" :id="errorId('partySize')" class="tvf-error">{{ errorText(errors.partySize) }}</p>
      </div>

      <!-- Contact -->
      <p v-if="contact === 'email_or_phone'" :id="`${id('email')}-hint`" class="tvf-hint">{{ t('tvRsvpContactHint') }}</p>
      <div v-if="contact === 'email' || contact === 'email_or_phone'" class="tvf-field">
        <label class="tvf-label" :for="id('email')">{{ t('tvRsvpEmail') }}<template v-if="contact === 'email'"> <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></template></label>
        <input :id="id('email')" v-model="values.email" class="tvf-input" type="email" name="email" autocomplete="email" inputmode="email" :maxlength="EMAIL_MAX" :aria-required="contact === 'email' ? 'true' : undefined" :aria-invalid="errors.email ? 'true' : undefined" :aria-describedby="describedBy('email', contact === 'email_or_phone')" />
        <p v-if="errors.email" :id="errorId('email')" class="tvf-error">{{ errorText(errors.email) }}</p>
      </div>
      <div v-if="contact === 'phone' || contact === 'email_or_phone'" class="tvf-field">
        <label class="tvf-label" :for="id('phone')">{{ t('tvRsvpPhone') }}<template v-if="contact === 'phone'"> <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></template></label>
        <input :id="id('phone')" v-model="values.phone" class="tvf-input" type="tel" name="phone" autocomplete="tel" inputmode="tel" :maxlength="PHONE_MAX" :aria-required="contact === 'phone' ? 'true' : undefined" :aria-invalid="errors.phone ? 'true' : undefined" :aria-describedby="describedBy('phone')" />
        <p v-if="errors.phone" :id="errorId('phone')" class="tvf-error">{{ errorText(errors.phone) }}</p>
      </div>

      <!-- Optional sessions -->
      <fieldset v-if="attending && config.optionalSessions.length" class="tvf-field tvf-group" :aria-describedby="describedBy('sessionIds')" data-testid="rsvp-sessions">
        <legend class="tvf-label">{{ t('tvRsvpSessions') }}</legend>
        <label v-for="s in config.optionalSessions" :key="s.id" class="tvf-choice">
          <input :id="id(`session-${s.id}`)" v-model="values.sessionIds" type="checkbox" :value="s.id" /> <span dir="auto">{{ s.title }}</span>
        </label>
        <p v-if="errors.sessionIds" :id="errorId('sessionIds')" class="tvf-error">{{ errorText(errors.sessionIds) }}</p>
      </fieldset>

      <!-- Registration fields -->
      <template v-for="f in config.fields" :key="f.id">
        <div v-if="f.type === 'checkbox'" class="tvf-field">
          <label class="tvf-choice">
            <input :id="id(`answers.${f.id}`)" v-model="checkAnswers[f.id]" type="checkbox" :aria-required="f.required ? 'true' : undefined" :aria-invalid="errors[`answers.${f.id}`] ? 'true' : undefined" :aria-describedby="describedBy(`answers.${f.id}`)" />
            <span dir="auto">{{ f.label }}<template v-if="f.required"> <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></template></span>
          </label>
          <p v-if="errors[`answers.${f.id}`]" :id="errorId(`answers.${f.id}`)" class="tvf-error">{{ errorText(errors[`answers.${f.id}`]!) }}</p>
        </div>
        <div v-else class="tvf-field">
          <label class="tvf-label" :for="id(`answers.${f.id}`)"><span dir="auto">{{ f.label }}</span><template v-if="f.required"> <span class="tvf-req" aria-hidden="true">*</span><span class="universal-visually-hidden"> ({{ t('tvRsvpRequired') }})</span></template></label>
          <select v-if="f.type === 'select'" :id="id(`answers.${f.id}`)" v-model="textAnswers[f.id]" class="tvf-input tvf-select" :aria-required="f.required ? 'true' : undefined" :aria-invalid="errors[`answers.${f.id}`] ? 'true' : undefined" :aria-describedby="describedBy(`answers.${f.id}`)">
            <option value="">{{ t('tvRsvpSelectPlaceholder') }}</option>
            <option v-for="o in f.options ?? []" :key="o" :value="o">{{ o }}</option>
          </select>
          <textarea v-else-if="f.type === 'textarea'" :id="id(`answers.${f.id}`)" v-model="textAnswers[f.id]" class="tvf-input tvf-textarea" rows="3" dir="auto" :maxlength="fieldMax('textarea')" :aria-required="f.required ? 'true' : undefined" :aria-invalid="errors[`answers.${f.id}`] ? 'true' : undefined" :aria-describedby="describedBy(`answers.${f.id}`)" />
          <input
            v-else
            :id="id(`answers.${f.id}`)"
            v-model="textAnswers[f.id]"
            class="tvf-input"
            :type="f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : 'text'"
            :inputmode="f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : undefined"
            :autocomplete="f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : 'off'"
            dir="auto"
            :maxlength="fieldMax(f.type)"
            :aria-required="f.required ? 'true' : undefined"
            :aria-invalid="errors[`answers.${f.id}`] ? 'true' : undefined"
            :aria-describedby="describedBy(`answers.${f.id}`)"
          />
          <p v-if="errors[`answers.${f.id}`]" :id="errorId(`answers.${f.id}`)" class="tvf-error">{{ errorText(errors[`answers.${f.id}`]!) }}</p>
        </div>
      </template>

      <!-- Message -->
      <div class="tvf-field">
        <label class="tvf-label" :for="id('message')">{{ t('tvRsvpMessage') }}</label>
        <p :id="`${id('message')}-hint`" class="tvf-hint">{{ t('tvRsvpMessageHint') }}</p>
        <textarea :id="id('message')" v-model="values.message" class="tvf-input tvf-textarea" name="message" rows="3" dir="auto" :maxlength="MESSAGE_MAX" :aria-invalid="errors.message ? 'true' : undefined" :aria-describedby="describedBy('message', true)" />
        <p v-if="errors.message" :id="errorId('message')" class="tvf-error">{{ errorText(errors.message) }}</p>
      </div>

      <!-- Honeypot: invisible to people and assistive technology; bots fill it. -->
      <div class="tvf-hp" aria-hidden="true" data-honeypot>
        <label :for="id('website')">{{ t('tvRsvpHoneypot') }}</label>
        <input :id="id('website')" v-model="values.website" type="text" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <div class="tvf-actions">
        <button type="submit" class="tvf-submit" :disabled="phase === 'submitting'" data-action="rsvp-submit">
          <template v-if="mode === 'edit'">{{ phase === 'submitting' ? t('tvRsvpSaving') : t('tvRsvpSave') }}</template>
          <template v-else>{{ phase === 'submitting' ? t('tvRsvpSubmitting') : t('tvRsvpSubmit') }}</template>
        </button>
        <button v-if="mode === 'edit'" type="button" class="tvf-link" data-action="rsvp-cancel-edit" @click="cancelEdit">{{ t('tvRsvpCancel') }}</button>
      </div>
    </form>
  </div>
</template>

<style>
/* Neutral structure; Temuvibe tokens (--tv-*) colour it, with safe fallbacks elsewhere. */
.tvf { text-align: start; }
.tvf-form { display: grid; gap: 1.25rem; }
.tvf-field { display: grid; gap: 0.4rem; min-width: 0; margin: 0; padding: 0; border: 0; }
.tvf-group { gap: 0.5rem; }
.tvf-label { font-weight: 600; font-size: 0.95rem; padding: 0; }
.tvf-req { color: var(--tv-danger, #a12d3a); }
.tvf-hint, .tvf-note { font-size: 0.875rem; color: var(--tv-muted, #555); margin: 0; }
.tvf-input {
  width: 100%; min-height: 2.75rem; padding: 0.6rem 0.8rem; font: inherit; color: var(--tv-ink, #222);
  background: var(--tv-surface, #fff); border: 1px solid var(--tv-muted, #666); border-radius: var(--tv-radius, 0.25rem);
  box-sizing: border-box;
}
.tvf-textarea { min-height: 6rem; resize: vertical; }
.tvf-input[aria-invalid='true'] { border-color: var(--tv-danger, #a12d3a); border-width: 2px; }
.tvf-input:focus-visible, .tvf-choice input:focus-visible, .tvf-submit:focus-visible, .tvf-link:focus-visible, .tvf-summary a:focus-visible {
  outline: 3px solid var(--tv-accent-ink, currentColor); outline-offset: 2px;
}
.tvf-choice { display: flex; align-items: flex-start; gap: 0.6rem; min-height: 2.75rem; padding-block: 0.5rem; cursor: pointer; }
.tvf-choice input { width: 1.25rem; height: 1.25rem; margin: 0.1rem 0 0; flex: none; accent-color: var(--tv-primary, #241236); }
.tvf-error { color: var(--tv-danger, #a12d3a); font-size: 0.875rem; font-weight: 600; margin: 0; }
.tvf-summary, .tvf-banner { border: 2px solid var(--tv-danger, #a12d3a); border-radius: var(--tv-radius, 0.25rem); padding: 1rem; background: var(--tv-surface, #fff); }
.tvf-summary:focus, .tvf-banner:focus, .tvf-state:focus { outline: 3px solid var(--tv-accent-ink, currentColor); outline-offset: 2px; }
.tvf-summary__title { font-weight: 700; margin: 0 0 0.5rem; }
.tvf-summary ul { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: 0.25rem; }
.tvf-summary a { color: var(--tv-danger, #a12d3a); text-decoration: underline; }
.tvf-banner p { margin: 0 0 0.5rem; }
.tvf-submit {
  min-height: 3rem; padding: 0.75rem 1.5rem; font: inherit; font-weight: 600; cursor: pointer;
  color: var(--tv-on-primary, #fff); background: var(--tv-primary, #241236); border: 0; border-radius: var(--tv-radius, 0.25rem);
}
.tvf-submit[disabled] { opacity: 0.7; cursor: progress; }
.tvf-link { font: inherit; color: var(--tv-accent-ink, inherit); background: none; border: 0; padding: 0.5rem 0; min-height: 2.75rem; text-decoration: underline; cursor: pointer; }
.tvf-state { text-align: center; padding: 1.5rem; border: 1px solid var(--tv-line, #ddd); border-radius: var(--tv-radius, 0.25rem); background: var(--tv-surface, #fff); }
.tvf-state p { margin: 0 0 0.5rem; }
.tvf-state__title { font-family: var(--tv-font-display, inherit); font-size: 1.35rem; font-weight: 600; color: var(--tv-primary, inherit); }
.tvf-pre { white-space: pre-line; overflow-wrap: anywhere; }
.tvf-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem 1rem; }
.tvf-form .tvf-actions { justify-content: flex-start; }
.tvf-note--strong { color: var(--tv-ink, #222); font-weight: 600; }
.tvf-editlink { display: grid; gap: 0.4rem; margin: 1rem 0; text-align: start; }
.tvf-editlink__row { display: flex; gap: 0.5rem; }
.tvf-editlink__row .tvf-input { min-width: 0; font-size: 0.85rem; }
.tvf-copy {
  flex: none; min-height: 2.75rem; padding: 0 1rem; font: inherit; font-weight: 600; cursor: pointer;
  color: var(--tv-primary, #241236); background: transparent; border: 1px solid currentColor; border-radius: var(--tv-radius, 0.25rem);
}
.tvf-copy:focus-visible { outline: 3px solid var(--tv-accent-ink, currentColor); outline-offset: 2px; }
/* Honeypot: off-screen, zero-size, never focusable by tab. */
.tvf-hp { position: absolute !important; left: -10000px !important; top: auto !important; width: 1px !important; height: 1px !important; overflow: hidden !important; }
</style>
