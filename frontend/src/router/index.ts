import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import { canonicalCollection, canonicalFamily, canonicalTemplate } from '@/features/themes/picker/guards'
import { useAuthStore } from '@/stores/auth'

import { invitationRoutes } from './invitationRoutes'
import { safeRedirect } from './redirect'
import { isSameView } from './views'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page requires a signed-in user. */
    requiresAuth?: boolean
    /** Page is only for signed-out visitors (login/register). */
    guestOnly?: boolean
    /** Page name for the document title ("<Page> · Temuvibe"), translated with t(). */
    titleKey?: AppMessageKey
    /** Full-width, full-height layout (theme studio, live website editor). */
    layout?: 'studio'
    /** Public page: no session lookup and no private wedding reads. */
    publicPage?: boolean
    /** Which Holy Recite the shared editor page edits. */
    recite?: 1 | 2
  }
}

/**
 * Back/forward restores the saved position; a new page starts at the top; staying on
 * the same page (studio levels, welcome steps) keeps the position. Always instant —
 * no smooth scrolling, so prefers-reduced-motion is respected.
 */
function scrollBehavior(to: RouteLocationNormalized, from: RouteLocationNormalized, saved: { left: number; top: number } | null) {
  if (saved) return saved
  if (to.hash) return { el: to.hash }
  if (isSameView(to, from)) return false
  return { top: 0 }
}

// Shared by all studio routes so navigating between levels reuses the same page instance.
const ThemeStudioPage = () => import('@/pages/ThemeStudioPage.vue')

const HolyRecitePage = () => import('@/pages/wedding/HolyRecitePage.vue')
const invitation = invitationRoutes({
  list: () => import('@/pages/invitation/InvitationsPage.vue'),
  create: () => import('@/pages/invitation/NewInvitationPage.vue'),
  responses: () => import('@/pages/invitation/ResponsesPage.vue'),
  editorLayout: () => import('@/pages/wedding/WeddingEditorLayout.vue'),
  preview: () => import('@/pages/wedding/WeddingPreviewPage.vue'),
  pages: {
    opening: () => import('@/pages/wedding/OpeningPage.vue'),
    couple: () => import('@/pages/wedding/CouplePage.vue'),
    story: () => import('@/pages/wedding/StoryPage.vue'),
    events: () => import('@/pages/wedding/EventsPage.vue'),
    gallery: () => import('@/pages/wedding/GalleryPage.vue'),
    rsvp: () => import('@/pages/wedding/RsvpPage.vue'),
    closing: () => import('@/pages/wedding/ClosingPage.vue'),
    holyRecite: HolyRecitePage,
    greeting: () => import('@/pages/wedding/GreetingPage.vue'),
    date: () => import('@/pages/wedding/WeddingDatePage.vue'),
    wishes: () => import('@/pages/wedding/WishesPage.vue'),
    gifts: () => import('@/pages/wedding/AmplopDigitalPage.vue'),
    publish: () => import('@/pages/wedding/PublishPage.vue'),
    settings: () => import('@/pages/invitation/SettingsPage.vue'),
    profiles: () => import('@/pages/invitation/ProfilesPage.vue'),
    milestone: () => import('@/pages/invitation/MilestonePage.vue'),
    organization: () => import('@/pages/invitation/OrganizationPage.vue'),
    agenda: () => import('@/pages/invitation/AgendaPage.vue'),
    speakers: () => import('@/pages/invitation/SpeakersPage.vue'),
  },
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/LandingPage.vue') },
    { path: '/templates', name: 'public-templates', component: () => import('@/pages/TemplateGalleryPage.vue'), meta: { publicPage: true, titleKey: 'themes' } },
    {
      // Landing / gallery "use this template" → the wizard with the template preselected.
      path: '/use-template/:templateId',
      name: 'use-template',
      redirect: (to) => ({ name: 'invitation-new', query: { template: String(to.params.templateId) } }),
    },
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guestOnly: true },
      children: [
        { path: 'login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { titleKey: 'signIn' } },
        {
          path: 'register',
          name: 'register',
          component: () => import('@/pages/RegisterPage.vue'),
          meta: { titleKey: 'createAccount' },
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // The invitation list is the signed-in home; /dashboard stays as its old address.
        { path: 'dashboard', name: 'dashboard', redirect: { name: 'invitations' } },
        // Theme studio: sidebar (Family → Collection → Template) + live preview, one page.
        // Every level has its own URL; guards redirect aliases to canonical URLs.
        {
          path: 'themes',
          name: 'themes',
          component: ThemeStudioPage,
          meta: { titleKey: 'themes', layout: 'studio' },
        },
        {
          path: 'themes/:familyId',
          name: 'theme-family',
          component: ThemeStudioPage,
          props: true,
          meta: { titleKey: 'themes', layout: 'studio' },
          beforeEnter: canonicalFamily,
        },
        {
          path: 'themes/:familyId/:collectionId',
          name: 'theme-collection',
          component: ThemeStudioPage,
          props: true,
          meta: { titleKey: 'themes', layout: 'studio' },
          beforeEnter: canonicalCollection,
        },
        {
          path: 'themes/:familyId/:collectionId/:templateSlug',
          name: 'theme-template',
          component: ThemeStudioPage,
          props: true,
          meta: { titleKey: 'themes', layout: 'studio' },
          beforeEnter: canonicalTemplate,
        },
        ...invitation.inLayout,
        {
          path: 'account',
          name: 'account',
          component: () => import('@/pages/AccountPage.vue'),
          meta: { titleKey: 'account' },
        },
      ],
    },
    {
      // Full-screen template preview, outside the dashboard chrome. Canonical URL.
      path: '/themes/:familyId/:collectionId/:templateSlug/preview',
      name: 'theme-preview',
      component: () => import('@/pages/ThemePreviewPage.vue'),
      props: true,
      meta: { publicPage: true, titleKey: 'templatePreview' },
      beforeEnter: canonicalTemplate,
    },
    ...invitation.standalone,
    {
      // Published invitation for guests: no sign-in, served from the published snapshot only.
      path: '/i/:slug',
      name: 'public-invitation',
      component: () => import('@/pages/PublicInvitationPage.vue'),
      props: true,
      meta: { titleKey: 'publicInvitation', publicPage: true },
    },
    {
      // Workstream 2 URL (and template aliases) → redirected to the canonical preview URL.
      path: '/themes/:themeId/preview',
      name: 'theme-preview-legacy',
      component: () => import('@/pages/ThemePreviewPage.vue'),
      meta: { publicPage: true },
      beforeEnter: canonicalTemplate,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { titleKey: 'pageNotFound' },
    },
  ],
  scrollBehavior,
})

router.beforeEach(async (to) => {
  // Public samples and published invitations never depend on (or probe) a session.
  if (to.meta.publicPage) return
  const auth = useAuthStore()
  await auth.ensureLoaded()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    const destination = safeRedirect(to.query.redirect)
    return router.resolve(destination).meta.guestOnly ? { name: 'dashboard' } : destination
  }
})

// Document titles and focus on route change: see composables/useRouteA11y (used in App.vue).

export { safeRedirect } from './redirect'

export default router
