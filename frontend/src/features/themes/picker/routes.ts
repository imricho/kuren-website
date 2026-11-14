import type { RouteLocationRaw } from 'vue-router'

import type { ThemeTemplate } from '../core/types'

/** Canonical routes of the picker. Every link to a template goes through these. */
export const familyRoute = (familyId: string): RouteLocationRaw => ({ name: 'theme-family', params: { familyId } })

export const collectionRoute = (familyId: string, collectionId: string): RouteLocationRaw => ({
  name: 'theme-collection',
  params: { familyId, collectionId },
})

export const previewRoute = (t: Pick<ThemeTemplate, 'id' | 'familyId' | 'collectionId'>): RouteLocationRaw => ({
  name: 'theme-preview',
  params: { familyId: t.familyId, collectionId: t.collectionId, templateId: t.id },
})
