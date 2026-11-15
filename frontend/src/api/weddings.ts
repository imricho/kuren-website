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

import { request } from './http'

export interface WeddingRead {
  id: string
  /** Canonical template id; null = not chosen. */
  themeId: string | null
  locale: WeddingLocale
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
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

const w = (id: string) => `/weddings/${encodeURIComponent(id)}`

export const weddingsApi = {
  me: () => request<WeddingRead>('/weddings/me'),
  create: (body: WeddingSettings = {}) => request<WeddingRead>('/weddings', { method: 'POST', body }),
  update: (id: string, body: WeddingSettings) => request<WeddingRead>(w(id), { method: 'PATCH', body }),

  getContent: (id: string) => request<WeddingDraft>(`${w(id)}/content`),
  putContent: (id: string, body: WeddingContentInput) =>
    request<WeddingDraft>(`${w(id)}/content`, { method: 'PUT', body }),
  preview: (id: string) => request<WeddingPreview>(`${w(id)}/preview`),

  getSection: <S extends SectionName>(id: string, section: S) =>
    request<SectionPayloads[S]>(`${w(id)}/sections/${section}`),
  putSection: <S extends SectionName>(id: string, section: S, body: SectionPayloads[S]) =>
    request<SectionPayloads[S]>(`${w(id)}/sections/${section}`, { method: 'PUT', body }),

  listItems: <C extends CollectionName>(id: string, collection: C) =>
    request<CollectionItems[C][]>(`${w(id)}/${collection}`),
  createItem: <C extends CollectionName>(id: string, collection: C, body: NewItem<C>) =>
    request<CollectionItems[C]>(`${w(id)}/${collection}`, { method: 'POST', body }),
  reorderItems: <C extends CollectionName>(id: string, collection: C, ids: string[]) =>
    request<CollectionItems[C][]>(`${w(id)}/${collection}/order`, { method: 'PUT', body: { ids } }),
  updateItem: <C extends CollectionName>(id: string, collection: C, itemId: string, body: NewItem<C>) =>
    request<CollectionItems[C]>(`${w(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'PUT', body }),
  deleteItem: (id: string, collection: CollectionName, itemId: string) =>
    request<void>(`${w(id)}/${collection}/${encodeURIComponent(itemId)}`, { method: 'DELETE' }),
}
