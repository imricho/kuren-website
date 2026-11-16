/**
 * The editor's sections, in order (theme first, then the canonical public order),
 * and the five navigation groups the editor shows them in. Theme selection lives
 * in the theme studio (/themes) and is linked, not duplicated.
 */
import type { RouteLocationRaw } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'
import type { WeddingDraft } from '@/features/wedding/draft'
import { MANDATORY_WEDDING_SECTIONS, type WeddingSectionId } from '@/features/wedding/types'

export interface EditorSection {
  key: SectionKey
  label: AppMessageKey
  /** Route name of the editor page (theme → the studio). */
  routeName: string
  to: RouteLocationRaw
}

const section = (key: SectionKey, label: AppMessageKey, routeName: string): EditorSection => ({
  key,
  label,
  routeName,
  to: { name: routeName },
})

export const EDITOR_SECTIONS: readonly EditorSection[] = [
  section('theme', 'sectionTheme', 'themes'),
  section('opening', 'sectionOpening', 'wedding-opening'),
  section('holyRecite1', 'sectionHolyRecite1', 'wedding-holy-recite-1'),
  section('greeting', 'sectionGreeting', 'wedding-greeting'),
  section('couple', 'sectionCouple', 'wedding-couple'),
  section('weddingDate', 'sectionWeddingDate', 'wedding-date'),
  section('events', 'sectionEvents', 'wedding-events'),
  section('story', 'sectionStory', 'wedding-story'),
  section('gallery', 'sectionGallery', 'wedding-gallery'),
  section('rsvp', 'sectionRsvp', 'wedding-rsvp'),
  section('wishes', 'sectionWishes', 'wedding-wishes'),
  section('amplopDigital', 'sectionAmplopDigital', 'wedding-gifts'),
  section('holyRecite2', 'sectionHolyRecite2', 'wedding-holy-recite-2'),
  section('closing', 'sectionClosing', 'wedding-closing'),
]

export function sectionByKey(key: SectionKey): EditorSection {
  return EDITOR_SECTIONS.find((s) => s.key === key)!
}

// --- Navigation groups -------------------------------------------------------------

/** One entry of a navigation group: a section, the Preview & Publish page, or a non-interactive note. */
export type NavEntry =
  | { kind: 'section'; section: EditorSection }
  | { kind: 'publish'; key: 'publish'; label: AppMessageKey; routeName: string; to: RouteLocationRaw }
  | { kind: 'note'; key: string; label: AppMessageKey }

export type NavGroupKey = 'wedding' | 'events' | 'moments' | 'guests' | 'finishing'

export interface NavGroup {
  key: NavGroupKey
  /** Short tab label. */
  label: AppMessageKey
  entries: readonly NavEntry[]
}

const s = (key: SectionKey): NavEntry => ({ kind: 'section', section: sectionByKey(key) })

export const PUBLISH_ROUTE_NAME = 'wedding-publish'

export const NAV_GROUPS: readonly NavGroup[] = [
  { key: 'wedding', label: 'navGroupWedding', entries: [s('opening'), s('holyRecite1'), s('greeting'), s('couple'), s('weddingDate')] },
  { key: 'events', label: 'navGroupEvents', entries: [s('events')] },
  {
    key: 'moments',
    label: 'navGroupMoments',
    entries: [s('story'), s('gallery'), { kind: 'note', key: 'music', label: 'navMusicUnavailable' }],
  },
  { key: 'guests', label: 'navGroupGuests', entries: [s('rsvp'), s('wishes')] },
  {
    key: 'finishing',
    label: 'navGroupFinishing',
    entries: [
      s('amplopDigital'),
      s('holyRecite2'),
      s('closing'),
      { kind: 'publish', key: 'publish', label: 'sectionPublish', routeName: PUBLISH_ROUTE_NAME, to: { name: PUBLISH_ROUTE_NAME } },
    ],
  },
]

/** Navigation group of a route (section pages and the publish page), if any. */
export function navGroupByRouteName(name: unknown): NavGroup | undefined {
  return NAV_GROUPS.find((g) =>
    g.entries.some((e) => (e.kind === 'section' ? e.section.routeName === name : e.kind === 'publish' && e.routeName === name)),
  )
}

export function sectionByRouteName(name: unknown): EditorSection | undefined {
  return EDITOR_SECTIONS.find((s) => s.routeName === name)
}

/** Sections that are always on the invitation (no "Show on website" switch). */
export function isMandatorySection(key: SectionKey): boolean {
  return (MANDATORY_WEDDING_SECTIONS as readonly string[]).includes(key)
}

/** Autosave draft keys whose unsaved edits belong to a section (the date page edits two). */
export const SECTION_DRAFT_KEYS: Partial<Record<SectionKey, readonly string[]>> = {
  weddingDate: ['weddingDate', 'countdown'],
}

export type OptionalSectionId = Exclude<WeddingSectionId, 'opening' | 'couple' | 'weddingDate' | 'events' | 'closing'>

/**
 * Whether an optional section is shown on the invitation ("Show on website"),
 * read from a (live) draft. Mandatory sections and the theme return true.
 * Defaults mirror the content model: story/gallery/RSVP default on; the
 * universal v1.1 sections default off when absent.
 */
export function isSectionShown(draft: WeddingDraft | null | undefined, key: SectionKey): boolean {
  if (!draft) return true
  switch (key) {
    case 'story':
      return draft.story.enabled !== false
    case 'gallery':
      return draft.gallery.enabled !== false
    case 'rsvp':
      return draft.rsvp.enabled !== false
    case 'holyRecite1':
    case 'holyRecite2':
    case 'greeting':
    case 'wishes':
    case 'amplopDigital':
      return draft[key]?.enabled === true
    default:
      return true
  }
}
