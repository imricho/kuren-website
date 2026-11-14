<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BrandMark from '@/components/BrandMark.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const signingOut = ref(false)

const navItems = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'themes', label: 'Themes' },
  { name: 'account', label: 'Account' },
] as const

// "Themes" stays highlighted on every theme studio level (/themes/...).
const isActive = (name: string) =>
  name === 'themes' ? route.path === '/themes' || route.path.startsWith('/themes/') : route.name === name

const initials = computed(() =>
  (auth.user?.full_name ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

async function signOut() {
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
      <!-- On phones the nav wraps onto its own row below the brand. -->
      <div
        class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 pb-2 sm:h-16 sm:flex-nowrap sm:px-6 sm:py-0"
      >
        <RouterLink :to="{ name: 'dashboard' }" aria-label="Go to dashboard"><BrandMark /></RouterLink>

        <nav class="order-last -mx-3 flex w-full items-center gap-1 sm:order-none sm:mx-0 sm:w-auto" aria-label="Main">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-ink-900"
            :class="isActive(item.name) ? 'bg-rose-50 text-ink-900' : 'text-ink-500'"
            :aria-current="isActive(item.name) ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <span
            class="hidden size-8 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700 sm:flex"
            :title="auth.user?.email"
            aria-hidden="true"
          >
            {{ initials }}
          </span>
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-60"
            :disabled="signingOut"
            @click="signOut"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- The theme studio uses the full width and (on desktop) the full remaining height. -->
    <main
      :class="
        route.meta.layout === 'studio'
          ? 'lg:h-[calc(100dvh-4rem)] lg:overflow-hidden'
          : 'mx-auto max-w-6xl px-4 py-10 sm:px-6'
      "
    >
      <RouterView />
    </main>
  </div>
</template>
