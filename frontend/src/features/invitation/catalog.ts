/**
 * Invitation-level helpers for the list, wizard and settings: compatible templates
 * (from the theme catalog, filtered by the registry's compatibility rules), display
 * names, status and the timezone picker.
 */
import type { InvitationStatus } from '@/api/invitations'
import { manifestsForVariant } from '@/features/themes/core/manifests'
import { getTheme } from '@/features/themes/core/registry'
import { isSelectable, type RenderableTemplate } from '@/features/themes/core/types'

import { DEFAULT_TIMEZONE, isTemplateCompatible, variantOf, type Locale, type VariantId } from './registry'

/** Selectable templates the variant may use (template manifests), in catalog order, with their catalog entries for thumbnails. */
export function compatibleTemplates(variant: VariantId): RenderableTemplate[] {
  return manifestsForVariant(variant)
    .map((m) => getTheme(m.id))
    .filter((t): t is RenderableTemplate => !!t && isSelectable(t) && isTemplateCompatible(t.id, variant))
}

/** Name shown in lists: the internal title, else the variant label. */
export function invitationName(inv: { title: string | null; variant: VariantId }, locale: Locale): string {
  return inv.title?.trim() || variantOf(inv.variant).label[locale]
}

export type InvitationPublishState = 'draft' | 'published' | 'unpublished_changes'
export function publishStateOf(inv: { status: InvitationStatus; hasUnpublishedChanges?: boolean }): InvitationPublishState {
  if (inv.status !== 'published') return 'draft'
  return inv.hasUnpublishedChanges ? 'unpublished_changes' : 'published'
}

export function publicUrlOf(slug: string | null | undefined): string | null {
  if (!slug) return null
  const origin = typeof location !== 'undefined' ? location.origin : ''
  return `${origin}/i/${encodeURIComponent(slug)}`
}

/** Indonesia's three zones first (WIB, WITA, WIT). */
export const INDONESIAN_TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const
export { DEFAULT_TIMEZONE }

/** Every IANA zone the browser knows (Indonesian zones first); just those three without Intl support. */
export function timezoneOptions(current?: string | null): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf
  let all: string[] = []
  try {
    all = typeof supported === 'function' ? supported('timeZone') : []
  } catch {
    all = []
  }
  const rest = all.filter((z) => !(INDONESIAN_TIMEZONES as readonly string[]).includes(z))
  const list = [...INDONESIAN_TIMEZONES, ...rest]
  return current && !list.includes(current) ? [current, ...list] : list
}
