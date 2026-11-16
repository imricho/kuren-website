/**
 * Typed client for the Wedding CMS API (docs/api/weddings.md). All JSON is camelCase.
 */
import type {
  CollectionItems,
  CollectionName,
  NewItem,
  SectionName,
  SectionPayloads,
  WeddingDraft,
} from '@/features/wedding/draft'
import type { WeddingLocale } from '@/features/wedding/types'

import { parseRevisionEtag, request, requestWithHeaders, revisionEtag, type RequestOptions } from './http'

export interface WeddingRead {
  id: string
  /** Canonical template id; null = not chosen. */
  themeId: string | null
  locale: WeddingLocale
  /** 'published' while a publication is live. */
  status: 'draft' | 'published'
  publishedAt: string | null
  /** Content revision (optimistic concurrency); 0 for a new wedding. Theme/locale changes don't bump it. */
  revision: number
  createdAt: string
  updatedAt: string
  /**
   * CMS v2.0 publishing (docs/api/weddings.md "Publishing"). Optional so records from
   * servers/fixtures that predate migration 0006 still type-check; absent = never published.
   */
  /** Public slug, assigned on first publish (`/i/<slug>`). */
  slug?: string | null
  /** Published and (revision ≠ publication.revision or themeId ≠ publication.themeId). */
  hasUnpublishedChanges?: boolean
  /** The live publication, or null when not published. */
  publication?: WeddingPublication | null
}

export interface WeddingPublication {
  publishedAt: string
  /** Content revision the snapshot was built from. */
  revision: number
  themeId: string | null
}

export interface WeddingSettings {
  themeId?: string | null
  locale?: WeddingLocale
}

export interface WeddingPreview {
  themeId: string | null
  content: WeddingDraft
}

/** Content accepted by PUT /content (schemaVersion and locale are optional). */
export type WeddingContentInput = Omit<WeddingDraft, 'schemaVersion' | 'locale'> &
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

const w = (id: string) => `/weddings/${encodeURIComponent(id)}`

async function content<T>(path: string, options: RequestOptions & { ifMatch?: IfMatch } = {}): Promise<Revisioned<T>> {
  const { ifMatch, ...rest } = options
  const headers = ifMatch === undefined || ifMatch === null ? rest.headers : { ...rest.headers, 'If-Match': revisionEtag(ifMatch) }
  const res = await requestWithHeaders<T>(path, { ...rest, headers })
  return { data: res.data, revision: parseRevisionEtag(res.headers.get('ETag')) }
}

/**
 * Content routes return `Revisioned<T>` (body + revision from `ETag`); content
 * writes take the last seen revision and send it as `If-Match`
 * (409 `edit_conflict` when it is stale). Record routes (me/create/update)
 * are plain.
 */
export const weddingsApi = {
  me: () => request<WeddingRead>('/weddings/me'),
  create: (body: WeddingSettings = {}) => request<WeddingRead>('/weddings', { method: 'POST', body }),
  update: (id: string, body: WeddingSettings) => request<WeddingRead>(w(id), { method: 'PATCH', body }),

  getContent: (id: string) => content<WeddingDraft>(`${w(id)}/content`),
  putContent: (id: string, body: WeddingContentInput, ifMatch: IfMatch) =>
    content<WeddingDraft>(`${w(id)}/content`, { method: 'PUT', body, ifMatch }),
  preview: (id: string) => request<WeddingPreview>(`${w(id)}/preview`),

  getSection: <S extends SectionName>(id: string, section: S) =>
    content<SectionPayloads[S]>(`${w(id)}/sections/${section}`),
  putSection: <S extends SectionName>(id: string, section: S, body: SectionPayloads[S], ifMatch: IfMatch) =>
    content<SectionPayloads[S]>(`${w(id)}/sections/${section}`, { method: 'PUT', body, ifMatch }),

  listItems: <C extends CollectionName>(id: string, collection: C) =>
    content<CollectionItems[C][]>(`${w(id)}/${collection}`),
  createItem: <C extends CollectionName>(id: string, collection: C, body: NewItem<C>, ifMatch: IfMatch) =>
    content<CollectionItems[C]>(`${w(id)}/${collection}`, { method: 'POST', body, ifMatch }),
  reorderItems: <C extends CollectionName>(id: string, collection: C, ids: string[], ifMatch: IfMatch) =>
    content<CollectionItems[C][]>(`${w(id)}/${collection}/order`, { method: 'PUT', body: { ids }, ifMatch }),
  updateItem: <C extends CollectionName>(id: string, collection: C, itemId: string, body: NewItem<C>, ifMatch: IfMatch) =>
    content<CollectionItems[C]>(`${w(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'PUT', body, ifMatch }),
  deleteItem: (id: string, collection: CollectionName, itemId: string, ifMatch: IfMatch) =>
    content<void>(`${w(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'DELETE', ifMatch }),
}
