/**
 * The dashboard's single "next step": the first required section that isn't
 * complete (editor order), or a preview of the website once everything is done.
 */
import type { RouteLocationRaw } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import { sectionByKey } from '@/features/cms/sections'
import { firstIncompleteSection, type Completeness, type SectionKey } from '@/features/wedding/completeness'

export interface NextStep {
  /** Section to work on, or 'preview' when every required section is complete. */
  key: SectionKey | 'preview'
  action: AppMessageKey
  hint: AppMessageKey
  to: RouteLocationRaw
}

const COPY: Partial<Record<SectionKey, [AppMessageKey, AppMessageKey]>> = {
  theme: ['nextThemeAction', 'nextThemeHint'],
  opening: ['nextOpeningAction', 'nextOpeningHint'],
  couple: ['nextCoupleAction', 'nextCoupleHint'],
  events: ['nextEventsAction', 'nextEventsHint'],
  // The wedding date is shared with Opening, so its next-step copy is Opening's.
  weddingDate: ['nextOpeningAction', 'nextOpeningHint'],
  rsvp: ['nextRsvpAction', 'nextRsvpHint'],
  closing: ['nextClosingAction', 'nextClosingHint'],
}

export const PREVIEW_ROUTE: RouteLocationRaw = { name: 'wedding-preview', query: { from: '/dashboard' } }

export function nextStep(completeness: Completeness): NextStep {
  const key = firstIncompleteSection(completeness)
  const copy = key ? COPY[key] : undefined
  if (!key || !copy) return { key: 'preview', action: 'nextDoneAction', hint: 'nextDoneHint', to: PREVIEW_ROUTE }
  return { key, action: copy[0], hint: copy[1], to: sectionByKey(key).to }
}
