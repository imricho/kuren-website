/**
 * First run: a brand-new wedding (no names, no date) is sent from the dashboard
 * to /welcome once. The "seen" flag is per user and per browser, so skipping the
 * welcome flow never brings it back.
 */
import type { WeddingDraft } from '@/features/wedding/draft'
import { isIsoDate } from '@/features/wedding/draft'

const has = (value: string | undefined) => !!value?.trim()

/** True when the couple hasn't entered any names or a wedding date yet. */
export function isFreshWedding(content: WeddingDraft | null | undefined): boolean {
  if (!content) return false
  const { groom, bride } = content.couple
  return (
    !has(groom.name) &&
    !has(groom.nickname) &&
    !has(bride.name) &&
    !has(bride.nickname) &&
    !has(content.opening.coupleNames) &&
    !isIsoDate(content.opening.weddingDate)
  )
}

const key = (userId: string) => `kuren.welcomeSeen.${userId}`

export function hasSeenWelcome(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1'
  } catch {
    // Storage unavailable: treat as seen so we never redirect on every visit.
    return true
  }
}

export function markWelcomeSeen(userId: string): void {
  try {
    localStorage.setItem(key(userId), '1')
  } catch {
    // Nothing to remember it in; hasSeenWelcome() already reports true then.
  }
}

/** Should the dashboard send this user to /welcome? */
export function shouldStartWelcome(content: WeddingDraft | null | undefined, userId: string | null | undefined): boolean {
  return !!userId && isFreshWedding(content) && !hasSeenWelcome(userId)
}

export type WelcomeStep = 1 | 2 | 3

/** Where to resume the welcome flow: an explicit ?step= wins, else the first step not done yet. */
export function resumeStep(
  query: unknown,
  content: WeddingDraft | null | undefined,
  themeId: string | null | undefined,
): WelcomeStep {
  const n = Number(Array.isArray(query) ? query[0] : query)
  if (n === 1 || n === 2 || n === 3) return n
  if (!content || isFreshWedding(content)) return 1
  return themeId ? 3 : 2
}
