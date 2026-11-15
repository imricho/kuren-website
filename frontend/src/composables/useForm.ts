import { reactive, ref } from 'vue'

import { ApiError } from '@/api/http'

export interface UseFormOptions {
  /**
   * Map an error to display messages (e.g. localized; see features/shell/apiErrors).
   * Without it, API messages are shown as the server sent them.
   */
  translateError?: (err: unknown) => { formError: string | null; fieldErrors: Record<string, string> }
}

/**
 * Shared submit/error handling for simple forms: tracks the submitting state,
 * a form-level message, and per-field messages mapped from API 422 responses.
 */
export function useForm(options: UseFormOptions = {}) {
  const submitting = ref(false)
  const formError = ref<string | null>(null)
  const fieldErrors = reactive<Record<string, string>>({})

  function reset() {
    formError.value = null
    for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  }

  async function submit(action: () => Promise<void>) {
    reset()
    submitting.value = true
    try {
      await action()
    } catch (err) {
      if (options.translateError) {
        const translated = options.translateError(err)
        Object.assign(fieldErrors, translated.fieldErrors)
        formError.value = translated.formError
      } else if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) fieldErrors[fe.field] = capitalise(fe.message)
        formError.value = err.fieldErrors.length ? null : err.message
      } else {
        formError.value = 'Something went wrong. Please try again.'
      }
    } finally {
      submitting.value = false
    }
  }

  return { submitting, formError, fieldErrors, submit, reset }
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
