/**
 * The editor's sections, in order (theme first, then the canonical public order),
 * and the navigation groups the editor shows them in. Which sections exist depends
 * on the invitation's variant (`sectionsFor(variant)` in the invitation registry);
 * wedding variants get exactly the original five groups and chips. Theme selection
 * lives in the theme studio (/themes) and is linked, not duplicated.
 *
 * Section links are `{ name }` only: inside the editor and preview routes the
 * current `:id` param is reused.
 */
import type { RouteLocationRaw } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import { isSectionRequired, isWeddingVariant, type VariantId } from '@/features/invitation/registry'
import { isKeyOffered, registrySectionId, type SectionKey } from '@/features/wedding/completeness'
import type { WeddingDraft } from '@/features/wedding/draft'
import { MANDATORY_WEDDING_SECTIONS, type WeddingSectionId } from '@/features/wedding/types'

import { editorRouteName } from './editorRoutes'

export interface EditorSection {
  key: SectionKey
  label: AppMessageKey
  /** Route name of the editor page (theme → the studio). */
  routeName: string
  to: RouteLocationRaw
}

const section = (key: SectionKey, label: AppMessageKey): EditorSection => {
  const routeName = key === 'theme' ? 'themes' : editorRouteName(key)
  return { key, label, routeName, to: { name: routeName } }
}

/** Every editor section (all variants), in editor order. */
export const EDITOR_SECTIONS: readonly EditorSection[] = [
  section('theme', 'sectionTheme'),
  section('opening', 'sectionOpening'),
  section('holyRecite1', 'sectionHolyRecite1'),
  section('greeting', 'sectionGreeting'),
  section('couple', 'sectionCouple'),
  section('profiles', 'sectionProfiles'),
  section('organization', 'sectionOrganization'),
  section('milestone', 'sectionMilestone'),
  section('weddingDate', 'sectionWeddingDate'),
  section('events', 'sectionEvents'),
  section('agenda', 'sectionAgenda'),
  section('speakers', 'sectionSpeakers'),
  section('story', 'sectionStory'),
  section('gallery', 'sectionGallery'),
  section('rsvp', 'sectionRsvp'),
  section('wishes', 'sectionWishes'),
  section('amplopDigital', 'sectionAmplopDigital'),
  section('holyRecite2', 'sectionHolyRecite2'),
  section('closing', 'sectionClosing'),
]

/** Labels that differ outside the wedding category. */
const NON_WEDDING_LABELS: Partial<Record<SectionKey, AppMessageKey>> = { weddingDate: 'sectionEventDate', events: 'sectionSessions' }

/**
 * Sections the editor offers for a variant (theme first), with variant-specific
 * labels. No variant = the legacy wedding set.
 */
export function editorSectionsFor(variant?: VariantId | null): EditorSection[] {
  const wedding = !variant || isWeddingVariant(variant)
  return EDITOR_SECTIONS.filter((s) => isKeyOffered(s.key, variant)).map((s) =>
    !wedding && NON_WEDDING_LABELS[s.key] ? { ...s, label: NON_WEDDING_LABELS[s.key]! } : s,
  )
}

export function sectionByKey(key: SectionKey, variant?: VariantId | null): EditorSection {
  return editorSectionsFor(variant).find((s) => s.key === key) ?? EDITOR_SECTIONS.find((s) => s.key === key)!
}

// --- Navigation groups -------------------------------------------------------------

/** One entry of a navigation group: a section, the Preview & Publish page, or a non-interactive note. */
export type NavEntry =
  | { kind: 'section'; section: EditorSection }
  | { kind: 'page'; key: 'publish' | 'settings'; label: AppMessageKey; routeName: string; to: RouteLocationRaw }
  | { kind: 'note'; key: string; label: AppMessageKey }

export type NavGroupKey = 'wedding' | 'events' | 'moments' | 'guests' | 'finishing'

export interface NavGroup {
  key: NavGroupKey
  /** Short tab label. */
  label: AppMessageKey
  /** Full group name (tab title, vertical outline heading). */
  fullLabel: AppMessageKey
  entries: readonly NavEntry[]
}

export const PUBLISH_ROUTE_NAME = editorRouteName('publish')
export const SETTINGS_ROUTE_NAME = editorRouteName('settings')
const PAGE_ENTRY = {
  publish: { label: 'sectionPublish', routeName: PUBLISH_ROUTE_NAME },
  settings: { label: 'invitationSettings', routeName: SETTINGS_ROUTE_NAME },
} as const satisfies Record<string, { label: AppMessageKey; routeName: string }>

type Slot = SectionKey | { note: string; label: AppMessageKey } | 'publish' | 'settings'
interface GroupLayout {
  key: NavGroupKey
  label: AppMessageKey
  fullLabel: AppMessageKey
  slots: readonly Slot[]
}

/** Every possible entry per group, in canonical order; variants show the subset they offer. */
const GROUP_LAYOUT: readonly GroupLayout[] = [
  {
    key: 'wedding',
    label: 'navGroupWedding',
    fullLabel: 'navGroupWeddingFull',
    slots: ['opening', 'holyRecite1', 'greeting', 'couple', 'profiles', 'organization', 'milestone', 'weddingDate'],
  },
  { key: 'events', label: 'navGroupEvents', fullLabel: 'navGroupEventsFull', slots: ['events', 'agenda', 'speakers'] },
  {
    key: 'moments',
    label: 'navGroupMoments',
    fullLabel: 'navGroupMomentsFull',
    slots: ['story', 'gallery', { note: 'music', label: 'navMusicUnavailable' }],
  },
  { key: 'guests', label: 'navGroupGuests', fullLabel: 'navGroupGuestsFull', slots: ['rsvp', 'wishes'] },
  { key: 'finishing', label: 'navGroupFinishing', fullLabel: 'navGroupFinishingFull', slots: ['amplopDigital', 'holyRecite2', 'closing', 'settings', 'publish'] },
]

/**
 * Navigation groups for a variant. Groups with no offered section are dropped (a
 * note alone does not keep a group). Wedding variants (and no variant) get the
 * original five groups with the original chips.
 */
export function navGroupsFor(variant?: VariantId | null): NavGroup[] {
  const sections = editorSectionsFor(variant)
  const wedding = !variant || isWeddingVariant(variant)
  return GROUP_LAYOUT.flatMap((layout) => {
    const entries: NavEntry[] = layout.slots.flatMap((slot): NavEntry[] => {
      if (slot === 'publish' || slot === 'settings') {
        const page = PAGE_ENTRY[slot]
        return [{ kind: 'page', key: slot, label: page.label, routeName: page.routeName, to: { name: page.routeName } }]
      }
      if (typeof slot === 'object') return [{ kind: 'note', key: slot.note, label: slot.label }]
      const s = sections.find((x) => x.key === slot)
      return s ? [{ kind: 'section', section: s }] : []
    })
    if (!entries.some((e) => e.kind === 'section')) return []
    const generic = layout.key === 'wedding' && !wedding
    return [{
      key: layout.key,
      label: generic ? 'navGroupInvitation' : layout.label,
      fullLabel: generic ? 'navGroupInvitationFull' : layout.fullLabel,
      entries,
    }]
  })
}

/** The wedding navigation (legacy constant; equals `navGroupsFor('wedding_ceremony')`). */
export const NAV_GROUPS: readonly NavGroup[] = navGroupsFor()

/** Navigation group of a route (section pages and the publish page), if any. */
export function navGroupByRouteName(name: unknown, groups: readonly NavGroup[] = NAV_GROUPS): NavGroup | undefined {
  return groups.find((g) =>
    g.entries.some((e) => (e.kind === 'section' ? e.section.routeName === name : e.kind === 'page' && e.routeName === name)),
  )
}

export function sectionByRouteName(name: unknown, variant?: VariantId | null): EditorSection | undefined {
  return editorSectionsFor(variant).find((s) => s.routeName === name)
}

/** Sections that are always on the invitation (no "Show on website" switch). */
export function isMandatorySection(key: SectionKey, variant?: VariantId | null): boolean {
  if (!variant) return (MANDATORY_WEDDING_SECTIONS as readonly string[]).includes(key)
  const id = registrySectionId(key)
  return id !== undefined && isSectionRequired(variant, id)
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
 * universal v1.1 sections and the v2.0 sections default off when absent.
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
    case 'couple':
      return draft.couple.enabled !== false
    case 'holyRecite1':
    case 'holyRecite2':
    case 'greeting':
    case 'wishes':
    case 'amplopDigital':
    case 'profiles':
    case 'milestone':
    case 'organization':
    case 'agenda':
    case 'speakers':
      return draft[key]?.enabled === true
    default:
      return true
  }
}
