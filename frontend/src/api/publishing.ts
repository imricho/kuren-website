/**
 * Publishing API (docs/api/weddings.md, CMS v2.0 "Publishing").
 *
 *  - publish / unpublish: owner routes; publish carries If-Match like content writes
 *    (409 edit_conflict when stale; 422 publish_blocked with
 *    `details = [{ section, field, code, message }]`).
 *  - getPublic: guest route, no auth/cookies; 404 for unknown or unpublished slugs.
 */
import type { WeddingDraft } from '@/features/wedding/draft'
import type { WeddingLocale } from '@/features/wedding/types'

import { ApiError, parseRevisionEtag, request, requestWithHeaders, revisionEtag, toApiError } from './http'
import type { IfMatch, Revisioned, WeddingRead } from './weddings'

/** Published snapshot for guests; `content` is in DRAFT shape (render with toPreviewContent(..., { mode: 'public' })). */
export interface PublicInvitation {
  themeId: string | null
  locale: WeddingLocale
  content: WeddingDraft
  publishedAt: string
}

const w = (id: string) => `/weddings/${encodeURIComponent(id)}`

export const publishingApi = {
  /** → the updated record; `revision` from ETag when the server sends one. */
  async publish(id: string, ifMatch: IfMatch): Promise<Revisioned<WeddingRead>> {
    const headers = ifMatch === null ? undefined : { 'If-Match': revisionEtag(ifMatch) }
    const res = await requestWithHeaders<WeddingRead>(`${w(id)}/publish`, { method: 'POST', headers })
    return { data: res.data, revision: parseRevisionEtag(res.headers.get('ETag')) }
  },
  unpublish: (id: string) => request<WeddingRead>(`${w(id)}/unpublish`, { method: 'POST' }),
  /** Guest read: never sends cookies (the public router doesn't use them). */
  async getPublic(slug: string): Promise<PublicInvitation> {
    let response: Response
    try {
      response = await fetch(`/api/v1/public/weddings/${encodeURIComponent(slug)}`, { credentials: 'omit', cache: 'no-cache', headers: { Accept: 'application/json' } })
    } catch {
      throw new ApiError(0, 'network_error', 'Unable to reach the server. Check your connection.')
    }
    if (!response.ok) throw await toApiError(response)
    return (await response.json()) as PublicInvitation
  },
}
