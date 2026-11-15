/**
 * The editor's sections, in order. Theme selection lives in the theme studio
 * (/themes) and is linked, not duplicated.
 */
import type { RouteLocationRaw } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import type { SectionKey } from '@/features/wedding/completeness'

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
  section('couple', 'sectionCouple', 'wedding-couple'),
  section('story', 'sectionStory', 'wedding-story'),
  section('events', 'sectionEvents', 'wedding-events'),
  section('gallery', 'sectionGallery', 'wedding-gallery'),
  section('rsvp', 'sectionRsvp', 'wedding-rsvp'),
  section('closing', 'sectionClosing', 'wedding-closing'),
]

export function sectionByKey(key: SectionKey): EditorSection {
  return EDITOR_SECTIONS.find((s) => s.key === key)!
}

export function sectionByRouteName(name: unknown): EditorSection | undefined {
  return EDITOR_SECTIONS.find((s) => s.routeName === name)
}
