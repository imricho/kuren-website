/**
 * Guest RSVP form logic (pure): client validation mirroring the public RSVP contract
 * (docs/api/invitations.md "RSVP submission"), the request body, server error mapping
 * and the deadline check in the invitation's time zone. The component only renders.
 */
import { ApiError } from '@/api/http'
import type { PublicRsvpSubmission } from '@/api/publishing'
import type { RegistrationField } from '@/features/invitation/types'
import type { RsvpSection, WeddingEvent } from '@/features/wedding/types'

export const NAME_MAX = 120
export const MESSAGE_MAX = 1000
export const EMAIL_MAX = 254
export const PHONE_MAX = 30
export const DEFAULT_PARTY_LIMIT = 20
/** Per registration field type (backend `_TEXT_LIMITS`). */
export const FIELD_MAX: Record<RegistrationField['type'], number> = { text: 200, textarea: 1000, email: 254, phone: 40, select: 80, checkbox: 0 }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^\+?[0-9]+(?:[ -][0-9]+)*$/

export type Attendance = 'attending' | 'not_attending'

export interface RsvpFormValues {
  name: string
  attendance: Attendance | ''
  partySize: number
  email: string
  phone: string
  sessionIds: string[]
  answers: Record<string, string | boolean>
  message: string
  /** Honeypot. Humans never see it; it must stay empty. */
  website: string
}

/** Error codes; the component turns them into localized text. */
export type FieldErrorCode =
  | { code: 'required' }
  | { code: 'choose' }
  | { code: 'name' }
  | { code: 'tooLong'; max: number }
  | { code: 'email' }
  | { code: 'phone' }
  | { code: 'partySize'; max: number }
  | { code: 'contact' }
  | { code: 'checkbox' }
  | { code: 'server'; message: string }

/** Field keys: name, attendance, partySize, email, phone, sessionIds, message, answers.<id>. */
export type FieldErrors = Record<string, FieldErrorCode>

export interface RsvpFormConfig {
  partyLimit: number
  collectContact: 'none' | 'email' | 'phone' | 'email_or_phone'
  /** Optional sessions guests may pick (only when `allowSessionChoice`). */
  optionalSessions: WeddingEvent[]
  fields: RegistrationField[]
}

export function formConfig(rsvp: RsvpSection, events: readonly WeddingEvent[]): RsvpFormConfig {
  const limit = rsvp.maxGuestsPerResponse
  return {
    partyLimit: Number.isInteger(limit) && limit! >= 1 && limit! <= DEFAULT_PARTY_LIMIT ? limit! : DEFAULT_PARTY_LIMIT,
    collectContact: rsvp.collectContact ?? 'none',
    optionalSessions: rsvp.allowSessionChoice ? events.filter((e) => e.optional === true) : [],
    fields: rsvp.registrationFields ?? [],
  }
}

export function initialValues(config: RsvpFormConfig, guestName?: string): RsvpFormValues {
  const answers: Record<string, string | boolean> = {}
  for (const f of config.fields) answers[f.id] = f.type === 'checkbox' ? false : ''
  return { name: guestName ?? '', attendance: '', partySize: 1, email: '', phone: '', sessionIds: [], answers, message: '', website: '' }
}

const len = (s: string) => Array.from(s).length

/** Client validation; mirrors the server so most problems never round-trip. */
export function validate(values: RsvpFormValues, config: RsvpFormConfig): FieldErrors {
  const errors: FieldErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = { code: 'name' }
  else if (len(name) > NAME_MAX) errors.name = { code: 'tooLong', max: NAME_MAX }

  if (!values.attendance) errors.attendance = { code: 'choose' }
  const attending = values.attendance === 'attending'
  if (attending && (!Number.isInteger(values.partySize) || values.partySize < 1 || values.partySize > config.partyLimit))
    errors.partySize = { code: 'partySize', max: config.partyLimit }

  const email = values.email.trim()
  const phone = values.phone.trim()
  const asksEmail = config.collectContact === 'email' || config.collectContact === 'email_or_phone'
  const asksPhone = config.collectContact === 'phone' || config.collectContact === 'email_or_phone'
  if (asksEmail && email) {
    if (len(email) > EMAIL_MAX) errors.email = { code: 'tooLong', max: EMAIL_MAX }
    else if (!EMAIL.test(email)) errors.email = { code: 'email' }
  }
  if (asksPhone && phone) {
    if (len(phone) > PHONE_MAX) errors.phone = { code: 'tooLong', max: PHONE_MAX }
    else if (!PHONE.test(phone)) errors.phone = { code: 'phone' }
  }
  if (config.collectContact === 'email' && !email) errors.email = { code: 'required' }
  if (config.collectContact === 'phone' && !phone) errors.phone = { code: 'required' }
  if (config.collectContact === 'email_or_phone' && !email && !phone) errors.email = { code: 'contact' }

  for (const f of config.fields) {
    const key = `answers.${f.id}`
    const value = values.answers[f.id]
    if (f.type === 'checkbox') {
      if (f.required && value !== true) errors[key] = { code: 'checkbox' }
      continue
    }
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) {
      if (f.required) errors[key] = f.type === 'select' ? { code: 'choose' } : { code: 'required' }
      continue
    }
    if (len(text) > FIELD_MAX[f.type]) errors[key] = { code: 'tooLong', max: FIELD_MAX[f.type] }
    else if (f.type === 'email' && !EMAIL.test(text)) errors[key] = { code: 'email' }
    else if (f.type === 'phone' && !PHONE.test(text)) errors[key] = { code: 'phone' }
    else if (f.type === 'select' && !(f.options ?? []).includes(text)) errors[key] = { code: 'choose' }
  }

  if (len(values.message.trim()) > MESSAGE_MAX) errors.message = { code: 'tooLong', max: MESSAGE_MAX }
  return errors
}

/**
 * The POST body. Only what the form asks for is sent: contact the config does not
 * collect is omitted, not-attending replies send partySize 0 and no sessions.
 */
export function toSubmission(values: RsvpFormValues, config: RsvpFormConfig, guestLabel?: string): PublicRsvpSubmission {
  const attending = values.attendance === 'attending'
  const body: PublicRsvpSubmission = {
    name: values.name.trim(),
    attendance: attending ? 'attending' : 'not_attending',
    partySize: attending ? values.partySize : 0,
    website: '',
  }
  const email = values.email.trim()
  const phone = values.phone.trim()
  if ((config.collectContact === 'email' || config.collectContact === 'email_or_phone') && email) body.email = email
  if ((config.collectContact === 'phone' || config.collectContact === 'email_or_phone') && phone) body.phone = phone
  if (attending && config.optionalSessions.length) {
    const allowed = new Set(config.optionalSessions.map((s) => s.id))
    const picked = [...new Set(values.sessionIds)].filter((id) => allowed.has(id))
    if (picked.length) body.sessionIds = picked
  }
  const answers: Record<string, string | boolean> = {}
  for (const f of config.fields) {
    const value = values.answers[f.id]
    if (f.type === 'checkbox') {
      if (value === true) answers[f.id] = true
    } else if (typeof value === 'string' && value.trim()) answers[f.id] = value.trim()
  }
  if (Object.keys(answers).length) body.answers = answers
  const message = values.message.trim()
  if (message) body.message = message
  if (guestLabel) body.guestLabel = Array.from(guestLabel).slice(0, NAME_MAX).join('')
  return body
}

export type SubmitOutcome =
  | { kind: 'closed' }
  | { kind: 'full' }
  | { kind: 'capacity' }
  | { kind: 'limit' }
  | { kind: 'fields'; errors: FieldErrors; unmapped: string[] }
  | { kind: 'rateLimited' }
  | { kind: 'network' }
  | { kind: 'linkInvalid' }
  | { kind: 'failed' }

const KNOWN_FIELDS = new Set(['name', 'attendance', 'partySize', 'email', 'phone', 'message', 'sessionIds'])

/** Map a failed POST to what the form shows. */
export function outcomeOf(error: unknown, config: RsvpFormConfig): SubmitOutcome {
  if (!(error instanceof ApiError)) return { kind: 'failed' }
  if (error.isNetworkError) return { kind: 'network' }
  if (error.status === 429) return { kind: 'rateLimited' }
  if (error.status === 404 && error.code === 'rsvp_link_invalid') return { kind: 'linkInvalid' }
  if (error.status === 409 && error.code === 'capacity_reached') return { kind: 'capacity' }
  if (error.status === 409 && error.code === 'limit_reached') return { kind: 'limit' }
  if (error.status === 422 && error.code === 'rsvp_closed') return { kind: 'closed' }
  if (error.status === 422 && error.fieldErrors.length) {
    const ids = new Set(config.fields.map((f) => f.id))
    const errors: FieldErrors = {}
    const unmapped: string[] = []
    for (const fe of error.fieldErrors) {
      const field = fe.field.replace(/^sessionIds\.\d+$/, 'sessionIds')
      const known = KNOWN_FIELDS.has(field) || (field.startsWith('answers.') && ids.has(field.slice(8)))
      if (known && !errors[field]) errors[field] = { code: 'server', message: fe.message }
      else if (!known) unmapped.push(fe.message)
    }
    return { kind: 'fields', errors, unmapped }
  }
  return { kind: 'failed' }
}

/** Today (YYYY-MM-DD) in an IANA time zone; falls back to the device's zone. */
export function todayIn(timezone: string | undefined, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return todayIn(undefined, now)
  }
}

/** Replies are accepted through the whole deadline day, in the invitation's time zone. */
export function isPastDeadline(deadline: string | undefined, timezone: string | undefined, now: Date = new Date()): boolean {
  return !!deadline && todayIn(timezone, now) > deadline
}

// --- Device storage: a "you already replied" flag and the private edit token --------
// Nothing the guest typed is stored. The token is the guest's own key to THEIR reply:
// it is sent in a request header (never a URL) and offered as a personal link whose
// token sits in the URL fragment (`#rsvp=…`), which browsers never send to servers.

const repliedKey = (slug: string) => `temuvibe.rsvp.replied.${slug}`

export function hasReplied(slug: string): boolean {
  try {
    return localStorage.getItem(repliedKey(slug)) === '1'
  } catch {
    return false
  }
}

export function markReplied(slug: string): void {
  try {
    localStorage.setItem(repliedKey(slug), '1')
  } catch {
    // Storage unavailable (private mode): the flag is a convenience only.
  }
}

const tokenKey = (slug: string) => `temuvibe.rsvp.token.${slug}`
const TOKEN_RE = /^[A-Za-z0-9_-]{32,100}$/

export function storedEditToken(slug: string): string | null {
  try {
    const token = localStorage.getItem(tokenKey(slug))
    return token && TOKEN_RE.test(token) ? token : null
  } catch {
    return null
  }
}

export function storeEditToken(slug: string, token: string | null): void {
  try {
    if (token && TOKEN_RE.test(token)) localStorage.setItem(tokenKey(slug), token)
    else localStorage.removeItem(tokenKey(slug))
  } catch {
    // Storage unavailable: the guest still has the personal link.
  }
}

/** Parameters in the URL fragment (`#to=Budi&rsvp=…`). */
export function fragmentParams(hash: string = typeof location === 'undefined' ? '' : location.hash): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ''))
}

/**
 * Take an edit token from the URL fragment (a personal link), keep it on the device and
 * remove it from the address bar (so it is not shared by copying the URL or kept in history).
 */
export function takeTokenFromFragment(slug: string): string | null {
  if (typeof location === 'undefined') return null
  const params = fragmentParams()
  const token = params.get('rsvp')
  if (!token) return null
  params.delete('rsvp')
  const rest = params.toString()
  try {
    history.replaceState(history.state, '', `${location.pathname}${location.search}${rest ? `#${rest}` : ''}`)
  } catch {
    // Non-browser environments.
  }
  if (!TOKEN_RE.test(token)) return null
  storeEditToken(slug, token)
  return token
}

/** The guest's personal link for changing their reply (token in the fragment). */
export function editLink(slug: string, token: string, origin: string = typeof location === 'undefined' ? '' : location.origin): string {
  return `${origin}/i/${encodeURIComponent(slug)}#rsvp=${token}`
}

/** Form values from the guest's saved reply (for "Change my reply"). */
export function valuesFromReply(config: RsvpFormConfig, reply: {
  name: string; attendance: 'attending' | 'not_attending'; partySize: number; email?: string; phone?: string;
  sessionIds?: string[]; answers?: Record<string, string | boolean>; message?: string
}): RsvpFormValues {
  const base = initialValues(config)
  const answers: Record<string, string | boolean> = { ...base.answers }
  for (const f of config.fields) {
    const v = reply.answers?.[f.id]
    if (v !== undefined) answers[f.id] = f.type === 'checkbox' ? v === true : typeof v === 'string' ? v : ''
  }
  return {
    ...base,
    name: reply.name,
    attendance: reply.attendance,
    partySize: reply.attendance === 'attending' ? Math.min(Math.max(reply.partySize, 1), config.partyLimit) : 1,
    email: reply.email ?? '',
    phone: reply.phone ?? '',
    sessionIds: (reply.sessionIds ?? []).filter((id) => config.optionalSessions.some((s) => s.id === id)),
    answers,
    message: reply.message ?? '',
  }
}
