/**
 * Shared wording for the theme picker, so labels, counts and paths read the
 * same on every page (cards, inline preview, full-screen preview, dashboard).
 */
import { templateCounts, templatePath } from '../core/registry'
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

/** "Family › Collection › Template" for a template id (or undefined). */
export function formatTemplatePath(templateId: string | null | undefined): string | undefined {
  const path = templatePath(templateId)
  return path ? `${path.family.name} › ${path.collection.name} › ${path.template.name}` : undefined
}
