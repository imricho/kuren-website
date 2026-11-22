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
  /** Private token that lets this guest change THIS reply later (new replies only). */
  editToken?: string | null
  /** Set when an existing reply was changed. */
  updatedAt?: string | null
}

/** The guest's own reply, read with their private edit token. */
export interface PublicOwnReply {
  id: string
  name: string
  attendance: RsvpAttendance
  partySize: number
  email?: string
  phone?: string
  sessionIds: string[]
  answers: Record<string, string | boolean>
  message?: string
  createdAt: string
  updatedAt: string | null
}

/** Server publish dry run: exactly what `POST .../publish` would block on right now. */
export interface PublishCheck {
  revision: number
  ready: boolean
  issues: { section: string; field: string; code: string; message: string }[]
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
  /** Read-only: the blocking issues publishing would report for the saved draft. */
  check: (id: string) => request<PublishCheck>(`${invitationPath(id)}/publish-check`),
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
  /** The guest's own reply. 404 `rsvp_link_invalid` when the token is unknown. The token goes in a header, never the URL. */
  getOwnRsvp: (slug: string, token: string) =>
    guestFetch<PublicOwnReply>(`${publicPath(slug)}/rsvp/mine`, { headers: { 'X-RSVP-Token': token } }),
  /** Replace the guest's own reply (same validation as a new one). */
  updateOwnRsvp: (slug: string, token: string, body: PublicRsvpSubmission) =>
    guestFetch<PublicRsvpReceipt>(`${publicPath(slug)}/rsvp/mine`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-RSVP-Token': token },
      body: JSON.stringify(body),
    }),
}
