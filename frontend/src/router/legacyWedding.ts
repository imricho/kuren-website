/**
 * Legacy `/wedding/*` URLs (pre-engine bookmarks, e-mails and links) redirect to the
 * same page of the user's latest wedding-category invitation:
 *   /wedding            → /invitations/:id/edit
 *   /wedding/<slug>     → /invitations/:id/edit/<slug>
 *   /wedding/preview    → /invitations/:id/preview
 * Query and hash are kept. No wedding invitation (or the list can't be loaded) →
 * /invitations. The routes keep their old names (`wedding`, `wedding-<slug>`,
 * `wedding-preview`), so links that only know "the wedding" still work.
 */
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import {
  EDITOR_ROUTE_NAME,
  EDITOR_ROUTES,
  INVITATION_PREVIEW_ROUTE_NAME,
  INVITATIONS_ROUTE_NAME,
} from '@/features/cms/editorRoutes'
import { useInvitationStore } from '@/stores/invitation'
import { useInvitationsStore } from '@/stores/invitations'

export const LEGACY_WEDDING_ROUTE_NAME = 'wedding'
export const LEGACY_WEDDING_PREVIEW_ROUTE_NAME = 'wedding-preview'
export const legacyWeddingRouteName = (slug: string) => `wedding-${slug}`

/** Target route name for a legacy route name, or undefined when it isn't one. */
export function legacyTarget(name: unknown): string | undefined {
  if (name === LEGACY_WEDDING_ROUTE_NAME) return EDITOR_ROUTE_NAME
  if (name === LEGACY_WEDDING_PREVIEW_ROUTE_NAME) return INVITATION_PREVIEW_ROUTE_NAME
  return EDITOR_ROUTES.find((r) => legacyWeddingRouteName(r.slug) === name)?.name
}

/** The user's latest wedding invitation id: the open one if it is a wedding, else the newest from the list. */
async function latestWeddingId(): Promise<string | null> {
  const open = useInvitationStore()
  if (open.loadState === 'ready' && open.category === 'wedding' && open.invitationId) return open.invitationId
  const list = useInvitationsStore()
  await list.load()
  return list.latestOf('wedding')?.id ?? null
}

/** `beforeEnter` of every legacy route. */
export async function legacyWeddingRedirect(to: RouteLocationNormalized): Promise<RouteLocationRaw> {
  const name = legacyTarget(to.name)
  const id = name ? await latestWeddingId() : null
  if (!name || !id) return { name: INVITATIONS_ROUTE_NAME }
  return { name, params: { id }, query: to.query, hash: to.hash, replace: true }
}
