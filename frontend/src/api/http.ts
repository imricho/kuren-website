/**
 * Minimal fetch wrapper for the platform API.
 *
 * Requests are same-origin (`/api/...`, proxied by Vite in development), so
 * the httpOnly session cookie is sent automatically and never touched by JS.
 */

export interface FieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  /** Raw `error.details` when it is not a field-error list (e.g. `{ currentRevision }` on 409 edit_conflict). */
  readonly details: unknown

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = [], details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.details = details
  }

  /** The request never reached the server (offline, DNS, CORS, connection reset). */
  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** 409 edit_conflict: someone else saved content since our revision. */
  get conflictRevision(): number | null {
    if (this.status !== 409 || this.code !== 'edit_conflict') return null
    const rev = (this.details as { currentRevision?: unknown } | undefined)?.currentRevision
    return typeof rev === 'number' && Number.isInteger(rev) ? rev : null
  }
}

export const API_BASE = '/api/v1'

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody = {}
  try {
    body = (await response.json()) as ErrorBody
  } catch {
    // Non-JSON error (e.g. proxy failure); fall through to a generic message.
  }
  const raw = body.error?.details
  const details = Array.isArray(raw) ? (raw as FieldError[]) : []
  return new ApiError(
    response.status,
    body.error?.code ?? 'http_error',
    body.error?.message ?? 'Something went wrong. Please try again.',
    details,
    raw,
  )
}

export interface RequestOptions {
  method?: string
  body?: unknown
  /** Extra request headers (e.g. `If-Match`). */
  headers?: Record<string, string>
}

/** A parsed response body plus the response headers callers may need (ETag). */
export interface ResponseWithHeaders<T> {
  data: T
  headers: Headers
}

/**
 * Like `request`, but also returns the response headers (used for the content
 * `ETag` / revision; see docs/api/weddings.md "Optimistic concurrency").
 */
export async function requestWithHeaders<T>(path: string, options: RequestOptions = {}): Promise<ResponseWithHeaders<T>> {
  const headers: Record<string, string> = { ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: Object.keys(headers).length ? headers : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Unable to reach the server. Check your connection.')
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return { data: undefined as T, headers: response.headers }
  return { data: (await response.json()) as T, headers: response.headers }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestWithHeaders<T>(path, options)).data
}

/**
 * Parse an entity tag holding a content revision: `"12"`, `W/"12"` or `12`.
 * Returns null when absent or not a non-negative integer.
 */
export function parseRevisionEtag(value: string | null | undefined): number | null {
  const m = value?.trim().match(/^(?:W\/)?"?(\d+)"?$/)
  return m ? Number(m[1]) : null
}

/** `If-Match` header value for a revision (`"12"`). */
export const revisionEtag = (revision: number) => `"${revision}"`
