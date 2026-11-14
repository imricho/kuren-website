import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi, type User } from '@/api/auth'
import { ApiError } from '@/api/http'

import { useAuthStore } from './auth'

const user: User = { id: '1', email: 'amelia@example.com', full_name: 'Amelia Hart', created_at: '2026-01-01' }

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('loads the current user once, even with concurrent callers', async () => {
    const me = vi.spyOn(authApi, 'me').mockResolvedValue(user)
    const store = useAuthStore()

    await Promise.all([store.ensureLoaded(), store.ensureLoaded()])
    await store.ensureLoaded()

    expect(me).toHaveBeenCalledTimes(1)
    expect(store.isAuthenticated).toBe(true)
    expect(store.firstName).toBe('Amelia')
  })

  it('treats 401 as signed out', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError(401, 'not_authenticated', 'nope'))
    const store = useAuthStore()

    await store.ensureLoaded()

    expect(store.initialized).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })

  it('login stores the user; logout clears it even if the request fails', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(user)
    vi.spyOn(authApi, 'logout').mockRejectedValue(new ApiError(0, 'network_error', 'offline'))
    const store = useAuthStore()

    await store.login({ email: user.email, password: 'secret-123' })
    expect(store.user).toEqual(user)

    await expect(store.logout()).rejects.toBeInstanceOf(ApiError)
    expect(store.user).toBeNull()
  })
})
