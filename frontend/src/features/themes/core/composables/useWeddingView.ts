import { computed } from 'vue'

import { dateParts, eventTypeLabel, formatDate, formatTimeRange, labels, mapsLink } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import { greetingHasContent } from '../visibility'

/**
 * Display-ready values derived from the shared content model, so themes
 * don't each re-implement formatting. Pure data — no markup or styling.
 *
 * Empty optional sections (no story entries, no gallery images) come back as
 * `undefined`, so themes simply `v-if` them away.
 */
export function useWeddingView(props: { content: WeddingContent }) {
  return computed(() => {
    const c = props.content
    const locale = c.locale ?? 'en'
    return {
      // Absent greeting (legacy content) falls back to the opening headline/introduction.
      // Enabled but empty → undefined, so themes render no orphan heading/ornament.
      greeting: c.greeting
        ? (greetingHasContent(c.greeting) ? c.greeting : undefined)
        : (c.opening.headline || c.opening.introduction ? { enabled: true, title: c.opening.headline, message: c.opening.introduction } : undefined),
      locale,
      t: labels(locale),
      date: {
        full: formatDate(c.opening.weddingDate, locale, 'full'),
        long: formatDate(c.opening.weddingDate, locale, 'long'),
        short: formatDate(c.opening.weddingDate, locale, 'short'),
        parts: dateParts(c.opening.weddingDate, locale),
      },
      events: c.events.map((event) => {
        const online = event.format === 'online'
        const multiDay = !!event.endDate && event.endDate > event.date
        return {
          ...event,
          // Online-only: no venue, so themes show "Online" where the venue goes and no map.
          venueName: online && !event.venueName ? (locale === 'id' ? 'Daring (online)' : 'Online') : event.venueName,
          typeLabel: eventTypeLabel(event.type, locale),
          dateText: multiDay
            ? `${formatDate(event.date, locale, 'full')} – ${formatDate(event.endDate!, locale, 'full')}`
            : formatDate(event.date, locale, 'full'),
          dateParts: dateParts(event.date, locale),
          timeText: formatTimeRange(event.startTime, event.endTime, locale),
          mapHref: online || !(event.venueName || event.address) ? '' : mapsLink(event),
        }
      }),
      story: c.story && c.story.enabled !== false && c.story.timeline.length > 0 ? c.story : undefined,
      gallery: c.gallery && c.gallery.enabled !== false && c.gallery.images.length > 0 ? c.gallery : undefined,
    }
  })
}
