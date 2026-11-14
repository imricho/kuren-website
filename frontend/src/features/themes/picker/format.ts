/**
 * Shared wording for the theme picker, so labels, counts and paths read the
 * same on every page (cards, inline preview, full-screen preview, dashboard).
 */
import { collectionCounts, templateCounts, templatePath } from '../core/registry'
import type { CulturalReviewStatus, ThemeStatus } from '../core/types'
import { localizedCatalogText, useAppLocale } from '@/composables/useAppLocale'

const { t } = useAppLocale()

export const ACTION = {
  preview: 'Preview',
  select: 'Select template',
  selected: 'Selected',
  draftNotSelectable: 'Preview only — draft',
  fullScreen: 'Full-screen preview',
} as const

export const STATUS_LABEL: Record<ThemeStatus, string> = {
  available: 'Available',
  draft: 'Draft — preview only',
  coming_soon: 'In development',
  hidden: 'Preview only',
}

export const REVIEW_LABEL: Record<CulturalReviewStatus, string> = {
  in_development: 'Review pending',
  awaiting_review: 'Awaiting cultural review',
  reviewed: 'Culturally reviewed',
}

export const localizedActions = () => ({
  preview: t('preview'),
  select: t('selectTemplate'),
  selected: t('selectedLabel'),
  draftNotSelectable: t('previewOnlyDraft'),
  fullScreen: t('fullScreenPreview'),
})

export const localizedStatus = (status: ThemeStatus | 'selected') =>
  status === 'selected' ? t('selectedLabel') : ({
    available: t('available'),
    draft: t('draftPreview'),
    coming_soon: t('inDevelopment'),
    hidden: t('previewOnly'),
  })[status]

export const localizedReview = (status: CulturalReviewStatus) => ({
  in_development: t('reviewPending'),
  awaiting_review: t('awaitingReview'),
  reviewed: t('culturallyReviewed'),
})[status]

/** e.g. "2 templates available", "1 draft · 5 planned", "No templates yet". */
export function countLabel(scope: { familyId?: string; collectionId?: string }): string {
  const { available, draft, comingSoon } = templateCounts(scope)
  const parts: string[] = []
  if (available) parts.push(t(available === 1 ? 'templateAvailable' : 'templatesAvailable', { count: available }))
  if (draft) parts.push(t(draft === 1 ? 'draftsToPreview' : 'draftsToPreviewPlural', { count: draft }))
  if (comingSoon) parts.push(t('planned', { count: comingSoon }))
  if (!available && !draft && comingSoon) return t('templatesPlanned', { count: comingSoon })
  return parts.length ? parts.join(' · ') : t('noTemplatesYet')
}

/**
 * Family summary that agrees with the collection-level statuses.
 */
export function familySummary(familyId: string): string {
  const { available } = templateCounts({ familyId })
  const cols = collectionCounts(familyId)
  if (cols.total === 0) return t('familyInDevelopmentSummary')
  const parts = [t(available === 1 ? 'templateAvailable' : 'templatesAvailable', { count: available })]
  if (cols.draft) parts.push(t(cols.draft === 1 ? 'draftsToPreview' : 'draftsToPreviewPlural', { count: cols.draft }))
  if (cols.comingSoon) parts.push(t(cols.comingSoon === 1 ? 'collectionInDevelopment' : 'collectionsInDevelopmentCount', { count: cols.comingSoon }))
  return parts.join(' · ')
}

/** "Family › Collection › Template" for a template id (or undefined). */
export function formatTemplatePath(templateId: string | null | undefined): string | undefined {
  const path = templatePath(templateId)
  return path
    ? `${localizedCatalogText(path.family.id, 'name', path.family.name)} › ${localizedCatalogText(path.collection.id, 'name', path.collection.name)} › ${path.template.name}`
    : undefined
}
