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


const INDONESIAN_NAMES: Record<string, Record<Locale, string>> = {
  'Asia/Jakarta': { en: 'WIB · Western Indonesia (Jakarta, Sumatra, Java, West & Central Kalimantan)', id: 'WIB · Indonesia Barat (Jakarta, Sumatra, Jawa, Kalimantan Barat & Tengah)' },
  'Asia/Makassar': { en: 'WITA · Central Indonesia (Bali, Sulawesi, NTB, NTT, South & East Kalimantan)', id: 'WITA · Indonesia Tengah (Bali, Sulawesi, NTB, NTT, Kalimantan Selatan & Timur)' },
  'Asia/Jayapura': { en: 'WIT · Eastern Indonesia (Maluku, Papua)', id: 'WIT · Indonesia Timur (Maluku, Papua)' },
}

/** "UTC+07:00" for a zone right now (or at `at`); empty when the browser can't tell. */
export function utcOffsetLabel(zone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    if (!part) return ''
    return part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
  } catch {
    return ''
  }
}

/** Human-readable zone label: Indonesian zones by name, others as "City (Region)", plus the offset. */
export function timezoneLabel(zone: string, locale: Locale, at?: Date): string {
  const offset = utcOffsetLabel(zone, at)
  const named = INDONESIAN_NAMES[zone]?.[locale]
  const base = named ?? (() => {
    const parts = zone.split('/')
    const city = (parts.at(-1) ?? zone).replace(/_/g, ' ')
    return parts.length > 1 ? `${city} (${parts.slice(0, -1).join(' / ').replace(/_/g, ' ')})` : city
  })()
  return offset ? `${base} — ${offset}` : base
}

/** Zones matching a search (name, city, region, abbreviation or offset), keeping `current` listed. */
export function searchTimezones(query: string, locale: Locale, current?: string | null, at?: Date): { value: string; label: string }[] {
  const q = query.trim().toLowerCase()
  const all = timezoneOptions(current).map((z) => ({ value: z, label: timezoneLabel(z, locale, at) }))
  if (!q) return all
  const hits = all.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  if (current && !hits.some((h) => h.value === current)) {
    const cur = all.find((o) => o.value === current)
    if (cur) hits.unshift(cur)
  }
  return hits
}
