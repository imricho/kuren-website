/**
 * Form state for the CMS v2.0 (universal) sections. Same conventions as forms.ts:
 * inputs bind to strings ('' = not set) and `*Payload` builds the object for
 * `PUT /sections/{id}`, which REPLACES the whole section (so every payload is
 * the complete section, including values kept while a switch is off).
 *
 * Text is trimmed only at the ends; nothing inside a value (line breaks,
 * spacing, sacred text) is ever changed.
 */
import type { OpeningDraft } from '@/features/wedding/draft'
import type {
  AmplopDigitalSection,
  CountdownSection,
  GreetingSection,
  HolyReciteSection,
  WishesSection,
} from '@/features/wedding/types'

import { clean, imageForm, opt, s, type ImageForm } from './forms'

// --- Holy Recite ---------------------------------------------------------------------
export interface HolyReciteForm {
  enabled: boolean
  title: string
  tradition: string
  book: string
  reference: string
  originalScript: string
  originalLanguage: string
  passage: string
  translation: string
  translationLanguage: string
  attribution: string
}
export const holyReciteForm = (h: HolyReciteSection | undefined): HolyReciteForm => ({
  enabled: h?.enabled === true,
  title: s(h?.title),
  tradition: s(h?.tradition),
  book: s(h?.book),
  reference: s(h?.reference),
  originalScript: s(h?.originalScript),
  originalLanguage: s(h?.originalLanguage),
  passage: s(h?.passage),
  translation: s(h?.translation),
  translationLanguage: s(h?.translationLanguage),
  attribution: s(h?.attribution),
})
export const holyRecitePayload = (f: HolyReciteForm): HolyReciteSection =>
  clean({
    enabled: f.enabled,
    title: opt(f.title),
    tradition: opt(f.tradition),
    book: opt(f.book),
    reference: opt(f.reference),
    passage: opt(f.passage),
    originalScript: opt(f.originalScript),
    originalLanguage: opt(f.originalLanguage),
    translation: opt(f.translation),
    translationLanguage: opt(f.translationLanguage),
    attribution: opt(f.attribution),
  })

// --- Greeting & Introduction -------------------------------------------------------------
export interface GreetingForm {
  enabled: boolean
  title: string
  message: string
  prayer: string
}
/**
 * With no greeting stored yet, start from the legacy Opening headline and
 * introduction (switched off — the couple decides to show it).
 */
export function greetingForm(g: GreetingSection | undefined, opening: OpeningDraft): GreetingForm {
  if (!g) return { enabled: false, title: s(opening.headline), message: s(opening.introduction), prayer: '' }
  return { enabled: g.enabled === true, title: s(g.title), message: s(g.message), prayer: s(g.prayer) }
}
export const greetingPayload = (f: GreetingForm): GreetingSection =>
  clean({ enabled: f.enabled, title: opt(f.title), message: opt(f.message), prayer: opt(f.prayer) })

// --- Countdown (the date itself is opening.weddingDate) ------------------------------------
export interface CountdownForm {
  enabled: boolean
  addToCalendar: boolean
}
export const countdownForm = (c: CountdownSection | undefined): CountdownForm => ({
  enabled: c?.enabled === true,
  addToCalendar: c?.addToCalendar === true,
})
export const countdownPayload = (f: CountdownForm): CountdownSection => ({ enabled: f.enabled, addToCalendar: f.addToCalendar })

// --- Wishes & Prayers ------------------------------------------------------------------
export interface WishesForm {
  enabled: boolean
  title: string
  introduction: string
}
export const wishesForm = (w: WishesSection | undefined): WishesForm => ({
  enabled: w?.enabled === true,
  title: s(w?.title),
  introduction: s(w?.introduction),
})
export const wishesPayload = (f: WishesForm): WishesSection =>
  clean({ enabled: f.enabled, title: opt(f.title), introduction: opt(f.introduction) })

// --- Amplop Digital ------------------------------------------------------------------------
export const MAX_BANK_ACCOUNTS = 20

export interface BankAccountForm {
  /** Client id (stable across saves; [A-Za-z0-9_-]). */
  id: string
  bankName: string
  accountHolder: string
  /** Always a string: leading zeros are part of the number. */
  accountNumber: string
}
export interface AmplopForm {
  enabled: boolean
  title: string
  message: string
  bankAccountsEnabled: boolean
  bankAccounts: BankAccountForm[]
  qrisEnabled: boolean
  qrisImage: ImageForm
  /** Visible "Recipient / merchant name"; stored as `qrisImage.alt` = "QRIS {name}". */
  qrisName: string
  physicalEnabled: boolean
  recipient: string
  address: string
  phone: string
  note: string
}

/** A new client id for a bank account row (uuid; safe characters only). */
export function newRowId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

export const QRIS_ALT_PREFIX = 'QRIS'
export function qrisAlt(name: string): string {
  const n = name.trim()
  return n ? `${QRIS_ALT_PREFIX} ${n}` : QRIS_ALT_PREFIX
}
function qrisNameFromAlt(alt: string | undefined): string {
  const a = s(alt).trim()
  if (a === QRIS_ALT_PREFIX) return ''
  return a.startsWith(`${QRIS_ALT_PREFIX} `) ? a.slice(QRIS_ALT_PREFIX.length + 1) : a
}

export function amplopForm(a: AmplopDigitalSection | undefined): AmplopForm {
  const p = a?.physicalGifts
  return {
    enabled: a?.enabled === true,
    title: s(a?.title),
    message: s(a?.message),
    // First time on: bank transfer is the usual way, so it starts on.
    bankAccountsEnabled: a ? a.bankAccountsEnabled === true : true,
    bankAccounts: (a?.bankAccounts ?? []).map((b) => ({
      id: b.id && SAFE_ID.test(b.id) ? b.id : newRowId(),
      bankName: s(b.bankName),
      accountHolder: s(b.accountHolder),
      accountNumber: s(b.accountNumber),
    })),
    qrisEnabled: a?.qrisEnabled === true,
    qrisImage: imageForm(a?.qrisImage),
    qrisName: qrisNameFromAlt(a?.qrisImage?.alt),
    physicalEnabled: p?.enabled === true,
    recipient: s(p?.recipient),
    address: s(p?.address),
    phone: s(p?.phone),
    note: s(p?.note),
  }
}

export const isEmptyBankRow = (b: BankAccountForm) => !b.bankName.trim() && !b.accountHolder.trim() && !b.accountNumber.trim()

export function amplopPayload(f: AmplopForm): AmplopDigitalSection {
  const src = opt(f.qrisImage.src)
  const physical = clean({
    enabled: f.physicalEnabled,
    recipient: opt(f.recipient),
    address: opt(f.address),
    phone: opt(f.phone),
    note: opt(f.note),
  })
  return clean({
    enabled: f.enabled,
    title: opt(f.title),
    message: opt(f.message),
    bankAccountsEnabled: f.bankAccountsEnabled,
    // Fully empty rows are dropped; half-filled rows stay (validation holds the save).
    bankAccounts: f.bankAccounts
      .filter((b) => !isEmptyBankRow(b))
      .map((b) => ({ id: b.id, bankName: b.bankName.trim(), accountHolder: b.accountHolder.trim(), accountNumber: b.accountNumber.trim() })),
    qrisEnabled: f.qrisEnabled,
    qrisImage: src ? { src, alt: qrisAlt(f.qrisName) } : undefined,
    physicalGifts: Object.keys(physical).length > 1 || physical.enabled ? physical : undefined,
  })
}
