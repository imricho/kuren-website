/**
 * Working copy of one editable section (or one collection item), with autosave.
 *
 * - `form` is a deep copy of the saved state, so typing never touches the store;
 * - `isDirty` compares the normalised payloads and is registered in the wedding
 *   store under `key` (guards, section nav);
 * - while dirty, the payload is published to the store as a live draft
 *   (`options.live`), synchronously on every change, for the live preview;
 * - autosave (default): 1000 ms after the last change, if client validation
 *   passes (otherwise the errors are shown and nothing is sent). One request in
 *   flight per key; edits made meanwhile are coalesced into one follow-up save
 *   of the newest form, and a finished save never overwrites newer edits
 *   (edit sequence numbers). Transient failures retry after 2 s, 5 s, 10 s, then
 *   the state is Failed (manual Retry). Network errors → Offline (resumes on
 *   reconnect). 409 edit_conflict → Conflict (the store pauses all autosaves).
 *   Server 422 field errors are mapped inline.
 * - `autosave: false` (the new-item form): saved only by an explicit `save()`,
 *   which ignores repeated calls while one is running (no duplicate records).
 */
import { computed, isProxy, nextTick, onScopeDispose, ref, toRaw, watch, type Ref } from 'vue'

import { ApiError } from '@/api/http'
import { useAppLocale } from '@/composables/useAppLocale'
import { useForm } from '@/composables/useForm'
import { useToast } from '@/composables/useToast'
import { StaleError, useWeddingStore, type AutosaveHandle, type KeySaveState, type LivePatch } from '@/stores/wedding'

import { fieldId, issueMessage, type FieldIssue } from '../validation'

/** Idle time after the last change before autosaving. */
export const AUTOSAVE_DEBOUNCE_MS = 1000
/** Waits before each automatic retry of a failed save; then the state is Failed. */
export const AUTOSAVE_RETRY_DELAYS_MS = [2000, 5000, 10000] as const

export interface SectionDraftOptions<F, P> {
  /** Draft key, e.g. "opening", "events:<id>" or "events:new" (dirty registry, live draft, autosave). */
  key: string
  /** Form state built from the SAVED data (re-evaluated reactively). */
  source: () => F
  toPayload: (form: F) => P
  validate?: (form: F) => FieldIssue[]
  /**
   * Persist the payload. Multi-request saves call `ctx.commit(fields)` after each
   * request that succeeded, so a later failure leaves only the unsaved part dirty.
   */
  save: (payload: P, form: F, ctx: { commit: (fields: Partial<F>) => void }) => Promise<void>
  /** How the (dirty) working copy shows in the live preview. Omit to not preview it. */
  live?: (payload: P) => LivePatch | readonly LivePatch[]
  /** Autosave after edits (default true). False = only an explicit `save()` persists (new items). */
  autosave?: boolean
  /** Map a server 422 field path to a form field path. */
  mapServerField?: (field: string) => string
  /** Prefix for field DOM ids (see `fieldId`). */
  idScope?: string
  /** Toast after an explicit (non-autosave) save, e.g. "“Akad” added". */
  successMessage?: () => string
  /** Toast when an explicit save, or a last save after the editor closed, fails for a non-field reason. */
  failureMessage?: () => string
}

export interface ErrorEntry {
  field: string
  id: string
  message: string
}

type RunMode = 'auto' | 'manual'

const serialize = (value: unknown) => JSON.stringify(value)

/** Deep copy that also unwraps Vue proxies nested anywhere in the value. */
function clone<T>(value: T): T {
  const raw = (v: unknown): unknown => {
    const r = isProxy(v) ? toRaw(v) : v
    if (Array.isArray(r)) return r.map(raw)
    if (r && typeof r === 'object') return Object.fromEntries(Object.entries(r).map(([k, x]) => [k, raw(x)]))
    return r
  }
  return structuredClone(raw(value)) as T
}

/** Failures worth retrying automatically (the request may succeed later). */
const isTransient = (err: unknown) =>
  err instanceof ApiError && (err.isNetworkError || err.status >= 500 || err.status === 408 || err.status === 429)

export function useSectionDraft<F extends object, P>(options: SectionDraftOptions<F, P>) {
  const store = useWeddingStore()
  const toast = useToast()
  const { t } = useAppLocale()
  const { submitting, formError, fieldErrors, submit, reset } = useForm()
  const autosave = options.autosave !== false

  /** Saved state as form values, or null once the wedding is gone (e.g. after sign-out). */
  const read = (): F | null => (store.content ? options.source() : null)

  const baseline = ref(clone(options.source())) as Ref<F>
  const form = ref(clone(baseline.value)) as Ref<F>
  /** Format errors are shown once a save was attempted (by autosave or by hand). */
  const attempted = ref(false)
  const saveState = ref<KeySaveState>('idle')

  const payload = computed(() => options.toPayload(form.value))
  const payloadJson = computed(() => serialize(payload.value))
  const baselineJson = computed(() => serialize(options.toPayload(baseline.value)))
  const isDirty = computed(() => payloadJson.value !== baselineJson.value)
  const clientIssues = computed(() => (options.validate ? options.validate(form.value) : []))

  function setState(next: KeySaveState) {
    saveState.value = next
    if (autosave) store.setKeyState(options.key, next)
  }

  // Dirty registry + live preview: synchronous, so the preview follows every keystroke.
  watch(isDirty, (dirty) => store.setDirty(options.key, dirty), { immediate: true, flush: 'sync' })
  const publish = () =>
    store.setLiveDraft(options.key, isDirty.value && options.live && store.content ? options.live(payload.value) : null)
  watch([payload, isDirty], publish, { immediate: true, flush: 'sync' })

  // --- Autosave engine -------------------------------------------------------------
  /** Bumped on every user edit (not on our own resyncs). */
  let editSeq = 0
  /** True while we assign `form` ourselves, so it doesn't count as an edit. */
  let internal = false
  let debounce: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  let inFlight: Promise<boolean> | null = null
  let disposed = false

  const clearDebounce = () => {
    if (debounce) clearTimeout(debounce)
    debounce = null
  }
  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
  }
  function schedule() {
    clearDebounce()
    debounce = setTimeout(() => {
      debounce = null
      void run('auto')
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  function setForm(next: F) {
    internal = true
    try {
      form.value = clone(next)
    } finally {
      internal = false
    }
  }

  watch(
    payloadJson,
    () => {
      if (internal || disposed) return
      editSeq++
      if (!autosave) return
      attempts = 0
      clearRetry()
      if (!isDirty.value) {
        clearDebounce()
        if (!inFlight) setState('idle')
        return
      }
      if (store.conflict) {
        clearDebounce()
        setState('conflict')
        return
      }
      if (!inFlight) setState('pending')
      schedule()
    },
    { flush: 'sync' },
  )

  // New saved state (e.g. another editor saved the same data): adopt it unless we have edits.
  watch(
    () => {
      const saved = read()
      return saved === null ? null : serialize(options.toPayload(saved))
    },
    (saved) => {
      if (saved !== null && !isDirty.value && !inFlight) resync()
    },
  )

  const errors = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const [field, message] of Object.entries(fieldErrors)) out[field] = message
    if (attempted.value) for (const issue of clientIssues.value) out[issue.field] ??= issueMessage(issue)
    return out
  })

  const errorList = computed<ErrorEntry[]>(() =>
    Object.entries(errors.value).map(([field, message]) => ({ field, message, id: fieldId(field, options.idScope) })),
  )

  function focusFirstError() {
    nextTick(() => {
      const first = errorList.value[0]
      if (first) document.getElementById(first.id)?.focus()
    })
  }

  function mapServerFields() {
    if (!options.mapServerField) return
    for (const [field, message] of Object.entries({ ...fieldErrors })) {
      const mapped = options.mapServerField(field)
      if (mapped !== field) {
        delete fieldErrors[field]
        fieldErrors[mapped] = message
      }
    }
  }

  /** Retry a transient failure after the next backoff delay, or give up (Failed). */
  function scheduleRetry(failure: unknown): void {
    const offlineNow = failure instanceof ApiError && failure.isNetworkError
    if (offlineNow && !store.online) {
      setState('offline') // resumes on the 'online' event
      return
    }
    if (attempts >= AUTOSAVE_RETRY_DELAYS_MS.length) {
      setState('failed')
      return
    }
    const delay = AUTOSAVE_RETRY_DELAYS_MS[attempts++]!
    setState(offlineNow ? 'offline' : 'retrying')
    retryTimer = setTimeout(() => {
      retryTimer = null
      void run('auto')
    }, delay)
  }

  /**
   * Save the current form now. 'auto' = debounce/retry/resume (never moves focus;
   * while a save is in flight it only asks for a follow-up); 'manual' = Save now,
   * Enter, Retry, route leave (waits for an in-flight save, then saves the newest
   * form; focuses the first invalid field). Resolves true when nothing is left to save.
   */
  async function run(mode: RunMode): Promise<boolean> {
    if (inFlight) {
      if (mode === 'auto' || !autosave) return false // the in-flight save's completion handles the follow-up
      while (inFlight) await inFlight
    }
    clearDebounce()
    if (!read()) return false
    if (!isDirty.value) {
      if (autosave) setState('idle')
      return true
    }
    attempted.value = true
    if (clientIssues.value.length) {
      reset()
      if (autosave) setState('invalid')
      if (mode === 'manual') focusFirstError()
      return false
    }
    if (autosave && store.conflict) {
      setState('conflict')
      return false
    }
    if (autosave && !store.online) {
      setState('offline')
      return false
    }

    clearRetry()
    const seq = editSeq
    const sentPayload = clone(payload.value)
    const sentForm = clone(form.value)
    let ok = false
    let failure: unknown = null
    const commit = (fields: Partial<F>) => {
      baseline.value = { ...baseline.value, ...clone(fields) }
    }
    if (autosave) setState('saving')
    const request = submit(async () => {
      try {
        await options.save(sentPayload, sentForm, { commit })
      } catch (err) {
        failure = err
        throw err
      }
      ok = true
    }).then(() => ok)
    inFlight = request
    await request
    inFlight = null
    if (disposed) return ok

    if (ok) return onSaved(mode, seq, sentForm)
    onFailed(mode, failure)
    return false
  }

  function onSaved(mode: RunMode, seq: number, sentForm: F): boolean | Promise<boolean> {
    attempts = 0
    const message = autosave ? undefined : options.successMessage?.() // before resync, so it can use the form values
    if (autosave) {
      const saved = read()
      if (saved) baseline.value = clone(saved)
    } else {
      baseline.value = sentForm // a created item: the form now matches what was saved
    }
    // Adopt the server's normalised copy only if nothing was typed meanwhile.
    if (editSeq === seq && autosave) setForm(baseline.value)
    attempted.value = false
    if (message) toast.success(message)
    if (!autosave) return true
    if (!isDirty.value) {
      setState('idle')
      return true
    }
    // Edits made while saving: exactly one follow-up save of the newest form.
    if (mode === 'manual') return run('manual')
    setState('pending')
    if (!debounce) void run('auto')
    return true
  }

  function onFailed(mode: RunMode, failure: unknown) {
    mapServerFields()
    if (failure instanceof StaleError) {
      // The user changed while saving; this form is about to go away.
      reset()
      if (autosave) setState('idle')
      return
    }
    if (failure instanceof ApiError && (failure.conflictRevision !== null || failure.code === 'edit_conflict')) {
      formError.value = null
      if (autosave) setState('conflict')
      else if (options.failureMessage) toast.error(options.failureMessage())
      return
    }
    if (failure instanceof ApiError && failure.status === 401) {
      // Keep every edit; tell the couple how to recover without losing them.
      formError.value = t('sessionExpired')
      if (autosave) setState('failed')
      else toast.error(t('sessionExpired'))
      return
    }
    if (Object.keys(fieldErrors).length) {
      // The error summary and inline messages explain it.
      if (autosave) setState('failed')
      if (mode === 'manual') focusFirstError()
      return
    }
    if (!autosave) {
      if (options.failureMessage)
        toast.error(formError.value ? `${options.failureMessage()} ${formError.value}` : options.failureMessage())
      return
    }
    // The save status shows Failed / Offline; no inline server text.
    formError.value = null
    if (isTransient(failure)) scheduleRetry(failure)
    else setState('failed')
  }

  function resync() {
    const saved = read()
    if (saved === null) return
    baseline.value = clone(saved)
    setForm(baseline.value)
    attempted.value = false
    reset()
  }

  /** Back to the saved state (the new-item form's Cancel). */
  function discard() {
    clearDebounce()
    clearRetry()
    setForm(baseline.value)
    attempted.value = false
    reset()
    if (autosave) setState('idle')
  }

  /** Save now (Save now button, Enter, Add). Resolves true when saved / nothing to save. Never throws. */
  function save(): Promise<boolean> {
    if (!autosave && inFlight) return inFlight.then(() => false) // a second Add while adding: ignore
    return run('manual')
  }

  const handle: AutosaveHandle = {
    flush: () => run('manual'),
    retry: () => {
      attempts = 0
      clearRetry()
      return run('manual')
    },
    resume: () => {
      if (!isDirty.value || inFlight) return
      attempts = 0
      clearRetry()
      void run('auto')
    },
    reload: () => {
      clearDebounce()
      clearRetry()
      resync()
      setState('idle')
    },
  }
  const unregister = autosave ? store.registerAutosave(options.key, handle) : () => {}

  onScopeDispose(() => {
    disposed = true
    const hadPending = debounce !== null || retryTimer !== null
    clearDebounce()
    clearRetry()
    // Closed mid-debounce (e.g. an item editor): save the last edits instead of dropping them.
    const formNow = clone(form.value)
    const dirtyNow = serialize(options.toPayload(formNow)) !== serialize(options.toPayload(baseline.value))
    const validNow = !options.validate || options.validate(formNow).length === 0
    if (autosave && hadPending && !inFlight && dirtyNow && validNow && store.content && !store.conflict && store.online) {
      store.trackDetachedSave(
        options.save(options.toPayload(formNow), formNow, { commit: () => {} }).catch((err: unknown) => {
          if (!(err instanceof StaleError) && options.failureMessage) toast.error(options.failureMessage())
          throw err
        }),
      )
    }
    unregister()
    store.setDirty(options.key, false)
    store.setLiveDraft(options.key, null)
  })

  return {
    form,
    isDirty,
    errors,
    errorList,
    submitting,
    formError,
    attempted,
    saveState,
    save,
    flush: handle.flush,
    retry: handle.retry,
    discard,
    resync,
  }
}
