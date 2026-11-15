/**
 * Working copy of one editable section (or one collection item).
 *
 * - `form` is a structuredClone of the saved state, so typing never touches the store;
 * - `isDirty` compares the normalised payloads (deep), and is registered in the
 *   wedding store under `key` so guards and the section nav can see it;
 * - `save()` runs client format checks, then saves via `useForm` (server 422 field
 *   errors are mapped to the same field paths), toasts the result and resyncs;
 * - `discard()` returns to the saved state; `resync()` adopts new saved state.
 */
import { computed, isProxy, nextTick, onScopeDispose, ref, toRaw, watch, type Ref } from 'vue'

import { ApiError } from '@/api/http'
import { useAppLocale } from '@/composables/useAppLocale'
import { useForm } from '@/composables/useForm'
import { useToast } from '@/composables/useToast'
import { StaleError, useWeddingStore } from '@/stores/wedding'

import { fieldId, issueMessage, type FieldIssue } from '../validation'

export interface SectionDraftOptions<F, P> {
  /** Dirty-registry key, e.g. "opening" or "events:<id>". */
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
  /** Map a server 422 field path to a form field path. */
  mapServerField?: (field: string) => string
  /** Prefix for field DOM ids (see `fieldId`). */
  idScope?: string
  successMessage?: () => string
  /** Toast text when saving fails for a reason other than field errors. */
  failureMessage?: () => string
}

export interface ErrorEntry {
  field: string
  id: string
  message: string
}

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

export function useSectionDraft<F extends object, P>(options: SectionDraftOptions<F, P>) {
  const store = useWeddingStore()
  const toast = useToast()
  const { t } = useAppLocale()
  const { submitting, formError, fieldErrors, submit, reset } = useForm()

  /** Saved state as form values, or null once the wedding is gone (e.g. after sign-out). */
  const read = (): F | null => (store.content ? options.source() : null)

  const baseline = ref(clone(options.source())) as Ref<F>
  const form = ref(clone(baseline.value)) as Ref<F>
  /** Format errors are shown once the couple has tried to save. */
  const attempted = ref(false)

  const isDirty = computed(() => serialize(options.toPayload(form.value)) !== serialize(options.toPayload(baseline.value)))
  watch(isDirty, (dirty) => store.setDirty(options.key, dirty), { immediate: true })
  onScopeDispose(() => store.setDirty(options.key, false))

  // New saved state (e.g. another editor saved the same data): adopt it unless we have edits.
  watch(
    () => {
      const saved = read()
      return saved === null ? null : serialize(options.toPayload(saved))
    },
    (saved) => {
      if (saved !== null && !isDirty.value) resync()
    },
  )

  const clientIssues = computed(() => (options.validate ? options.validate(form.value) : []))

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

  function resync() {
    const saved = read()
    if (saved === null) return
    baseline.value = clone(saved)
    form.value = clone(baseline.value)
    attempted.value = false
    reset()
  }

  function discard() {
    form.value = clone(baseline.value)
    attempted.value = false
    reset()
  }

  /** Resolves true when saved. Never throws. */
  async function save(): Promise<boolean> {
    attempted.value = true
    if (clientIssues.value.length) {
      reset()
      focusFirstError()
      return false
    }
    let ok = false
    let message: string | undefined
    let failure: unknown = null
    const commit = (fields: Partial<F>) => {
      baseline.value = { ...baseline.value, ...clone(fields) }
    }
    await submit(async () => {
      try {
        await options.save(options.toPayload(form.value), form.value, { commit })
      } catch (err) {
        failure = err
        throw err
      }
      ok = true
      message = options.successMessage?.() // before resync, so it can use the saved form values
    })
    if (ok) {
      resync()
      if (message) toast.success(message)
      return true
    }
    if (options.mapServerField) {
      for (const [field, message] of Object.entries({ ...fieldErrors })) {
        const mapped = options.mapServerField(field)
        if (mapped !== field) {
          delete fieldErrors[field]
          fieldErrors[mapped] = message
        }
      }
    }
    if (failure instanceof StaleError) {
      // The user changed while saving; this form is about to go away.
      reset()
      return false
    }
    if (failure instanceof ApiError && failure.status === 401) {
      // Keep every edit; tell the couple how to recover without losing them.
      formError.value = t('sessionExpired')
      toast.error(t('sessionExpired'))
      return false
    }
    if (Object.keys(fieldErrors).length) {
      // The error summary and inline messages explain it; focus moves to the first field.
      focusFirstError()
      return false
    }
    if (options.failureMessage)
      toast.error(formError.value ? `${options.failureMessage()} ${formError.value}` : options.failureMessage())
    return false
  }

  return { form, isDirty, errors, errorList, submitting, formError, attempted, save, discard, resync }
}
