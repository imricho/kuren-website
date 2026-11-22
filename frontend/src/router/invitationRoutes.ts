/**
 * Invitation routes, built from the shared editor route table so the app router
 * (lazy pages) and the test router (eager pages) can never drift.
 */
import type { RouteComponent, RouteRecordRaw } from 'vue-router'

import {
  EDITOR_ROUTE_NAME,
  EDITOR_ROUTES,
  INVITATION_PREVIEW_ROUTE_NAME,
  INVITATION_NEW_ROUTE_NAME,
  INVITATION_RESPONSES_ROUTE_NAME,
  INVITATIONS_ROUTE_NAME,
  type EditorPageComponent,
} from '@/features/cms/editorRoutes'

import {
  LEGACY_WEDDING_PREVIEW_ROUTE_NAME,
  LEGACY_WEDDING_ROUTE_NAME,
  legacyWeddingRedirect,
  legacyWeddingRouteName,
} from './legacyWedding'

type Component = RouteComponent | (() => Promise<RouteComponent | { default: RouteComponent }>)

export interface InvitationPages {
  pages: Record<EditorPageComponent, Component>
  editorLayout: Component
  preview: Component
  list: Component
  create: Component
  responses: Component
}

/** Legacy routes only redirect; this never renders. */
const Redirecting: RouteComponent = { name: 'LegacyRedirect', render: () => null }

/**
 * `inLayout`: pages inside the signed-in app chrome (children of AppLayout);
 * `standalone`: full-screen pages outside it. All require sign-in.
 */
export function invitationRoutes(c: InvitationPages): { inLayout: RouteRecordRaw[]; standalone: RouteRecordRaw[] } {
  const studio = { layout: 'studio' } as const
  const inLayout: RouteRecordRaw[] = [
    { path: 'invitations', name: INVITATIONS_ROUTE_NAME, component: c.list, meta: { titleKey: 'invitations' } },
    { path: 'invitations/new', name: INVITATION_NEW_ROUTE_NAME, component: c.create, meta: { titleKey: 'createInvitation' } },
    { path: 'invitations/:id/responses', name: INVITATION_RESPONSES_ROUTE_NAME, component: c.responses, meta: { titleKey: 'responses' } },
    {
      // Split editor: section nav + one page per section. The root redirects to the first
      // incomplete section once the invitation has loaded (see WeddingEditorLayout).
      path: 'invitations/:id/edit',
      name: EDITOR_ROUTE_NAME,
      component: c.editorLayout,
      meta: { titleKey: 'myWebsite', ...studio },
      children: EDITOR_ROUTES.map((r) => ({
        path: r.slug,
        name: r.name,
        component: c.pages[r.component],
        meta: { titleKey: r.titleKey, ...studio, ...(r.recite ? { recite: r.recite } : {}) },
      })),
    },
  ]
  const legacyMeta = { requiresAuth: true, ...studio } as const
  const standalone: RouteRecordRaw[] = [
    {
      // The invitation with its SAVED content (plus live edits), outside the dashboard chrome.
      path: '/invitations/:id/preview',
      name: INVITATION_PREVIEW_ROUTE_NAME,
      component: c.preview,
      meta: { requiresAuth: true, titleKey: 'websitePreview' },
    },
    // Legacy wedding URLs → the latest wedding invitation (router/legacyWedding.ts).
    { path: '/wedding/preview', name: LEGACY_WEDDING_PREVIEW_ROUTE_NAME, component: Redirecting, meta: { requiresAuth: true }, beforeEnter: legacyWeddingRedirect },
    { path: '/wedding', name: LEGACY_WEDDING_ROUTE_NAME, component: Redirecting, meta: legacyMeta, beforeEnter: legacyWeddingRedirect },
    ...EDITOR_ROUTES.map((r): RouteRecordRaw => ({
      path: `/wedding/${r.slug}`,
      name: legacyWeddingRouteName(r.slug),
      component: Redirecting,
      meta: legacyMeta,
      beforeEnter: legacyWeddingRedirect,
    })),
  ]
  return { inLayout, standalone }
}
