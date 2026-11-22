/**
 * Route table of the invitation editor (`/invitations/:id/edit/<slug>`), shared by
 * the app router and the test router so they can never drift. Pure data: the
 * routers attach components.
 *
 * Legacy `/wedding/<slug>` URLs use the same slugs and redirect to the user's latest
 * wedding invitation (see `router/legacyWedding.ts`); their route names are the
 * pre-engine names (`wedding-<slug>`), so older links keep working.
 */
import type { AppMessageKey } from '@/composables/useAppLocale'

import type { SectionKey } from '@/features/wedding/completeness'

export type EditorPageKey = Exclude<SectionKey, 'theme'> | 'publish' | 'settings'

/** Which page component a route renders. */
export type EditorPageComponent =
  | 'opening' | 'couple' | 'story' | 'events' | 'gallery' | 'rsvp' | 'closing'
  | 'holyRecite' | 'greeting' | 'date' | 'wishes' | 'gifts' | 'publish' | 'settings'
  | 'profiles' | 'milestone' | 'organization' | 'agenda' | 'speakers'

export interface EditorRoute {
  key: EditorPageKey
  /** URL segment after `/edit/` (and after `/wedding/` for legacy links). */
  slug: string
  /** Route name under `/invitations/:id/edit`. */
  name: string
  titleKey: AppMessageKey
  component: EditorPageComponent
  recite?: 1 | 2
}

const r = (key: EditorPageKey, slug: string, titleKey: AppMessageKey, component: EditorPageComponent, recite?: 1 | 2): EditorRoute => ({
  key,
  slug,
  name: `editor-${slug}`,
  titleKey,
  component,
  ...(recite ? { recite } : {}),
})

export const EDITOR_ROUTES: readonly EditorRoute[] = [
  r('opening', 'opening', 'sectionOpening', 'opening'),
  r('couple', 'couple', 'sectionCouple', 'couple'),
  r('story', 'story', 'sectionStory', 'story'),
  r('events', 'events', 'sectionEvents', 'events'),
  r('gallery', 'gallery', 'sectionGallery', 'gallery'),
  r('rsvp', 'rsvp', 'sectionRsvp', 'rsvp'),
  r('closing', 'closing', 'sectionClosing', 'closing'),
  r('holyRecite1', 'holy-recite-1', 'sectionHolyRecite1', 'holyRecite', 1),
  r('greeting', 'greeting', 'sectionGreeting', 'greeting'),
  r('weddingDate', 'date', 'sectionWeddingDate', 'date'),
  r('wishes', 'wishes', 'sectionWishes', 'wishes'),
  r('amplopDigital', 'gifts', 'sectionAmplopDigital', 'gifts'),
  r('holyRecite2', 'holy-recite-2', 'sectionHolyRecite2', 'holyRecite', 2),
  r('publish', 'publish', 'sectionPublish', 'publish'),
  r('settings', 'settings', 'invitationSettings', 'settings'),
  // v2.0 sections.
  r('profiles', 'profiles', 'sectionProfiles', 'profiles'),
  r('milestone', 'milestone', 'sectionMilestone', 'milestone'),
  r('organization', 'organization', 'sectionOrganization', 'organization'),
  r('agenda', 'agenda', 'sectionAgenda', 'agenda'),
  r('speakers', 'speakers', 'sectionSpeakers', 'speakers'),
]

/** Editor root (redirects to the first incomplete section once loaded). */
export const EDITOR_ROUTE_NAME = 'editor'
export const INVITATION_PREVIEW_ROUTE_NAME = 'invitation-preview'
export const INVITATIONS_ROUTE_NAME = 'invitations'
export const INVITATION_NEW_ROUTE_NAME = 'invitation-new'
export const INVITATION_RESPONSES_ROUTE_NAME = 'invitation-responses'

export function editorRouteName(key: EditorPageKey): string {
  return EDITOR_ROUTES.find((route) => route.key === key)!.name
}
