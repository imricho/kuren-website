/**
 * Turn API errors from the auth and profile endpoints into localized messages.
 * Server messages (Pydantic / FastAPI, English only) are never shown verbatim:
 * we map the error code and field, and fall back to a generic message.
 *
 * Error shape: backend/app/core/errors.py → ApiError { status, code, fieldErrors[{ field, message }] }.
 */
import { ApiError } from '@/api/http'
import type { AppMessageKey } from '@/composables/useAppLocale'

export type Translate = (key: AppMessageKey, vars?: Record<string, string | number>) => string
export type ErrorContext = 'login' | 'register' | 'profile'

export interface TranslatedError {
  formError: string | null
  fieldErrors: Record<string, string>
}

/** Limits from backend/app/schemas/auth.py. */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const NAME_MAX = 120

const tooLong = (message: string) => /at most|too long|max/i.test(message)

function fieldMessage(field: string, message: string, context: ErrorContext, t: Translate): string {
  if (field === 'email') return t('authErrEmailInvalid')
  if (field === 'password') {
    if (context === 'login') return tooLong(message) ? t('authErrTooLong', { max: PASSWORD_MAX }) : t('authErrPasswordRequired')
    if (tooLong(message)) return t('authErrTooLong', { max: PASSWORD_MAX })
    return t('authErrPasswordShort', { min: PASSWORD_MIN })
  }
  if (field === 'full_name') return tooLong(message) ? t('authErrTooLong', { max: NAME_MAX }) : t('authErrNameRequired')
  return t('authErrFieldInvalid')
}

/** Fields the auth/profile forms show messages for; anything else becomes a form-level message. */
const FORM_FIELDS: Record<ErrorContext, readonly string[]> = {
  login: ['email', 'password'],
  register: ['full_name', 'email', 'password'],
  profile: ['full_name'],
}

export function translateApiError(err: unknown, context: ErrorContext, t: Translate): TranslatedError {
  if (!(err instanceof ApiError)) return { formError: t('authErrGeneric'), fieldErrors: {} }

  if (err.code === 'network_error' || err.status === 0) return { formError: t('authErrNetwork'), fieldErrors: {} }
  if (err.code === 'invalid_credentials') return { formError: t('authErrInvalidCredentials'), fieldErrors: {} }
  if (err.status === 429) return { formError: t('authErrTooMany'), fieldErrors: {} }
  if (err.status === 409 && context === 'register') return { formError: null, fieldErrors: { email: t('authErrEmailTaken') } }
  if (err.status === 401 && context === 'profile') return { formError: t('authErrSessionExpired'), fieldErrors: {} }

  if (err.status === 422 && err.fieldErrors.length) {
    const fieldErrors: Record<string, string> = {}
    let unknownField = false
    for (const fe of err.fieldErrors) {
      const field = fe.field.replace(/^body\./, '')
      if (!FORM_FIELDS[context].includes(field)) {
        unknownField = true
        continue
      }
      fieldErrors[field] ??= fieldMessage(field, fe.message ?? '', context, t)
    }
    return { formError: unknownField ? t('authErrGeneric') : null, fieldErrors }
  }
  return { formError: t('authErrGeneric'), fieldErrors: {} }
}
