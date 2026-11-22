import type { AgendaItem } from '@/features/invitation/types'

/** Stable run-of-show order: session order (unlinked first), then start time (untimed last), then entry order. */
export function orderAgenda(items: readonly AgendaItem[], sessionIds: readonly string[]): AgendaItem[] {
  const rank = (id?: string) => (id ? sessionIds.indexOf(id) : -1)
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.sessionId) - rank(b.item.sessionId) || (a.item.time ?? '99:99').localeCompare(b.item.time ?? '99:99') || a.index - b.index)
    .map((x) => x.item)
}
