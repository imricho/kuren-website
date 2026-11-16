/**
 * The signed-in couple's wedding: the record (theme, language, status), the
 * SAVED draft content and the live (unsaved) edits on top of it.
 *
 * - `content` is only ever replaced by what the server returned (pessimistic).
 * - Forms keep their own working copies (features/cms/composables/useSectionDraft),
 *   register whether they are dirty, publish their payload as a live draft
 *   (`setLiveDraft`) and register an autosave handle. `livePreviewContent` is the
 *   saved content overlaid with those live drafts.
 * - Content writes are serialised (one at a time, in order) and carry the last
 *   seen content `revision` as `If-Match`; a 409 `edit_conflict` puts the editor
 *   in the Conflict state (`reloadLatest` / `keepMine`).
 * - `saveState` aggregates every autosaver for the save status indicator.
 */
import { defineStore } from 'pinia'
import { computed, onScopeDispose, reactive, ref, shallowReactive, watch } from 'vue'

import { ApiError } from '@/api/http'
import { weddingsApi, type IfMatch, type Revisioned, type WeddingRead } from '@/api/weddings'
import { publishingApi } from '@/api/publishing'
import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
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
import { issueFromServer, publishChecks, type PublishIssue, type ServerPublishDetail } from '@/features/wedding/publishChecks'

import { useAuthStore } from './auth'
import { applyLivePatches, type LivePatch } from './liveDraft'

export type { LivePatch } from './liveDraft'

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

/** Aggregate save status shown by <SaveStatus> (docs/ux/live-editor.md §5). */
export type SaveState = 'saved' | 'unsaved' | 'invalid' | 'saving' | 'failed' | 'offline' | 'conflict'

/** Save status of one autosaved working copy. */
export type KeySaveState = 'idle' | 'pending' | 'invalid' | 'saving' | 'retrying' | 'failed' | 'offline' | 'conflict'

/** What an autosaved working copy lets the store do (see useSectionDraft). */
export interface AutosaveHandle {
  /** Save now if dirty, skipping the debounce; waits for an in-flight save. True when nothing is left to save. */
  flush(): Promise<boolean>
  /** Manual Retry: reset the retry budget and save now. */
  retry(): Promise<boolean>
  /** The connection is back: save if there is something to save. */
  resume(): void
  /** Reload latest: drop local edits and adopt the saved state. */
  reload(): void
}

/** Polite announcement for the save status region; `seq` changes on every announcement. */
export interface SaveAnnouncement {
  kind: 'saved' | 'invalid' | 'failed' | 'offline' | 'conflict'
  seq: number
}

/** Publishing status shown by the publish page and editor header chip. */
export type PublishState = 'draft' | 'published' | 'unpublished_changes' | 'publishing' | 'failed'

/** Outcome of `publish()`. */
export type PublishResult = 'published' | 'blocked' | 'conflict' | 'unsaved' | 'failed' | 'busy'

/** Polite announcement for publish/unpublish outcomes; `seq` changes on every announcement. */
export interface PublishAnnouncement {
  kind: 'published' | 'updated' | 'failed' | 'blocked' | 'unpublished' | 'unpublish_failed'
  count?: number
  seq: number
}

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

export const useWeddingStore = defineStore('wedding', () => {
  const { locale: uiLocale, t } = useAppLocale()
  const confirmDialog = useConfirm()

  const record = ref<WeddingRead | null>(null)
  const content = ref<WeddingDraft | null>(null)
  /** Last content revision seen (from ETag); sent as If-Match on every content write. */
  const revision = ref<number | null>(null)
  /** Set by a 409 edit_conflict: autosave pauses until reloadLatest() or keepMine(). */
  const conflict = ref<{ currentRevision: number } | null>(null)
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

  // --- Live drafts (in-progress edits shown by the live preview) -------------------
  /** Working-copy payloads by draft key ("opening", "events:<id>", "events:new", …). Only dirty drafts are present. */
  const liveDrafts = shallowReactive(new Map<string, readonly LivePatch[]>())
  /** Publish (or with null, withdraw) a working copy's payload. Cheap: stores the reference only. */
  function setLiveDraft(key: string, patch: LivePatch | readonly LivePatch[] | null) {
    if (patch === null) liveDrafts.delete(key)
    else liveDrafts.set(key, Array.isArray(patch) ? (patch as readonly LivePatch[]) : [patch as LivePatch])
  }
  /** Saved content overlaid with live drafts (shallow copies along changed paths only). */
  const liveDraft = computed<WeddingDraft | null>(() =>
    content.value ? applyLivePatches(content.value, liveDrafts.values()) : null,
  )
  const livePreview = computed(() => (liveDraft.value ? toPreviewContent(liveDraft.value, uiLocale.value) : null))
  /** What the live editor preview renders: saved content plus in-progress (unsaved) edits. */
  const livePreviewContent = computed(() => livePreview.value?.content ?? null)
  /** Placeholders the live preview had to fill in. */
  const livePreviewMissing = computed(() => livePreview.value?.missing ?? [])

  // --- Autosave status -------------------------------------------------------------
  const online = ref(browserOnline())
  /** A request failed with a network error while the browser claimed to be online. */
  const networkDown = ref(false)
  const offline = computed(() => !online.value || networkDown.value)
  /** Content writes queued or in flight (autosaves and explicit add/delete/reorder). */
  const pendingWrites = ref(0)
  const keyStates = reactive(new Map<string, KeySaveState>())
  const savers = new Map<string, AutosaveHandle>()
  /** Saves started by a working copy that has since gone away (e.g. an item editor closed mid-debounce). */
  const detachedSaves = new Set<Promise<unknown>>()

  function setKeyState(key: string, state: KeySaveState) {
    if (state === 'idle') keyStates.delete(key)
    else keyStates.set(key, state)
  }
  /** Register a working copy's autosave; returns the unregister function. */
  function registerAutosave(key: string, handle: AutosaveHandle): () => void {
    savers.set(key, handle)
    return () => {
      if (savers.get(key) !== handle) return
      savers.delete(key)
      keyStates.delete(key)
    }
  }
  function trackDetachedSave(p: Promise<unknown>) {
    const tracked = p.catch(() => undefined).finally(() => detachedSaves.delete(tracked))
    detachedSaves.add(tracked)
  }

  const saveState = computed<SaveState>(() => {
    if (conflict.value) return 'conflict'
    const states = [...keyStates.values()]
    if (offline.value && (anyDirty.value || states.includes('offline'))) return 'offline'
    if (states.includes('failed')) return 'failed'
    if (pendingWrites.value > 0 || states.includes('saving') || states.includes('retrying')) return 'saving'
    if (states.includes('offline')) return 'offline'
    // Autosave held back by invalid fields: say so, instead of a reassuring "Unsaved".
    if (states.includes('invalid')) return 'invalid'
    if (anyDirty.value) return 'unsaved'
    return 'saved'
  })
  /**
   * True while leaving would lose something: any working copy with unsaved edits
   * (Unsaved, Failed, Offline, Conflict) or a write still in flight (Saving).
   */
  const hasUnsavedWork = computed(() => anyDirty.value || pendingWrites.value > 0)

  const announcement = ref<SaveAnnouncement | null>(null)
  let announceSeq = 0
  function announce(kind: SaveAnnouncement['kind']) {
    announcement.value = { kind, seq: ++announceSeq }
  }
  // One announcement per event, never per keystroke: problems when they start,
  // "invalid" once per streak (typing flips it back to Unsaved until the next pause),
  // and "Saved" when an automatic save recovers from a problem.
  let invalidAnnounced = false
  watch(saveState, (state, previous) => {
    if (state === previous) return
    if (state === 'failed' || state === 'offline' || state === 'conflict') announce(state)
    else if (state === 'invalid' && !invalidAnnounced) {
      invalidAnnounced = true
      announce('invalid')
    } else if (state === 'saved' && (previous === 'failed' || previous === 'offline' || previous === 'invalid')) announce('saved')
    if (state === 'saved') invalidAnnounced = false
  })

  async function settleDetached() {
    while (detachedSaves.size) await Promise.all([...detachedSaves])
  }

  /**
   * "Save now" / Ctrl+S / route leave: flush every autosave immediately. True when
   * everything is saved (a new item that hasn't been added yet still counts as unsaved).
   */
  async function saveNow(options: { announce?: boolean } = {}): Promise<boolean> {
    const results = await Promise.all([...savers.values()].map((h) => h.flush()))
    await settleDetached()
    const ok = results.every(Boolean) && !conflict.value && !anyDirty.value
    if (ok && options.announce) announce('saved')
    return ok
  }

  /** Flush one working copy's autosave (e.g. before its item editor closes). True when it is saved. */
  async function flushDraft(key: string): Promise<boolean> {
    const handle = savers.get(key)
    return handle ? handle.flush() : !dirty.has(key)
  }

  /** Manual Retry after Failed: every autosave gets a fresh retry budget and saves now. */
  async function retry(): Promise<boolean> {
    networkDown.value = false
    const results = await Promise.all([...savers.values()].map((h) => h.retry()))
    const ok = results.every(Boolean) && !conflict.value
    if (ok) announce('saved')
    return ok
  }

  function resumeAutosaves() {
    for (const h of savers.values()) h.resume()
  }

  /** Conflict → "Keep mine": adopt the server's revision and save our working copies over it. */
  async function keepMine(options: { confirm?: boolean } = {}): Promise<boolean> {
    if (!conflict.value) return true
    // Overwriting the other device's version cannot be undone (WCAG 3.3.4): confirm first.
    if (options.confirm !== false) {
      const ok = await confirmDialog.ask({
        title: t('keepMineTitle'),
        message: t('keepMineBody'),
        confirmLabel: t('keepMine'),
        cancelLabel: t('cancel'),
        tone: 'danger',
      })
      if (!ok || !conflict.value) return false
    }
    revision.value = conflict.value.currentRevision
    conflict.value = null
    return saveNow({ announce: true })
  }

  /** Conflict → "Reload latest": after confirming, re-fetch content and drop local working copies. */
  async function reloadLatest(options: { confirm?: boolean } = {}): Promise<boolean> {
    if (options.confirm !== false) {
      const ok = await confirmDialog.ask({
        title: t('reloadLatestTitle'),
        message: t('reloadLatestBody'),
        confirmLabel: t('reloadLatest'),
        cancelLabel: t('keepEditing'),
        tone: 'danger',
      })
      if (!ok) return false
    }
    const gen = generation
    const rec = record.value
    if (!rec) return false
    try {
      const res = await weddingsApi.getContent(rec.id)
      assertCurrent(gen)
      content.value = normalizeDraft({ ...res.data, locale: res.data.locale ?? rec.locale })
      if (res.revision !== null) revision.value = res.revision
      else if (conflict.value) revision.value = conflict.value.currentRevision
      conflict.value = null
      networkDown.value = false
      for (const h of savers.values()) h.reload() // each withdraws its live draft as it resyncs
      return true
    } catch (err) {
      if (!(err instanceof StaleError)) noteFailure(err)
      return false
    }
  }

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
      const { data: draft, revision: rev } = await weddingsApi.getContent(rec.id)
      assertCurrent(gen)
      record.value = rec
      content.value = normalizeDraft({ ...draft, locale: draft.locale ?? rec.locale })
      revision.value = rev ?? (typeof rec.revision === 'number' ? rec.revision : null)
      conflict.value = null
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

  /** Remember what a failed request tells us about the connection or a conflict. */
  function noteFailure(err: unknown) {
    if (!(err instanceof ApiError)) return
    if (err.conflictRevision !== null) conflict.value = { currentRevision: err.conflictRevision }
    else if (err.status === 409 && err.code === 'edit_conflict') conflict.value = { currentRevision: revision.value ?? 0 }
    if (err.isNetworkError) networkDown.value = true
  }

  /** Content writes run one at a time, so each one carries the newest revision as If-Match. */
  let writeQueue: Promise<unknown> = Promise.resolve()

  /**
   * Run a content write (If-Match = current revision), adopt the revision from
   * its ETag and apply the result. Serialised with every other content write.
   */
  function contentWrite<T>(
    run: (rec: WeddingRead, ifMatch: IfMatch) => Promise<Revisioned<T>>,
    apply: (result: T) => void,
  ): Promise<T> {
    const gen = generation
    pendingWrites.value++
    const task = writeQueue
      .then(async () => {
        assertCurrent(gen)
        const rec = requireRecord()
        let res: Revisioned<T>
        try {
          res = await run(rec, revision.value)
        } catch (err) {
          if (gen === generation) noteFailure(err)
          throw err
        }
        assertCurrent(gen)
        networkDown.value = false
        if (res.revision !== null) revision.value = res.revision
        apply(res.data)
        return res.data
      })
      .finally(() => {
        if (gen === generation) pendingWrites.value--
      })
    writeQueue = task.catch(() => undefined)
    return task
  }


  // --- Publishing (docs/api/weddings.md "Publishing") ------------------------------
  const publishing = ref(false)
  const publishFailed = ref(false)
  /** Blocking issues the server reported on the last publish attempt (422 publish_blocked). */
  const publishIssues = ref<PublishIssue[]>([])
  const publishAnnouncement = ref<PublishAnnouncement | null>(null)
  let publishSeq = 0
  function announcePublish(kind: PublishAnnouncement['kind'], count?: number) {
    publishAnnouncement.value = { kind, count, seq: ++publishSeq }
  }
  const publication = computed(() => (record.value?.status === 'published' ? record.value.publication ?? null : null))
  const isPublished = computed(() => publication.value !== null)
  /** Live publication differs from the saved draft (content revision or theme). */
  const hasUnpublishedChanges = computed(() => {
    const pub = publication.value
    if (!pub || !record.value) return false
    if (revision.value !== null && revision.value !== pub.revision) return true
    if ((record.value.themeId ?? null) !== (pub.themeId ?? null)) return true
    return revision.value === null ? record.value.hasUnpublishedChanges === true : false
  })
  const publishState = computed<PublishState>(() => {
    if (publishing.value) return 'publishing'
    if (publishFailed.value) return 'failed'
    if (isPublished.value) return hasUnpublishedChanges.value ? 'unpublished_changes' : 'published'
    return 'draft'
  })
  const publicUrl = computed(() => {
    const slug = record.value?.slug
    if (!slug) return null
    const origin = typeof location !== 'undefined' ? location.origin : ''
    return `${origin}/i/${encodeURIComponent(slug)}`
  })
  /** Client checklist over the SAVED draft (mirrors the server's blocking rules + warnings). */
  const publishChecklist = computed<PublishIssue[]>(() =>
    content.value ? publishChecks(content.value, { themeId: themeId.value, locale: uiLocale.value }) : [],
  )
  // Server issues describe an older revision; drop them once content changes.
  watch(revision, () => (publishIssues.value = []))

  /**
   * Publish (or publish an update): save everything first, refuse unless Saved,
   * then POST /publish through the content write queue so If-Match is current.
   */
  async function publish(): Promise<PublishResult> {
    if (publishing.value) return 'busy'
    const gen = generation
    publishing.value = true
    publishFailed.value = false
    const wasPublished = isPublished.value
    try {
      const saved = await saveNow()
      if (gen !== generation) return 'failed'
      if (!saved || saveState.value !== 'saved') return conflict.value ? 'conflict' : 'unsaved'
      await contentWrite(
        (rec, ifMatch) => publishingApi.publish(rec.id, ifMatch),
        (updated) => (record.value = updated),
      )
      publishIssues.value = []
      announcePublish(wasPublished ? 'updated' : 'published')
      return 'published'
    } catch (err) {
      if (err instanceof StaleError || gen !== generation) return 'failed'
      if (err instanceof ApiError && err.status === 409 && err.code === 'edit_conflict') return 'conflict'
      if (err instanceof ApiError && err.status === 422 && err.code === 'publish_blocked') {
        const details = Array.isArray(err.details) ? (err.details as ServerPublishDetail[]) : []
        publishIssues.value = details.map(issueFromServer)
        announcePublish('blocked', publishIssues.value.length)
        return 'blocked'
      }
      publishFailed.value = true
      announcePublish('failed')
      return 'failed'
    } finally {
      if (gen === generation) publishing.value = false
    }
  }

  /** Take the invitation offline (after confirming). The draft and history are kept. */
  async function unpublish(options: { confirm?: boolean } = {}): Promise<boolean> {
    if (options.confirm !== false) {
      const ok = await confirmDialog.ask({
        title: t('unpublishTitle'),
        message: t('unpublishBody'),
        confirmLabel: t('unpublishConfirm'),
        cancelLabel: t('cancel'),
        tone: 'danger',
      })
      if (!ok) return false
    }
    try {
      await write(
        (rec) => publishingApi.unpublish(rec.id),
        (updated) => (record.value = updated),
      )
      publishFailed.value = false
      announcePublish('unpublished')
      return true
    } catch (err) {
      if (err instanceof StaleError) return false
      announcePublish('unpublish_failed')
      return false
    }
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
    return contentWrite(
      (rec, ifMatch) => weddingsApi.putSection(rec.id, section, body, ifMatch),
      (saved) => applySection(section, saved),
    )
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
    return contentWrite(
      (rec, ifMatch) => weddingsApi.createItem(rec.id, collection, body, ifMatch),
      (created) => setList(collection, [...getList(collection), created]),
    )
  }

  function updateItem<C extends CollectionName>(collection: C, itemId: string, body: NewItem<C>) {
    return contentWrite(
      (rec, ifMatch) => weddingsApi.updateItem(rec.id, collection, itemId, body, ifMatch),
      (saved) => setList(collection, getList(collection).map((item) => (item.id === itemId ? saved : item))),
    )
  }

  async function deleteItem(collection: CollectionName, itemId: string) {
    await contentWrite(
      (rec, ifMatch) => weddingsApi.deleteItem(rec.id, collection, itemId, ifMatch),
      () => setList(collection, getList(collection).filter((item) => item.id !== itemId)),
    )
  }

  function reorder<C extends CollectionName>(collection: C, ids: string[]) {
    return contentWrite(
      (rec, ifMatch) => weddingsApi.reorderItems(rec.id, collection, ids, ifMatch),
      (ordered) => setList(collection, ordered),
    )
  }

  /**
   * Re-fetch one collection from the server (e.g. after a stale reorder).
   * Deliberately does NOT adopt the response revision: that would hide another
   * device's edits to other sections from the conflict check.
   */
  function refreshCollection<C extends CollectionName>(collection: C) {
    return write(
      async (rec) => (await weddingsApi.listItems(rec.id, collection)).data,
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
    revision.value = null
    conflict.value = null
    liveDrafts.clear()
    keyStates.clear()
    savers.clear()
    detachedSaves.clear()
    pendingWrites.value = 0
    writeQueue = Promise.resolve()
    networkDown.value = false
    announcement.value = null
    publishing.value = false
    publishFailed.value = false
    publishIssues.value = []
    publishAnnouncement.value = null
  }

  // Connectivity: pause autosave while offline, resume as soon as we're back.
  if (typeof window !== 'undefined') {
    const onOnline = () => {
      online.value = true
      networkDown.value = false
      resumeAutosaves()
    }
    const onOffline = () => (online.value = false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    onScopeDispose(() => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    })
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
    publish,
    unpublish,
    publishState,
    publishIssues,
    publishChecklist,
    publishAnnouncement,
    publicUrl,
    publication,
    isPublished,
    hasUnpublishedChanges,
    livePreviewContent,
    livePreviewMissing,
    liveDraft,
    setLiveDraft,
    revision,
    conflict,
    online,
    offline,
    saveState,
    hasUnsavedWork,
    announcement,
    saveNow,
    flushDraft,
    retry,
    keepMine,
    reloadLatest,
    registerAutosave,
    setKeyState,
    trackDetachedSave,
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
