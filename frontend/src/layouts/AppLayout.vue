<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BrandMark from '@/components/BrandMark.vue'
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
const { t } = useAppLocale()
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

// Tailwind's `sm` breakpoint: from here the nav and language switch sit inline in the header.
const isDesktop = useMediaQuery('(min-width: 640px)')
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
  // Signing out clears the editor, so never drop unsaved edits silently.
  if (wedding.anyDirty) {
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
  <div class="min-h-dvh">
    <header class="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
      <!-- One compact row at every width: on phones the nav and language switch live in the account menu. -->
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-x-4 px-4 sm:h-16 sm:gap-x-6 sm:px-6">
        <RouterLink
          :to="{ name: 'dashboard' }"
          :aria-label="BRAND_NAME"
          class="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          <BrandMark />
        </RouterLink>

        <nav class="hidden items-center gap-x-1 sm:flex" :aria-label="t('mainNav')" data-testid="main-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
            :class="isActive(item.name) ? 'bg-rose-50 text-ink-900' : 'text-ink-700'"
            :aria-current="isActive(item.name) ? 'page' : undefined"
          >
            {{ t(item.label) }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <div class="hidden sm:block"><AppLanguageSwitch /></div>
          <AccountMenu
            :name="auth.user?.full_name ?? ''"
            :email="auth.user?.email ?? ''"
            :initials="initials"
            :items="menuItems"
            :show-language="!isDesktop"
            :signing-out="signingOut"
            @sign-out="signOut"
          />
        </div>
      </div>
    </header>

    <!-- The theme studio uses the full width and (on desktop) the full remaining height. -->
    <main
      :class="
        route.meta.layout === 'studio'
          ? 'lg:h-[calc(100dvh-4rem)] lg:overflow-hidden'
          : 'mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10'
      "
    >
      <RouterView />
    </main>
    <!-- Shared confirmation (unsaved-changes guard, sign-out). -->
    <ConfirmHost />
  </div>
</template>
