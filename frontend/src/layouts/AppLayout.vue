<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import '@/styles/cms.css'
import AppLanguageSwitch from '@/components/AppLanguageSwitch.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { useMediaQuery } from '@/composables/useMediaQuery'
import ConfirmHost from '@/features/cms/components/ConfirmHost.vue'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import AccountMenu from '@/features/shell/AccountMenu.vue'
import { BRAND_NAME } from '@/features/shell/brand'
import type { MenuNavItem } from '@/features/shell/types'
import { useAuthStore } from '@/stores/auth'
import { useWeddingStore } from '@/stores/wedding'

const auth = useAuthStore()
const wedding = useWeddingStore()
const { t, locale } = useAppLocale()
const router = useRouter()
const route = useRoute()
const signingOut = ref(false)

const navItems = [
  { name: 'dashboard', label: 'dashboard' },
  { name: 'wedding', label: 'myWebsite' },
  { name: 'themes', label: 'themes' },
  { name: 'account', label: 'account' },
] as const

// "Themes" stays highlighted on every theme studio level (/themes/...), "My website" on /wedding/*.
const isActive = (name: string) =>
  name === 'themes'
    ? route.path === '/themes' || route.path.startsWith('/themes/')
    : name === 'wedding'
      ? route.path === '/wedding' || route.path.startsWith('/wedding/')
      : route.name === name


// Every shortcut opens an existing CMS page; no guest totals or analytics are fabricated.
const sidebarItems = [
  { path: '/dashboard', name: 'dashboard', label: 'dashboard', icon: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9' },
  { path: '/wedding', name: 'wedding', label: 'myWebsite', icon: 'm15 4 5 5M4 20l4-1L21 6l-5-5L3 14v6Z' },
  { path: '/wedding/rsvp', name: 'wedding-rsvp', label: 'sectionRsvp', icon: 'M5 4h14v17H5ZM8 2v4m8-4v4M8 13l3 3 5-6' },
  { path: '/wedding/wishes', name: 'wedding-wishes', label: 'sectionWishes', icon: 'M3 4h18v13H10l-5 4v-4H3ZM7 8h10M7 12h7' },
  { path: '/wedding/gifts', name: 'wedding-gifts', label: 'sectionAmplopDigital', icon: 'M3 7h18v14H3ZM3 7V4h14v3M15 11h6v6h-6Z' },
  { path: '/wedding/publish', name: 'wedding-publish', label: 'sectionPublish', divider: true, icon: 'm3 10 18-7-7 18-3-8-8-3Zm8 3L21 3' },
  { path: '/account', name: 'account', label: 'account', icon: 'M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21v-3a8 8 0 0 1 16 0v3' },
] as const
const visibleSidebarItems = computed(() => sidebarItems.filter(item => router.hasRoute(item.name)))
const isSidebarActive = (path: string) => path === '/wedding'
  ? isActive('wedding') && !sidebarItems.some(item => item.path !== '/wedding' && item.path === route.path)
  : route.path === path

// Tailwind's `sm` breakpoint: from here the nav and language switch sit inline in the header.
const isDesktop = useMediaQuery('(min-width: 640px)')
const hasInlineLanguage = useMediaQuery('(min-width: 1000px)')
const menuItems = computed<MenuNavItem[]>(() =>
  isDesktop.value
    ? []
    : navItems.map((item) => ({ key: item.name, to: { name: item.name }, label: t(item.label), active: isActive(item.name) })),
)

// The wedding record holds the selected theme, so load it for every signed-in page.
onMounted(() => {
  if (auth.isAuthenticated) void wedding.ensureLoaded()
})

const initials = computed(() =>
  (auth.user?.full_name ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

const confirm = useConfirm()

async function signOut() {
  // Signing out clears the editor, so never drop unsaved edits silently:
  // flush pending autosaves first, and only ask if something still couldn't be saved.
  if (wedding.hasUnsavedWork) await wedding.saveNow().catch(() => false)
  if (wedding.hasUnsavedWork) {
    const discard = await confirm.ask({
      title: t('signOutUnsavedTitle'),
      message: t('signOutUnsavedBody'),
      confirmLabel: t('discardChanges'),
      cancelLabel: t('keepEditing'),
      tone: 'danger',
    })
    if (!discard) return
  }
  signingOut.value = true
  try {
    await auth.logout()
  } finally {
    signingOut.value = false
    await router.push({ name: 'login' })
  }
}
</script>

<template>
  <div class="kuren-cms">
    <a class="cms-skip-link" href="#cms-main">{{ locale === 'id' ? 'Lewati ke konten utama' : 'Skip to main content' }}</a>
    <header class="cms-header">
      <div class="cms-header-inner">
        <RouterLink :to="{ name: 'dashboard' }" :aria-label="BRAND_NAME" class="cms-brand">
          <svg viewBox="0 0 36 42" fill="none" aria-hidden="true"><path d="M15 39c0-14 3-24 12-34M17 29C5 29 3 21 4 15c10 0 15 6 13 14Zm3-11C11 16 11 6 16 2c7 5 8 11 4 16Zm4-4c1-10 7-12 10-11 0 8-4 13-10 11Zm-9 21C5 38 1 33 1 28c8-2 14 0 14 7Zm6-11c8-7 13-5 14-1-6 6-10 7-14 1Z" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>Kuren</span>
        </RouterLink>
        <nav class="cms-top-nav" :aria-label="t('mainNav')" data-testid="main-nav">
          <RouterLink v-for="item in navItems" :key="item.name" :to="{ name: item.name }"
            class="cms-top-link" :class="{ 'is-active': isActive(item.name) }"
            :aria-current="isActive(item.name) ? 'page' : undefined">
            {{ t(item.label) }}
          </RouterLink>
        </nav>
        <div class="cms-header-actions">
          <div class="cms-desktop-language"><AppLanguageSwitch /></div>
          <AccountMenu :name="auth.user?.full_name ?? ''" :email="auth.user?.email ?? ''" :initials="initials"
            :items="menuItems" :show-language="!hasInlineLanguage" :signing-out="signingOut" @sign-out="signOut" />
        </div>
      </div>
    </header>

    <aside class="cms-sidebar" :aria-label="locale === 'id' ? 'Navigasi ruang kerja' : 'Workspace navigation'">
      <nav>
        <RouterLink v-for="item in visibleSidebarItems" :key="item.path" :to="item.path"
          class="cms-sidebar-link" :class="{ 'is-active': isSidebarActive(item.path), 'cms-sidebar-divider': 'divider' in item && item.divider }"
          :aria-current="isSidebarActive(item.path) ? 'page' : undefined">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path :d="item.icon" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span>{{ t(item.label) }}</span>
        </RouterLink>
      </nav>
      <p class="cms-sidebar-caption">{{ locale === 'id' ? 'Cerita Anda, dirangkai dengan indah.' : 'Your story, beautifully told.' }}</p>
    </aside>

    <main id="cms-main" tabindex="-1" class="cms-workspace" :class="route.meta.layout === 'studio' ? 'cms-workspace--studio' : 'cms-workspace--page'">
      <RouterView />
    </main>
    <ConfirmHost />
  </div>
</template>
