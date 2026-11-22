/**
 * Typed client for the Invitation API (docs/architecture/invitation-engine.md §4).
 * All JSON is camelCase. Replaces the wedding-only client: the legacy
 * `/weddings/...` aliases still exist on the server but the app no longer calls them.
 *
 * Content routes return `Revisioned<T>` (body + revision from `ETag`); content
 * writes take the last seen revision and send it as `If-Match` (409
 * `edit_conflict` when stale). Record routes (list/create/get/update/delete) are plain.
 */
import type {
  CollectionItems,
  CollectionName,
  NewItem,
  SectionName,
  SectionPayloads,
  WeddingDraft,
} from '@/features/wedding/draft'
import type {
  CategoryDef,
  CategoryId,
  SectionConfig,
  TemplateCompatibility,
  VariantId,
} from '@/features/invitation/registry'
import type { WeddingLocale } from '@/features/wedding/types'

import { API_BASE, parseRevisionEtag, request, requestWithHeaders, revisionEtag, type RequestOptions } from './http'

export type InvitationStatus = 'draft' | 'published'

export interface InvitationPublication {
  publishedAt: string
  /** Content revision the snapshot was built from. */
  revision: number
  themeId: string | null
  /** What was published (snapshot); optional for servers that predate the engine. */
  category?: CategoryId
  variant?: VariantId
  /** Time zone / language guests see until the next publish. */
  timezone?: string | null
  locale?: WeddingLocale | null
}

/** `GET /invitations/{id}` (= the former `WeddingRead` + category, variant, title, timezone). */
export interface InvitationRead {
  id: string
  category: CategoryId
  variant: VariantId
  /** Internal name for the list (≤120); null = not named. */
  title: string | null
  /** IANA zone, default `Asia/Jakarta`. */
  timezone: string
  /** Canonical template id; null = not chosen. */
  themeId: string | null
  locale: WeddingLocale
  /** 'published' while a publication is live. */
  status: InvitationStatus
  publishedAt: string | null
  /** Content revision (optimistic concurrency); 0 for a new invitation. Record settings don't bump it. */
  revision: number
  createdAt: string
  updatedAt: string
  /** Public slug, assigned on first publish (`/i/<slug>`). */
  slug?: string | null
  /** Published and (revision ≠ publication.revision or themeId ≠ publication.themeId). */
  hasUnpublishedChanges?: boolean
  /** The live publication, or null when not published. */
  publication?: InvitationPublication | null
}

/** Row of `GET /invitations` (newest-updated first). */
export interface InvitationSummary {
  id: string
  title: string | null
  category: CategoryId
  variant: VariantId
  themeId: string | null
  status: InvitationStatus
  slug: string | null
  hasUnpublishedChanges: boolean
  /** Main event date (`opening.weddingDate`), YYYY-MM-DD. */
  eventDate: string | null
  updatedAt: string
  publishedAt: string | null
}

export interface InvitationCreate {
  category: CategoryId
  variant: VariantId
  themeId?: string | null
  title?: string | null
  locale?: WeddingLocale
  timezone?: string
  /** Sessions to start with (the wizard's choices); omitted = the variant's presets. */
  sessions?: { type: string; title?: string | null }[]
}

/** `PATCH /invitations/{id}` — category and variant are immutable. */
export interface InvitationSettings {
  title?: string | null
  themeId?: string | null
  locale?: WeddingLocale
  timezone?: string
}

export interface InvitationPreview {
  themeId: string | null
  content: WeddingDraft
}

/** `GET /invitation-types`: the registry JSON plus template compatibility. */
export interface InvitationTypes {
  categories: readonly CategoryDef[]
  variants: readonly {
    id: VariantId
    category: CategoryId
    label: { en: string; id: string }
    sections: readonly SectionConfig[]
    [extra: string]: unknown
  }[]
  templates: readonly TemplateCompatibility[]
  [extra: string]: unknown
}

/** Content accepted by PUT /content (schemaVersion and locale are optional). */
export type InvitationContentInput = Omit<WeddingDraft, 'schemaVersion' | 'locale'> &
  Partial<Pick<WeddingDraft, 'schemaVersion' | 'locale'>>

/** A content response plus the content revision from its `ETag` (null if the server sent none). */
export interface Revisioned<T> {
  data: T
  revision: number | null
}

/**
 * Revision the client last saw, sent as `If-Match`. `null` = unconditional
 * (no header), used only before any revision is known.
 */
export type IfMatch = number | null

// --- RSVP responses (owner) ------------------------------------------------------------

export type RsvpAttendance = 'attending' | 'not_attending'

export interface RsvpResponse {
  id: string
  name: string
  attendance: RsvpAttendance
  partySize: number
  email: string | null
  phone: string | null
  sessionIds: string[]
  answers: Record<string, string | boolean>
  message: string | null
  guestLabel: string | null
  createdAt: string
  /** Set when the guest changed this reply through their private link. */
  updatedAt?: string | null
  editCount?: number
  /** Another reply shares the name, email or phone: shown to the organizer, never merged. */
  possibleDuplicate?: boolean
}

export interface RsvpSummary {
  responses: number
  attending: number
  notAttending: number
  attendingPeople: number
  capacity: number | null
  possibleDuplicates?: number
}

export interface RsvpResponsePage {
  items: RsvpResponse[]
  total: number
  summary: RsvpSummary
}

export const invitationPath = (id: string) => `/invitations/${encodeURIComponent(id)}`
const inv = invitationPath

async function content<T>(path: string, options: RequestOptions & { ifMatch?: IfMatch } = {}): Promise<Revisioned<T>> {
  const { ifMatch, ...rest } = options
  const headers = ifMatch === undefined || ifMatch === null ? rest.headers : { ...rest.headers, 'If-Match': revisionEtag(ifMatch) }
  const res = await requestWithHeaders<T>(path, { ...rest, headers })
  return { data: res.data, revision: parseRevisionEtag(res.headers.get('ETag')) }
}

export const invitationsApi = {
  /** Public, cacheable registry. */
  types: () => request<InvitationTypes>('/invitation-types'),

  list: () => request<{ items: InvitationSummary[] }>('/invitations'),
  create: (body: InvitationCreate) => request<InvitationRead>('/invitations', { method: 'POST', body }),
  get: (id: string) => request<InvitationRead>(inv(id)),
  update: (id: string, body: InvitationSettings) => request<InvitationRead>(inv(id), { method: 'PATCH', body }),
  remove: (id: string) => request<void>(inv(id), { method: 'DELETE' }),

  getContent: (id: string) => content<WeddingDraft>(`${inv(id)}/content`),
  putContent: (id: string, body: InvitationContentInput, ifMatch: IfMatch) =>
    content<WeddingDraft>(`${inv(id)}/content`, { method: 'PUT', body, ifMatch }),
  preview: (id: string) => request<InvitationPreview>(`${inv(id)}/preview`),

  getSection: <S extends SectionName>(id: string, section: S) =>
    content<SectionPayloads[S]>(`${inv(id)}/sections/${section}`),
  putSection: <S extends SectionName>(id: string, section: S, body: SectionPayloads[S], ifMatch: IfMatch) =>
    content<SectionPayloads[S]>(`${inv(id)}/sections/${section}`, { method: 'PUT', body, ifMatch }),

  listItems: <C extends CollectionName>(id: string, collection: C) =>
    content<CollectionItems[C][]>(`${inv(id)}/${collection}`),
  createItem: <C extends CollectionName>(id: string, collection: C, body: NewItem<C>, ifMatch: IfMatch) =>
    content<CollectionItems[C]>(`${inv(id)}/${collection}`, { method: 'POST', body, ifMatch }),
  reorderItems: <C extends CollectionName>(id: string, collection: C, ids: string[], ifMatch: IfMatch) =>
    content<CollectionItems[C][]>(`${inv(id)}/${collection}/order`, { method: 'PUT', body: { ids }, ifMatch }),
  updateItem: <C extends CollectionName>(id: string, collection: C, itemId: string, body: NewItem<C>, ifMatch: IfMatch) =>
    content<CollectionItems[C]>(`${inv(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'PUT', body, ifMatch }),
  deleteItem: (id: string, collection: CollectionName, itemId: string, ifMatch: IfMatch) =>
    content<void>(`${inv(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'DELETE', ifMatch }),

  rsvpResponses: (id: string, page: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams()
    if (page.limit !== undefined) query.set('limit', String(page.limit))
    if (page.offset !== undefined) query.set('offset', String(page.offset))
    const qs = query.toString()
    return request<RsvpResponsePage>(`${inv(id)}/rsvp-responses${qs ? `?${qs}` : ''}`)
  },
  /** Same-origin download URL (session cookie authenticates; use as an `<a href download>`). */
  rsvpResponsesCsvUrl: (id: string) => `${API_BASE}${inv(id)}/rsvp-responses.csv`,
  deleteRsvpResponse: (id: string, responseId: string) =>
    request<void>(`${inv(id)}/rsvp-responses/${encodeURIComponent(responseId)}`, { method: 'DELETE' }),
}
