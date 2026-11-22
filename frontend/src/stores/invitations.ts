/**
 * The signed-in user's invitations (`GET /invitations`, newest-updated first):
 * list, create and delete. The open invitation itself lives in the invitation
 * store (`useInvitationStore`), keyed by id.
 */
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { ApiError } from '@/api/http'
import { clearRecoveries } from '@/features/cms/draftRecovery'
import { invitationsApi, type InvitationCreate, type InvitationRead, type InvitationSummary } from '@/api/invitations'
import type { CategoryId } from '@/features/invitation/registry'

import { useAuthStore } from './auth'
import { useInvitationStore } from './invitation'

export type InvitationsLoadState = 'idle' | 'loading' | 'ready' | 'error'

/** Summary row for a freshly created/loaded record (until the next list refresh). */
function summaryOf(rec: InvitationRead): InvitationSummary {
  return {
    id: rec.id,
    title: rec.title,
    category: rec.category,
    variant: rec.variant,
    themeId: rec.themeId,
    status: rec.status,
    slug: rec.slug ?? null,
    hasUnpublishedChanges: rec.hasUnpublishedChanges === true,
    eventDate: null,
    updatedAt: rec.updatedAt,
    publishedAt: rec.publishedAt,
  }
}

export const useInvitationsStore = defineStore('invitations', () => {
  const items = ref<InvitationSummary[]>([])
  const loadState = ref<InvitationsLoadState>('idle')
  const loadError = ref<string | null>(null)
  let pending: Promise<void> | null = null
  /** Bumped on reset (user change): late responses are dropped. */
  let generation = 0

  async function fetchList() {
    const gen = generation
    loadState.value = 'loading'
    loadError.value = null
    try {
      const { items: rows } = await invitationsApi.list()
      if (gen !== generation) return
      items.value = rows
      loadState.value = 'ready'
    } catch (err) {
      if (gen !== generation) return
      loadState.value = 'error'
      loadError.value = err instanceof Error ? err.message : String(err)
    }
  }

  /** (Re)load the list; concurrent callers share one request. Never throws. */
  function load(): Promise<void> {
    if (pending) return pending
    const p: Promise<void> = fetchList().finally(() => {
      if (pending === p) pending = null
    })
    pending = p
    return p
  }

  /** Load once. */
  function ensureLoaded(): Promise<void> {
    return loadState.value === 'ready' ? Promise.resolve() : load()
  }

  /** Newest-updated invitation of a category, if any (list must be loaded). */
  function latestOf(category: CategoryId): InvitationSummary | undefined {
    return items.value.find((item) => item.category === category)
  }

  const byId = computed(() => new Map(items.value.map((item) => [item.id, item])))

  /** Create (POST /invitations); the new invitation goes to the top of the list. Throws ApiError (e.g. 409 limit_reached, 422 template_incompatible). */
  async function create(body: InvitationCreate): Promise<InvitationRead> {
    const gen = generation
    const rec = await invitationsApi.create(body)
    if (gen === generation) items.value = [summaryOf(rec), ...items.value.filter((item) => item.id !== rec.id)]
    return rec
  }

  /** Delete (DELETE /invitations/{id}); a 404 means it is already gone. Throws other ApiErrors. */
  async function remove(id: string): Promise<void> {
    const gen = generation
    try {
      await invitationsApi.remove(id)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    clearRecoveries({ invitationId: id })
    if (gen !== generation) return
    items.value = items.value.filter((item) => item.id !== id)
    // The open invitation no longer exists: drop it from the editor.
    const open = useInvitationStore()
    if (open.invitationId === id) open.reset()
  }

  function reset() {
    generation++
    items.value = []
    loadState.value = 'idle'
    loadError.value = null
    pending = null
  }

  const auth = useAuthStore()
  watch(
    () => auth.user?.id ?? null,
    (id, previous) => {
      if (id !== previous) reset()
    },
    { flush: 'sync' },
  )

  return { items, byId, loadState, loadError, load, ensureLoaded, latestOf, create, remove, reset }
})
