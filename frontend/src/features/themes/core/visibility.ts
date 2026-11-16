/**
 * Whether an optional section has something to show. An enabled section with no
 * content renders NOTHING (no heading, ornament or wrapper) in every mode.
 */
import { isCompleteBankAccount, isDisplayableImageSrc } from '@/features/wedding/draft'
import type { AmplopDigitalSection, GreetingSection, HolyReciteSection } from '@/features/wedding/types'

const has = (value: string | undefined) => !!value && value.trim() !== ''

export function holyReciteHasContent(s: HolyReciteSection | undefined): boolean {
  return !!s?.enabled && (has(s.passage) || has(s.originalScript) || has(s.translation))
}

export function greetingHasContent(s: GreetingSection | undefined): boolean {
  return !!s?.enabled && (has(s.title) || has(s.message) || has(s.prayer))
}

export function visibleBankAccounts(s: AmplopDigitalSection | undefined) {
  return s?.bankAccountsEnabled ? (s.bankAccounts ?? []).filter(isCompleteBankAccount) : []
}
export function showsQris(s: AmplopDigitalSection | undefined): boolean {
  return !!s?.qrisEnabled && !!s.qrisImage && isDisplayableImageSrc(s.qrisImage.src)
}
export function showsPhysicalGifts(s: AmplopDigitalSection | undefined): boolean {
  const g = s?.physicalGifts
  return !!g?.enabled && (has(g.recipient) || has(g.address))
}
export function amplopHasContent(s: AmplopDigitalSection | undefined): boolean {
  return !!s?.enabled && (visibleBankAccounts(s).length > 0 || showsQris(s) || showsPhysicalGifts(s))
}
