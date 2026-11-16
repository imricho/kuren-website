/**
 * Client-side FORMAT checks that mirror the API's validation rules
 * (docs/api/weddings.md). Empty values are always allowed (drafts may be
 * incomplete); only values that ARE set must be valid. Rules return codes;
 * `issueMessage` turns them into text in the UI language.
 */
import { useAppLocale } from '@/composables/useAppLocale'
import { isIsoDate, isTime } from '@/features/wedding/draft'
import { isSafeImageSrc } from '@/features/wedding/format'
import { isInstagramUrl } from '@/features/wedding/validation'

import type {
  ClosingForm,
  CoupleForm,
  EventForm,
  GalleryItemForm,
  GalleryMetaForm,
  ImageForm,
  OpeningForm,
  PersonForm,
  RsvpForm,
  StoryEntryForm,
  StoryMetaForm,
} from './forms'
import { isEmptyBankRow, type AmplopForm, type GreetingForm, type HolyReciteForm, type WishesForm } from './universalForms'

export type IssueCode =
  | 'tooLong'
  | 'invalidDate'
  | 'invalidTime'
  | 'endBeforeStart'
  | 'invalidUrl'
  | 'invalidInstagram'
  | 'invalidImage'
  | 'altRequired'
  | 'guestRange'
  | 'focalRange'
  | 'srcRequired'
  | 'invalidAccountNumber'
  | 'incompleteAccount'
  | 'invalidPhone'
  | 'httpsOnly'

export interface FieldIssue {
  field: string
  code: IssueCode
  max?: number
}

export const LIMITS = {
  title: 120,
  nickname: 40,
  short: 200,
  long: 2000,
  storyDate: 60,
  venueName: 160,
  address: 500,
  confirmationMessage: 500,
  url: 2048,
  alt: 300,
  reference: 200,
  attribution: 200,
  tradition: 120,
  translationLanguage: 35,
  originalLanguage: 35,
  bankField: 120,
  accountNumber: 40,
  phone: 30,
  giftNote: 500,
} as const

/** Digits with single spaces/hyphens between groups (mirrors the API; leading zeros allowed). */
export const ACCOUNT_NUMBER_PATTERN = /^[0-9]+([ -][0-9]+)*$/
/** Optional leading +, then digits with single spaces/hyphens. */
export const PHONE_PATTERN = /^\+?[0-9]+([ -][0-9]+)*$/

export function isHttpsUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false
  return new URL(value).protocol === 'https:'
}

/** Image src the API accepts: http(s) URL ≤2048, or a sample photo path under /sample-wedding/. */
export function isAcceptedImageSrc(value: string): boolean {
  const v = value.trim()
  if (v === '') return true
  return v.length <= LIMITS.url && isSafeImageSrc(v)
}

export function isHttpUrl(value: string): boolean {
  if (value.length > LIMITS.url) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname
  } catch {
    return false
  }
}

class Checker {
  issues: FieldIssue[] = []
  constructor(private prefix = '') {}
  private path(field: string) {
    return this.prefix ? `${this.prefix}.${field}` : field
  }
  max(field: string, value: string, max: number) {
    if (value.trim().length > max) this.issues.push({ field: this.path(field), code: 'tooLong', max })
  }
  date(field: string, value: string) {
    if (value.trim() !== '' && !isIsoDate(value.trim())) this.issues.push({ field: this.path(field), code: 'invalidDate' })
  }
  time(field: string, value: string) {
    if (value.trim() !== '' && !isTime(value.trim())) this.issues.push({ field: this.path(field), code: 'invalidTime' })
  }
  url(field: string, value: string) {
    if (value.trim() !== '' && !isHttpUrl(value.trim())) this.issues.push({ field: this.path(field), code: 'invalidUrl' })
  }
  https(field: string, value: string) {
    if (value.trim() !== '' && !isHttpsUrl(value.trim())) this.issues.push({ field: this.path(field), code: 'httpsOnly' })
  }
  pattern(field: string, value: string, re: RegExp, code: IssueCode) {
    if (value.trim() !== '' && !re.test(value.trim())) this.issues.push({ field: this.path(field), code })
  }
  instagram(field: string, value: string) {
    if (value.trim() !== '' && !isInstagramUrl(value.trim()))
      this.issues.push({ field: this.path(field), code: 'invalidInstagram' })
  }
  image(field: string, image: ImageForm) {
    if (image.src.trim() === '') return
    if (!isAcceptedImageSrc(image.src)) this.issues.push({ field: this.path(`${field}.src`), code: 'invalidImage' })
    if (image.alt.trim() === '') this.issues.push({ field: this.path(`${field}.alt`), code: 'altRequired' })
    else this.max(`${field}.alt`, image.alt, LIMITS.alt)
    const fp = image.focalPoint
    if (fp && ![fp.x, fp.y].every((n) => Number.isInteger(n) && n >= 0 && n <= 100))
      this.issues.push({ field: this.path(`${field}.focalPoint`), code: 'focalRange' })
  }
}

export function validateOpening(f: OpeningForm): FieldIssue[] {
  const c = new Checker()
  c.max('couple.groom.name', f.groomName, LIMITS.title)
  c.max('couple.bride.name', f.brideName, LIMITS.title)
  c.max('weddingTitle', f.weddingTitle, LIMITS.title)
  c.max('coupleNames', f.coupleNames, LIMITS.title)
  c.max('headline', f.headline, LIMITS.short)
  c.max('introduction', f.introduction, LIMITS.long)
  c.date('weddingDate', f.weddingDate)
  c.image('coverImage', f.coverImage)
  c.max('guestGreeting.label', f.guestGreetingLabel, LIMITS.title)
  return c.issues
}

function person(c: Checker, role: 'groom' | 'bride', p: PersonForm) {
  c.max(`${role}.name`, p.name, LIMITS.title)
  c.max(`${role}.nickname`, p.nickname, LIMITS.nickname)
  c.max(`${role}.description`, p.description, LIMITS.long)
  c.max(`${role}.parents`, p.parents, LIMITS.short)
  c.instagram(`${role}.instagramUrl`, p.instagramUrl)
  c.image(`${role}.image`, p.image)
}
export function validateCouple(f: CoupleForm): FieldIssue[] {
  const c = new Checker()
  person(c, 'groom', f.groom)
  person(c, 'bride', f.bride)
  return c.issues
}

export function validateStoryMeta(f: StoryMetaForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('introduction', f.introduction, LIMITS.long)
  return c.issues
}

export function validateStoryEntry(f: StoryEntryForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('date', f.date, LIMITS.storyDate)
  c.max('description', f.description, LIMITS.long)
  c.image('image', f.image)
  return c.issues
}

export function validateEvent(f: EventForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.date('date', f.date)
  c.time('startTime', f.startTime)
  c.time('endTime', f.endTime)
  if (isTime(f.startTime.trim()) && isTime(f.endTime.trim()) && f.endTime.trim() <= f.startTime.trim())
    c.issues.push({ field: 'endTime', code: 'endBeforeStart' })
  c.max('venueName', f.venueName, LIMITS.venueName)
  c.max('address', f.address, LIMITS.address)
  c.url('mapsUrl', f.mapsUrl)
  c.max('description', f.description, LIMITS.long)
  c.max('dressCode.text', f.dressCodeText, LIMITS.short)
  c.https('livestream.url', f.livestreamUrl)
  c.max('livestream.label', f.livestreamLabel, LIMITS.title)
  return c.issues
}

export function validateGalleryMeta(f: GalleryMetaForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('description', f.description, LIMITS.long)
  return c.issues
}

export function validateGalleryItem(f: GalleryItemForm): FieldIssue[] {
  const c = new Checker()
  // A gallery item IS an image: src and alt sit at the top level of the item, and src is required.
  if (f.image.src.trim() === '') c.issues.push({ field: 'src', code: 'srcRequired' })
  else if (!isAcceptedImageSrc(f.image.src)) c.issues.push({ field: 'src', code: 'invalidImage' })
  if (f.image.src.trim() !== '' && f.image.alt.trim() === '') c.issues.push({ field: 'alt', code: 'altRequired' })
  c.max('alt', f.image.alt, LIMITS.alt)
  c.max('caption', f.caption, LIMITS.short)
  const fp = f.image.focalPoint
  if (fp && ![fp.x, fp.y].every((n) => Number.isInteger(n) && n >= 0 && n <= 100))
    c.issues.push({ field: 'focalPoint', code: 'focalRange' })
  return c.issues
}

export function validateRsvp(f: RsvpForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('introduction', f.introduction, LIMITS.long)
  c.date('deadline', f.deadline)
  c.max('confirmationMessage', f.confirmationMessage, LIMITS.confirmationMessage)
  const max = String(f.maxGuestsPerResponse).trim()
  if (max !== '' && !(/^\d+$/.test(max) && Number(max) >= 1 && Number(max) <= 20))
    c.issues.push({ field: 'maxGuestsPerResponse', code: 'guestRange' })
  return c.issues
}

export function validateClosing(f: ClosingForm): FieldIssue[] {
  const c = new Checker()
  c.max('message', f.message, LIMITS.long)
  c.max('thankYou', f.thankYou, LIMITS.short)
  c.image('image', f.image)
  c.max('familyAcknowledgments', f.familyAcknowledgments, LIMITS.long)
  return c.issues
}

export function validateHolyRecite(f: HolyReciteForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('tradition', f.tradition, LIMITS.tradition)
  c.max('book', f.book, LIMITS.tradition)
  c.max('reference', f.reference, LIMITS.reference)
  c.max('originalScript', f.originalScript, LIMITS.long)
  c.max('passage', f.passage, LIMITS.long)
  c.max('translation', f.translation, LIMITS.long)
  c.max('translationLanguage', f.translationLanguage, LIMITS.translationLanguage)
  c.max('originalLanguage', f.originalLanguage, LIMITS.originalLanguage)
  c.max('attribution', f.attribution, LIMITS.attribution)
  return c.issues
}

export function validateGreeting(f: GreetingForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('message', f.message, LIMITS.long)
  c.max('prayer', f.prayer, LIMITS.long)
  return c.issues
}

export function validateWishes(f: WishesForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('introduction', f.introduction, LIMITS.long)
  return c.issues
}

export function validateWeddingDate(f: { weddingDate: string }): FieldIssue[] {
  const c = new Checker()
  c.date('weddingDate', f.weddingDate)
  return c.issues
}

export function validateAmplop(f: AmplopForm): FieldIssue[] {
  const c = new Checker()
  c.max('title', f.title, LIMITS.title)
  c.max('message', f.message, LIMITS.long)
  f.bankAccounts.forEach((b, i) => {
    if (isEmptyBankRow(b)) return // dropped on save
    const p = `bankAccounts.${i}`
    for (const field of ['bankName', 'accountHolder', 'accountNumber'] as const)
      if (b[field].trim() === '') c.issues.push({ field: `${p}.${field}`, code: 'incompleteAccount' })
    c.max(`${p}.bankName`, b.bankName, LIMITS.bankField)
    c.max(`${p}.accountHolder`, b.accountHolder, LIMITS.bankField)
    c.max(`${p}.accountNumber`, b.accountNumber, LIMITS.accountNumber)
    c.pattern(`${p}.accountNumber`, b.accountNumber, ACCOUNT_NUMBER_PATTERN, 'invalidAccountNumber')
  })
  if (f.qrisImage.src.trim() !== '' && !isAcceptedImageSrc(f.qrisImage.src))
    c.issues.push({ field: 'qrisImage.src', code: 'invalidImage' })
  c.max('qrisName', f.qrisName, LIMITS.alt - 5)
  c.max('recipient', f.recipient, LIMITS.title)
  c.max('address', f.address, LIMITS.address)
  c.max('note', f.note, LIMITS.giftNote)
  c.max('phone', f.phone, LIMITS.phone)
  c.pattern('phone', f.phone, PHONE_PATTERN, 'invalidPhone')
  return c.issues
}

export function issueMessage(issue: FieldIssue): string {
  const { t } = useAppLocale()
  switch (issue.code) {
    case 'tooLong':
      return t('errTooLong', { max: issue.max ?? 0 })
    case 'invalidDate':
      return t('errInvalidDate')
    case 'invalidTime':
      return t('errInvalidTime')
    case 'endBeforeStart':
      return t('errEndBeforeStart')
    case 'invalidUrl':
      return t('errInvalidUrl')
    case 'invalidInstagram':
      return t('errInvalidInstagram')
    case 'invalidImage':
      return t('errInvalidImage')
    case 'altRequired':
      return t('errAltRequired')
    case 'guestRange':
      return t('errGuestRange')
    case 'focalRange':
      return t('errFocalRange')
    case 'srcRequired':
      return t('errSrcRequired')
    case 'invalidAccountNumber':
      return t('errAccountNumber')
    case 'incompleteAccount':
      return t('errIncompleteAccount')
    case 'invalidPhone':
      return t('errPhone')
    case 'httpsOnly':
      return t('errHttpsUrl')
  }
}

/** Stable DOM id for a field path, so error summaries can link to it. */
export function fieldId(path: string, scope = 'f'): string {
  return `${scope}-${path.replace(/[^A-Za-z0-9]+/g, '-')}`
}
