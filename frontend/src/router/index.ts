import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import type { AppMessageKey } from '@/composables/useAppLocale'
import { canonicalCollection, canonicalFamily, canonicalTemplate } from '@/features/themes/picker/guards'
import { useAuthStore } from '@/stores/auth'

import { safeRedirect } from './redirect'
import { isSameView } from './views'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page requires a signed-in user. */
    requiresAuth?: boolean
    /** Page is only for signed-out visitors (login/register). */
    guestOnly?: boolean
    /** Page name for the document title ("<Page> · Kuren"), translated with t(). */
    titleKey?: AppMessageKey
    /** Full-width, full-height layout (theme studio, live website editor). */
    layout?: 'studio'
    /** Guest-facing page (published invitation): no session lookup, no app chrome. */
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

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/LandingPage.vue') },
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
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
          meta: { titleKey: 'dashboard' },
        },
        // First run: names & date → theme → see your site. The dashboard sends a fresh
        // wedding here once (see features/shell/firstRun); always skippable.
        {
          path: 'welcome',
          name: 'welcome',
          component: () => import('@/pages/WelcomePage.vue'),
          meta: { titleKey: 'welcomeTitle' },
        },
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
        {
          // Website editor: section nav + one page per section. /wedding redirects to the
          // first incomplete section once the wedding has loaded (see WeddingEditorLayout).
          path: 'wedding',
          name: 'wedding',
          component: () => import('@/pages/wedding/WeddingEditorLayout.vue'),
          // Live split editor: full width and (on desktop) the full remaining height.
          meta: { titleKey: 'myWebsite', layout: 'studio' },
          children: [
            { path: 'opening', name: 'wedding-opening', component: () => import('@/pages/wedding/OpeningPage.vue'), meta: { titleKey: 'sectionOpening', layout: 'studio' } },
            { path: 'couple', name: 'wedding-couple', component: () => import('@/pages/wedding/CouplePage.vue'), meta: { titleKey: 'sectionCouple', layout: 'studio' } },
            { path: 'story', name: 'wedding-story', component: () => import('@/pages/wedding/StoryPage.vue'), meta: { titleKey: 'sectionStory', layout: 'studio' } },
            { path: 'events', name: 'wedding-events', component: () => import('@/pages/wedding/EventsPage.vue'), meta: { titleKey: 'sectionEvents', layout: 'studio' } },
            { path: 'gallery', name: 'wedding-gallery', component: () => import('@/pages/wedding/GalleryPage.vue'), meta: { titleKey: 'sectionGallery', layout: 'studio' } },
            { path: 'rsvp', name: 'wedding-rsvp', component: () => import('@/pages/wedding/RsvpPage.vue'), meta: { titleKey: 'sectionRsvp', layout: 'studio' } },
            { path: 'closing', name: 'wedding-closing', component: () => import('@/pages/wedding/ClosingPage.vue'), meta: { titleKey: 'sectionClosing', layout: 'studio' } },
            // CMS v2.0 sections (canonical ids: holyRecite1, greeting, weddingDate, wishes, amplopDigital, holyRecite2).
            { path: 'holy-recite-1', name: 'wedding-holy-recite-1', component: () => import('@/pages/wedding/HolyRecitePage.vue'), meta: { titleKey: 'sectionHolyRecite1', layout: 'studio', recite: 1 } },
            { path: 'greeting', name: 'wedding-greeting', component: () => import('@/pages/wedding/GreetingPage.vue'), meta: { titleKey: 'sectionGreeting', layout: 'studio' } },
            { path: 'date', name: 'wedding-date', component: () => import('@/pages/wedding/WeddingDatePage.vue'), meta: { titleKey: 'sectionWeddingDate', layout: 'studio' } },
            { path: 'wishes', name: 'wedding-wishes', component: () => import('@/pages/wedding/WishesPage.vue'), meta: { titleKey: 'sectionWishes', layout: 'studio' } },
            { path: 'gifts', name: 'wedding-gifts', component: () => import('@/pages/wedding/AmplopDigitalPage.vue'), meta: { titleKey: 'sectionAmplopDigital', layout: 'studio' } },
            { path: 'holy-recite-2', name: 'wedding-holy-recite-2', component: () => import('@/pages/wedding/HolyRecitePage.vue'), meta: { titleKey: 'sectionHolyRecite2', layout: 'studio', recite: 2 } },
            { path: 'publish', name: 'wedding-publish', component: () => import('@/pages/wedding/PublishPage.vue'), meta: { titleKey: 'sectionPublish', layout: 'studio' } },
          ],
        },
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
      meta: { requiresAuth: true, titleKey: 'templatePreview' },
      beforeEnter: canonicalTemplate,
    },
    {
      // The couple's own website with their SAVED content, outside the dashboard chrome.
      path: '/wedding/preview',
      name: 'wedding-preview',
      component: () => import('@/pages/wedding/WeddingPreviewPage.vue'),
      meta: { requiresAuth: true, titleKey: 'websitePreview' },
    },
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
      meta: { requiresAuth: true },
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
  // Guest-facing published invitations never depend on (or probe) a session.
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
