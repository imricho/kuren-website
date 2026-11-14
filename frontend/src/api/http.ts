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

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

const API_BASE = '/api/v1'

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
  const details = Array.isArray(body.error?.details) ? (body.error.details as FieldError[]) : []
  return new ApiError(
    response.status,
    body.error?.code ?? 'http_error',
    body.error?.message ?? 'Something went wrong. Please try again.',
    details,
  )
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Unable to reach the server. Check your connection.')
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
