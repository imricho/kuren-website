import { isIsoDate } from '@/features/wedding/draft'
import { parseISODate } from '@/features/wedding/format'

/** Whole calendar days from `today` to an ISO date (negative once it has passed); undefined without a valid date. */
export function daysUntil(isoDate: string | undefined, today: Date = new Date()): number | undefined {
  if (!isIsoDate(isoDate)) return undefined
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // Round so a daylight-saving shift (23/25-hour day) never changes the count.
  return Math.round((parseISODate(isoDate).getTime() - start.getTime()) / 86_400_000)
}
