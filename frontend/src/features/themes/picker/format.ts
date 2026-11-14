/**
 * Shared wording for the theme picker, so labels, counts and paths read the
 * same on every page (cards, inline preview, full-screen preview, dashboard).
 */
import { collectionCounts, collectionsOf, templateCounts, templatePath } from '../core/registry'
import type { ThemeStatus } from '../core/types'

export const ACTION = {
  preview: 'Preview',
  select: 'Select template',
  selected: 'Selected',
  fullScreen: 'Full-screen preview',
} as const

export const STATUS_LABEL: Record<ThemeStatus, string> = {
  available: 'Available',
  coming_soon: 'Coming soon',
  hidden: 'Preview only',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** e.g. "2 templates available", "2 templates coming soon", "In development". */
export function countLabel(scope: { familyId?: string; collectionId?: string }): string {
  const { available, comingSoon } = templateCounts(scope)
  if (available && comingSoon) return `${plural(available, 'template')} available · ${comingSoon} coming soon`
  if (available) return `${plural(available, 'template')} available`
  if (comingSoon) return `${plural(comingSoon, 'template')} coming soon`
  return 'In development'
}

/**
 * Family summary that agrees with the collection-level statuses, e.g.
 *   "2 templates available · 12 regional collections coming soon"
 *   "1 template available"
 *   "In development — no collections yet"
 */
export function familySummary(familyId: string): string {
  const { available } = templateCounts({ familyId })
  const cols = collectionCounts(familyId)
  if (cols.total === 0) return 'In development — no collections yet'
  const parts = [available ? `${plural(available, 'template')} available` : 'No templates available yet']
  if (cols.comingSoon) {
    const comingSoonRegional = collectionsOf(familyId).filter(
      (c) => c.status === 'coming_soon' && c.reference.kind === 'cultural',
    ).length
    const kind = comingSoonRegional === cols.comingSoon ? 'regional collection' : 'collection'
    parts.push(`${plural(cols.comingSoon, kind)} coming soon`)
  }
  return parts.join(' · ')
}

/** "Family › Collection › Template" for a template id (or undefined). */
export function formatTemplatePath(templateId: string | null | undefined): string | undefined {
  const path = templatePath(templateId)
  return path ? `${path.family.name} › ${path.collection.name} › ${path.template.name}` : undefined
}
