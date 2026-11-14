import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page requires a signed-in user. */
    requiresAuth?: boolean
    /** Page is only for signed-out visitors (login/register). */
    guestOnly?: boolean
    title?: string
  }
}

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
        // Theme selection: family → collection → template.
        {
          path: 'themes',
          name: 'themes',
          component: () => import('@/pages/ThemeFamiliesPage.vue'),
          meta: { title: 'Themes' },
        },
        {
          path: 'themes/:familyId',
          name: 'theme-family',
          component: () => import('@/pages/ThemeFamilyPage.vue'),
          props: true,
          meta: { title: 'Themes' },
          // A family with a single collection skips straight to its templates.
          beforeEnter: async (to) => {
            // Loaded lazily so the theme catalog stays out of the initial bundle.
            const { collectionsOf } = await import('@/features/themes/core/registry')
            const familyId = String(to.params.familyId)
            const collections = collectionsOf(familyId)
            if (collections.length === 1) {
              return { name: 'theme-collection', params: { familyId, collectionId: collections[0]!.id }, replace: true }
            }
          },
        },
        {
          path: 'themes/:familyId/:collectionId',
          name: 'theme-collection',
          component: () => import('@/pages/ThemeCollectionPage.vue'),
          props: true,
          meta: { title: 'Themes' },
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
      // Full-screen theme preview, outside the dashboard chrome.
      path: '/themes/:themeId/preview',
      name: 'theme-preview',
      component: () => import('@/pages/ThemePreviewPage.vue'),
      props: true,
      meta: { requiresAuth: true, title: 'Theme preview' },
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
