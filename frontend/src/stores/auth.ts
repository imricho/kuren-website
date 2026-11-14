import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { authApi, type LoginPayload, type RegisterPayload, type User } from '@/api/auth'
import { ApiError } from '@/api/http'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  /** True once we've asked the server whether a session exists. */
  const initialized = ref(false)
  let pending: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)
  const firstName = computed(() => user.value?.full_name.split(' ')[0] ?? '')

  /** Resolve the current session once (deduplicated across concurrent callers). */
  function ensureLoaded(): Promise<void> {
    if (initialized.value) return Promise.resolve()
    pending ??= authApi
      .me()
      .then((me) => {
        user.value = me
      })
      .catch((err: unknown) => {
        // 401 simply means "not signed in"; anything else is also treated as
        // signed-out so the app stays usable, but is surfaced in the console.
        if (!(err instanceof ApiError && err.status === 401)) console.error(err)
        user.value = null
      })
      .finally(() => {
        initialized.value = true
        pending = null
      })
    return pending
  }

  async function login(payload: LoginPayload) {
    user.value = await authApi.login(payload)
    initialized.value = true
  }

  async function register(payload: RegisterPayload) {
    user.value = await authApi.register(payload)
    initialized.value = true
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      user.value = null
    }
  }

  async function updateProfile(changes: Partial<Pick<User, 'full_name'>>) {
    user.value = await authApi.updateMe(changes)
  }

  return { user, initialized, isAuthenticated, firstName, ensureLoaded, login, register, logout, updateProfile }
})
