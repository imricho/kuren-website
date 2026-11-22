/**
 * Editor copy that depends on the invitation's category: wedding wording for the
 * wedding category, neutral wording ("event", "sessions") for every other one.
 * `vt(key)` translates `key`, or its generic counterpart outside weddings.
 */
import { computed } from 'vue'

import { useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { isWeddingVariant } from '@/features/invitation/registry'
import { useInvitationStore } from '@/stores/invitation'

/** Wedding wording → neutral wording. */
export const GENERIC_COPY: Partial<Record<AppMessageKey, AppMessageKey>> = {
  theWedding: 'theEvent',
  weddingTitleHint: 'eventTitleHint',
  weddingDate: 'mainEventDate',
  coupleNamesLabel: 'displayNamesLabel',
  coupleNamesHint: 'displayNamesHint',
  weddingDateIntro: 'eventDateIntro',
  showCountdownHint: 'showCountdownHintGeneric',
  deadlineAfterWedding: 'deadlineAfterEvent',
  sectionEvents: 'sectionSessions',
  eventsIntro: 'sessionsIntro',
  addEvent: 'addSession',
  eventTitle: 'sessionTitle',
  eventType: 'sessionType',
  event: 'session',
  myWebsite: 'myInvitation',
}

export function useVariantCopy() {
  const store = useInvitationStore()
  const { t } = useAppLocale()
  /** True outside the wedding category (and once a variant is known). */
  const generic = computed(() => !!store.variant && !isWeddingVariant(store.variant))
  const key = (k: AppMessageKey): AppMessageKey => (generic.value ? GENERIC_COPY[k] ?? k : k)
  const vt = (k: AppMessageKey, vars?: Record<string, string | number>) => t(key(k), vars)
  return { generic, vt, key }
}
