import { createRouter, createWebHistory } from 'vue-router'

import { canonicalCollection, canonicalFamily, canonicalTemplate } from '@/features/themes/picker/guards'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page requires a signed-in user. */
    requiresAuth?: boolean
    /** Page is only for signed-out visitors (login/register). */
    guestOnly?: boolean
    title?: string
    /** Full-width, full-height layout for the theme studio. */
    layout?: 'studio'
  }
}

// Shared by all studio routes so navigating between levels reuses the same page instance.
const ThemeStudioPage = () => import('@/pages/ThemeStudioPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: 'dashboard' } },
    {
      path: '/',
      component: () => import('@/layouts/AuthLayout.vue'),
      meta: { guestOnly: true },
      children: [
        { path: 'login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { title: 'Sign in' } },
        {
          path: 'register',
          name: 'register',
          component: () => import('@/pages/RegisterPage.vue'),
          meta: { title: 'Create account' },
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
          meta: { title: 'Dashboard' },
        },
        // Theme studio: sidebar (Family → Collection → Template) + live preview, one page.
        // Every level has its own URL; guards redirect aliases to canonical URLs.
        {
          path: 'themes',
          name: 'themes',
          component: ThemeStudioPage,
          meta: { title: 'Themes', layout: 'studio' },
        },
        {
          path: 'themes/:familyId',
          name: 'theme-family',
          component: ThemeStudioPage,
          props: true,
          meta: { title: 'Themes', layout: 'studio' },
          beforeEnter: canonicalFamily,
        },
        {
          path: 'themes/:familyId/:collectionId',
          name: 'theme-collection',
          component: ThemeStudioPage,
          props: true,
          meta: { title: 'Themes', layout: 'studio' },
          beforeEnter: canonicalCollection,
        },
        {
          path: 'themes/:familyId/:collectionId/:templateSlug',
          name: 'theme-template',
          component: ThemeStudioPage,
          props: true,
          meta: { title: 'Themes', layout: 'studio' },
          beforeEnter: canonicalTemplate,
        },
        {
          path: 'account',
          name: 'account',
          component: () => import('@/pages/AccountPage.vue'),
          meta: { title: 'Account' },
        },
      ],
    },
    {
      // Full-screen template preview, outside the dashboard chrome. Canonical URL.
      path: '/themes/:familyId/:collectionId/:templateSlug/preview',
      name: 'theme-preview',
      component: () => import('@/pages/ThemePreviewPage.vue'),
      props: true,
      meta: { requiresAuth: true, title: 'Template preview' },
      beforeEnter: canonicalTemplate,
    },
    {
      // Workstream 2 URL (and template aliases) → redirected to the canonical preview URL.
      path: '/themes/:themeId/preview',
      name: 'theme-preview-legacy',
      component: () => import('@/pages/ThemePreviewPage.vue'),
      meta: { requiresAuth: true },
      beforeEnter: canonicalTemplate,
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.ensureLoaded()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: to.fullPath !== '/dashboard' ? { redirect: to.fullPath } : undefined }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Kuren` : 'Kuren · Wedding Websites'
})

/** Only allow in-app relative redirects (prevents open-redirects via ?redirect=). */
export function safeRedirect(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

export default router
