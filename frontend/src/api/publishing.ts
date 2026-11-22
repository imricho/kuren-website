/**
 * Publishing API (docs/architecture/invitation-engine.md §4).
 *
 *  - publish / unpublish: owner routes; publish carries If-Match like content writes
 *    (409 edit_conflict when stale; 422 publish_blocked with
 *    `details = [{ section, field, code, message }]`).
 *  - getPublic / submitRsvp: guest routes, no auth and no cookies; 404 for unknown or
 *    unpublished slugs.
 */
import type { CategoryId, VariantId } from '@/features/invitation/registry'
import type { WeddingDraft } from '@/features/wedding/draft'
import type { WeddingLocale } from '@/features/wedding/types'

import { API_BASE, ApiError, parseRevisionEtag, request, requestWithHeaders, revisionEtag, toApiError } from './http'
import { invitationPath, type IfMatch, type InvitationRead, type Revisioned, type RsvpAttendance } from './invitations'

/** Published snapshot for guests; `content` is in DRAFT shape (render with toPreviewContent(..., { mode: 'public', variant })). */
export interface PublicInvitation {
  /** Absent on servers that predate the engine (= wedding / wedding_ceremony). */
  category?: CategoryId
  variant?: VariantId
  themeId: string | null
  locale: WeddingLocale
  timezone?: string
  content: WeddingDraft
  publishedAt: string
}

/** `POST /public/invitations/{slug}/rsvp` body. `website` is the honeypot and must stay empty. */
export interface PublicRsvpSubmission {
  name: string
  attendance: RsvpAttendance
  partySize: number
  email?: string
  phone?: string
  sessionIds?: string[]
  answers?: Record<string, string | boolean>
  message?: string
  guestLabel?: string
  website: ''
}

export interface PublicRsvpReceipt {
  id: string
  attendance: RsvpAttendance
  partySize: number
  confirmationMessage: string | null
}

const publicPath = (slug: string) => `${API_BASE}/public/invitations/${encodeURIComponent(slug)}`

/** Guest fetch: never sends or stores cookies. */
async function guestFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'omit', cache: 'no-cache', ...init, headers: { Accept: 'application/json', ...init.headers } })
  } catch {
    throw new ApiError(0, 'network_error', 'Unable to reach the server. Check your connection.')
  }
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as T
}

export const publishingApi = {
  /** → the updated record; `revision` from ETag when the server sends one. */
  async publish(id: string, ifMatch: IfMatch): Promise<Revisioned<InvitationRead>> {
    const headers = ifMatch === null ? undefined : { 'If-Match': revisionEtag(ifMatch) }
    const res = await requestWithHeaders<InvitationRead>(`${invitationPath(id)}/publish`, { method: 'POST', headers })
    return { data: res.data, revision: parseRevisionEtag(res.headers.get('ETag')) }
  },
  unpublish: (id: string) => request<InvitationRead>(`${invitationPath(id)}/unpublish`, { method: 'POST' }),
  getPublic: (slug: string) => guestFetch<PublicInvitation>(publicPath(slug)),
  /**
   * Guest RSVP. Errors: 422 `rsvp_closed` / validation, 409 `capacity_reached`, 429 rate limited.
   */
  submitRsvp: (slug: string, body: PublicRsvpSubmission) =>
    guestFetch<PublicRsvpReceipt>(`${publicPath(slug)}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}
