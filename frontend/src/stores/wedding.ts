/**
 * The signed-in couple's wedding: the record (theme, language, status) and the
 * SAVED draft content. Every write is pessimistic: the local copy only changes
 * when the server responds, and then it is replaced by the server's version.
 *
 * Forms keep their own working copies (see features/cms/composables/useSectionDraft)
 * and register whether they have unsaved changes here, so navigation guards and
 * the section nav can see them.
 */
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import { ApiError } from '@/api/http'
import { weddingsApi, type WeddingRead } from '@/api/weddings'
import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { getTheme } from '@/features/themes/core/registry'
import { isSelectable } from '@/features/themes/core/types'
import { computeCompleteness } from '@/features/wedding/completeness'
import {
  normalizeDraft,
  toPreviewContent,
  type CollectionItems,
  type CollectionName,
  type NewItem,
  type SectionName,
  type SectionPayloads,
  type WeddingDraft,
} from '@/features/wedding/draft'
import type { WeddingLocale } from '@/features/wedding/types'

import { useAuthStore } from './auth'

export type WeddingLoadState = 'idle' | 'loading' | 'ready' | 'error' | 'none'

/** Theme picked before the CMS existed (Workstream 2), kept in this browser only. */
export const LEGACY_THEME_KEY = 'kuren.selectedThemeId'

function readLegacyTheme(): string | null | undefined {
  try {
    return localStorage.getItem(LEGACY_THEME_KEY)
  } catch {
    return undefined
  }
}
function removeLegacyTheme() {
  try {
    localStorage.removeItem(LEGACY_THEME_KEY)
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}
/** Canonical id for a stored value if it is still selectable, else null. */
function selectableId(value: string | null | undefined): string | null {
  const theme = getTheme(value)
  return theme && isSelectable(theme) ? theme.id : null
}

/** Thrown when a request finishes after the store was reset (the user changed). */
export class StaleError extends Error {
  constructor() {
    super('The signed-in user changed; this result was discarded.')
    this.name = 'StaleError'
  }
}

export const useWeddingStore = defineStore('wedding', () => {
  const { locale: uiLocale } = useAppLocale()

  const record = ref<WeddingRead | null>(null)
  const content = ref<WeddingDraft | null>(null)
  const loadState = ref<WeddingLoadState>('idle')
  const loadError = ref<string | null>(null)
  let pending: Promise<void> | null = null
  /**
   * Bumped by reset(). Every async operation captures it and drops its result if
   * it changed meanwhile, so a request started for one user can never write
   * data after sign-out or into another user's session.
   */
  let generation = 0
  /** Throw if a reset happened since `gen` was captured. */
  function assertCurrent(gen: number) {
    if (gen !== generation) throw new StaleError()
  }

  // --- Unsaved-changes registry ------------------------------------------------
  const dirty = reactive(new Map<string, boolean>())
  function setDirty(key: string, value: boolean) {
    if (value) dirty.set(key, true)
    else dirty.delete(key)
  }
  const anyDirty = computed(() => dirty.size > 0)
  /** True if any registered draft whose key is `section` or starts with `section:` is dirty. */
  const isSectionDirty = (section: string) =>
    [...dirty.keys()].some((k) => k === section || k.startsWith(`${section}:`))

  // --- Getters ---------------------------------------------------------------
  const themeId = computed(() => record.value?.themeId ?? null)
  const completeness = computed(() => computeCompleteness(content.value, themeId.value))
  const preview = computed(() =>
    content.value ? toPreviewContent(content.value, uiLocale.value) : null,
  )
  const previewContent = computed(() => preview.value?.content ?? null)
  const previewMissing = computed(() => preview.value?.missing ?? [])

  // --- Loading -----------------------------------------------------------------
  async function fetchOrCreate(): Promise<WeddingRead> {
    try {
      return await weddingsApi.me()
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err
    }
    // First visit: create the wedding, carrying over a theme chosen before the CMS existed.
    const legacy = selectableId(readLegacyTheme())
    try {
      // New websites default to Bahasa Indonesia; the couple can switch it later.
      return await weddingsApi.create(legacy ? { themeId: legacy, locale: 'id' } : { locale: 'id' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return weddingsApi.me() // created in another tab
      if (err instanceof ApiError && err.status === 422 && legacy) return weddingsApi.create({ locale: 'id' })
      throw err
    }
  }

  async function load() {
    const gen = generation
    loadState.value = 'loading'
    loadError.value = null
    try {
      const rec = await fetchOrCreate()
      assertCurrent(gen)
      const draft = await weddingsApi.getContent(rec.id)
      assertCurrent(gen)
      record.value = rec
      content.value = normalizeDraft({ ...draft, locale: draft.locale ?? rec.locale })
      loadState.value = 'ready'
    } catch (err) {
      if (err instanceof StaleError || gen !== generation) return
      if (err instanceof ApiError && err.status === 401) {
        loadState.value = 'none'
      } else {
        loadState.value = 'error'
        loadError.value = err instanceof Error ? err.message : String(err)
      }
      return
    }
    await migrateLegacyTheme()
  }

  function startLoad(): Promise<void> {
    const p: Promise<void> = load().finally(() => {
      if (pending === p) pending = null
    })
    pending = p
    return p
  }

  /** Load the wedding once (deduplicated across concurrent callers). Never throws. */
  function ensureLoaded(): Promise<void> {
    if (loadState.value === 'ready') return Promise.resolve()
    return pending ?? startLoad()
  }

  /** Retry after an error. */
  function reload(): Promise<void> {
    return pending ?? startLoad()
  }

  /**
   * One-time migration of the Workstream 2 localStorage theme:
   *  - wedding has no theme and the stored id is selectable → PATCH it, then remove the key;
   *  - wedding already has a theme, or the stored id is invalid → remove the key;
   *  - PATCH fails → keep the key so the next load retries.
   */
  async function migrateLegacyTheme() {
    const stored = readLegacyTheme()
    if (stored === null || stored === undefined || !record.value) return
    const id = selectableId(stored)
    if (!id || record.value.themeId !== null) {
      removeLegacyTheme()
      return
    }
    const gen = generation
    try {
      await setTheme(id)
      if (gen === generation) removeLegacyTheme()
    } catch {
      // Keep the key; we'll try again next time.
    }
  }

  function requireRecord(): WeddingRead {
    if (!record.value || !content.value) throw new Error('Wedding is not loaded')
    return record.value
  }

  /** Run a write for the current wedding; drop its result if the user changed meanwhile. */
  async function write<T>(run: (rec: WeddingRead) => Promise<T>, apply: (result: T) => void): Promise<T> {
    const gen = generation
    const result = await run(requireRecord())
    assertCurrent(gen)
    apply(result)
    return result
  }

  // --- Settings ------------------------------------------------------------------
  async function setTheme(id: string | null) {
    await write(
      (rec) => weddingsApi.update(rec.id, { themeId: id }),
      (updated) => (record.value = updated),
    )
  }

  async function setLocale(locale: WeddingLocale) {
    await write(
      (rec) => weddingsApi.update(rec.id, { locale }),
      (updated) => {
        record.value = updated
        if (content.value) content.value = { ...content.value, locale: updated.locale }
      },
    )
  }

  // --- Sections ------------------------------------------------------------------
  async function saveSection<S extends SectionName>(section: S, body: SectionPayloads[S]) {
    return write((rec) => weddingsApi.putSection(rec.id, section, body), (saved) => applySection(section, saved))
  }

  function applySection<S extends SectionName>(section: S, saved: SectionPayloads[S]) {
    const c = content.value!
    switch (section) {
      case 'story':
        content.value = { ...c, story: { ...(saved as SectionPayloads['story']), timeline: c.story.timeline } }
        break
      case 'gallery':
        content.value = { ...c, gallery: { ...(saved as SectionPayloads['gallery']), images: c.gallery.images } }
        break
      case 'couple': {
        const couple = saved as SectionPayloads['couple']
        content.value = { ...c, couple: { groom: { ...couple.groom }, bride: { ...couple.bride } } }
        break
      }
      case 'rsvp': {
        const rsvp = saved as SectionPayloads['rsvp']
        content.value = { ...c, rsvp: { ...rsvp, enabled: rsvp.enabled ?? true } }
        break
      }
      default:
        content.value = { ...c, [section]: { ...saved } }
    }
  }

  // --- Collections ---------------------------------------------------------------
  function getList<C extends CollectionName>(collection: C): CollectionItems[C][] {
    const c = content.value!
    if (collection === 'stories') return c.story.timeline as CollectionItems[C][]
    if (collection === 'events') return c.events as CollectionItems[C][]
    return c.gallery.images as CollectionItems[C][]
  }
  function setList<C extends CollectionName>(collection: C, items: CollectionItems[C][]) {
    const c = content.value!
    if (collection === 'stories') content.value = { ...c, story: { ...c.story, timeline: items as CollectionItems['stories'][] } }
    else if (collection === 'events') content.value = { ...c, events: items as CollectionItems['events'][] }
    else content.value = { ...c, gallery: { ...c.gallery, images: items as CollectionItems['gallery'][] } }
  }

  /** Items of a collection in display order (saved state). */
  function items<C extends CollectionName>(collection: C): CollectionItems[C][] {
    return content.value ? getList(collection) : []
  }

  function createItem<C extends CollectionName>(collection: C, body: NewItem<C>) {
    return write(
      (rec) => weddingsApi.createItem(rec.id, collection, body),
      (created) => setList(collection, [...getList(collection), created]),
    )
  }

  function updateItem<C extends CollectionName>(collection: C, itemId: string, body: NewItem<C>) {
    return write(
      (rec) => weddingsApi.updateItem(rec.id, collection, itemId, body),
      (saved) => setList(collection, getList(collection).map((item) => (item.id === itemId ? saved : item))),
    )
  }

  async function deleteItem(collection: CollectionName, itemId: string) {
    await write(
      (rec) => weddingsApi.deleteItem(rec.id, collection, itemId),
      () => setList(collection, getList(collection).filter((item) => item.id !== itemId)),
    )
  }

  function reorder<C extends CollectionName>(collection: C, ids: string[]) {
    return write(
      (rec) => weddingsApi.reorderItems(rec.id, collection, ids),
      (ordered) => setList(collection, ordered),
    )
  }

  /** Re-fetch one collection from the server (e.g. after a stale reorder). */
  function refreshCollection<C extends CollectionName>(collection: C) {
    return write(
      (rec) => weddingsApi.listItems(rec.id, collection),
      (list) => setList(collection, list),
    )
  }

  /** Forget everything and drop the results of any request still in flight. */
  function reset() {
    generation++
    record.value = null
    content.value = null
    loadState.value = 'idle'
    loadError.value = null
    dirty.clear()
    pending = null
  }

  // Whoever is signed in owns this data: reset whenever the user changes
  // (sign-out, sign-in as someone else, register, session expiry).
  const auth = useAuthStore()
  const toast = useToast()
  watch(
    () => auth.user?.id ?? null,
    (id, previous) => {
      if (id === previous) return
      reset()
      toast.clear()
    },
    { flush: 'sync' },
  )

  return {
    record,
    content,
    loadState,
    loadError,
    themeId,
    completeness,
    previewContent,
    previewMissing,
    anyDirty,
    dirty,
    setDirty,
    isSectionDirty,
    ensureLoaded,
    reload,
    migrateLegacyTheme,
    setTheme,
    setLocale,
    saveSection,
    items,
    createItem,
    updateItem,
    deleteItem,
    reorder,
    refreshCollection,
    reset,
  }
})
