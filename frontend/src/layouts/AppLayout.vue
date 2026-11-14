<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import BrandMark from '@/components/BrandMark.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const signingOut = ref(false)

const navItems = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'themes', label: 'Themes' },
  { name: 'account', label: 'Account' },
] as const

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
      <div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <RouterLink :to="{ name: 'dashboard' }" aria-label="Go to dashboard"><BrandMark /></RouterLink>

        <nav class="flex items-center gap-1" aria-label="Main">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="rounded-md px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
            active-class="!text-ink-900 bg-rose-50"
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

    <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>
