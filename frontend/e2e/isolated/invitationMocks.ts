/**
 * Invitation engine v2.0 additions for the fully mocked isolated specs: the list
 * (`GET /invitations`, used by the legacy `/wedding/*` redirects and the nav) and the
 * record (`GET|PATCH /invitations/{id}`). `record` is the spec's own wedding fixture.
 */
import type { Route } from '@playwright/test'

export function asInvitation<T extends Record<string, unknown>>(record: T) {
  return Object.assign(record, { category: 'wedding', variant: 'wedding_ceremony', title: null, timezone: 'Asia/Jakarta', revision: record.revision ?? 0, slug: record.slug ?? null, hasUnpublishedChanges: false, createdAt: record.createdAt ?? '2026-01-01', updatedAt: record.updatedAt ?? '2026-01-01' })
}

/** Handles invitation routes; returns true when it fulfilled the request. */
export async function handleInvitationRoutes(route: Route, path: string, record: Record<string, unknown> | null): Promise<boolean> {
  const method = route.request().method()
  if (path.endsWith('/invitation-types')) { await route.continue(); return true }
  if (path.endsWith('/api/v1/invitations') && method === 'GET') {
    const items = record ? [{ id: record.id, title: null, category: 'wedding', variant: 'wedding_ceremony', themeId: record.themeId ?? null, status: record.status ?? 'draft', slug: null, hasUnpublishedChanges: false, eventDate: null, updatedAt: '2026-01-01', publishedAt: null }] : []
    await route.fulfill({ json: { items } })
    return true
  }
  if (record && path.endsWith(`/api/v1/invitations/${record.id}`)) {
    if (method === 'PATCH') Object.assign(record, route.request().postDataJSON())
    await route.fulfill({ json: record })
    return true
  }
  return false
}
