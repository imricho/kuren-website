/**
 * Which sections the Temuvibe renderer shows, in canonical order (contract §5):
 * offered by the variant (`content.sections`; legacy content = the 13 wedding sections)
 * AND enabled AND non-empty. Nothing else renders — no headings without content, no gaps.
 */
import { SECTION_ORDER, type SectionId } from '@/features/invitation/registry'
import type { WeddingContent } from '@/features/wedding/types'

import { LEGACY_TEMPLATE_SECTIONS } from '../core/manifests'
import { amplopHasContent, greetingHasContent, holyReciteHasContent } from '../core/visibility'

const has = (v: string | undefined) => !!v && v.trim() !== ''

/** The legacy greeting fallback (absent greeting → opening headline/introduction), like every theme. */
export function greetingContent(c: WeddingContent): { title?: string; message?: string; prayer?: string } | undefined {
  if (c.greeting) return greetingHasContent(c.greeting) ? c.greeting : undefined
  return has(c.opening.headline) || has(c.opening.introduction) ? { title: c.opening.headline, message: c.opening.introduction } : undefined
}

export function sectionHasContent(c: WeddingContent, id: SectionId): boolean {
  switch (id) {
    case 'opening':
    case 'countdown':
    case 'closing':
      return true
    case 'holyRecite1':
    case 'holyRecite2':
      return holyReciteHasContent(c[id])
    case 'greeting':
      return greetingContent(c) !== undefined
    case 'couple':
      return c.couple?.enabled !== false && (has(c.couple?.groom?.name) || has(c.couple?.bride?.name))
    case 'profiles':
      return c.profiles?.enabled === true && (c.profiles.people?.length ?? 0) > 0
    case 'organization': {
      const o = c.organization
      return o?.enabled === true && (has(o.name) || has(o.tagline) || has(o.description) || !!o.logo)
    }
    case 'milestone': {
      const m = c.milestone
      return (
        m?.enabled === true &&
        (m.age !== undefined || m.years !== undefined || has(m.occasion) || has(m.institution) || has(m.program) || has(m.degree) || has(m.partyTheme) || has(m.description))
      )
    }
    case 'events':
      return c.events.length > 0
    case 'agenda':
      return c.agenda?.enabled === true && (c.agenda.items?.length ?? 0) > 0
    case 'speakers':
      return c.speakers?.enabled === true && (c.speakers.people?.length ?? 0) > 0
    case 'story':
      return !!c.story && c.story.enabled !== false && c.story.timeline.length > 0
    case 'gallery':
      return !!c.gallery && c.gallery.enabled !== false && c.gallery.images.length > 0
    case 'rsvp':
      return c.rsvp.enabled === true
    case 'wishes':
      return c.wishes?.enabled === true
    case 'amplopDigital':
      return amplopHasContent(c.amplopDigital)
  }
}

export function offeredSections(c: WeddingContent): readonly SectionId[] {
  return c.sections ?? LEGACY_TEMPLATE_SECTIONS
}

export function visibleSections(c: WeddingContent): SectionId[] {
  const offered = new Set(offeredSections(c))
  return SECTION_ORDER.filter((id) => offered.has(id) && sectionHasContent(c, id))
}

/** Editor scroll key (`data-section`) of a section: the date section keeps its editor name. */
export const sectionAnchor = (id: SectionId): string => (id === 'countdown' ? 'weddingDate' : id)
