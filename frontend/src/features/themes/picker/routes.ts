import type { RouteLocationRaw } from 'vue-router'

import type { ThemeTemplate } from '../core/types'

const slugOf = (t: Pick<ThemeTemplate, 'id' | 'slug'>) => t.slug ?? t.id
type TemplateRef = Pick<ThemeTemplate, 'id' | 'slug' | 'familyId' | 'collectionId'>

/** Canonical routes of the picker. Every link to a template goes through these. */
export const familyRoute = (familyId: string): RouteLocationRaw => ({ name: 'theme-family', params: { familyId } })

export const collectionRoute = (familyId: string, collectionId: string): RouteLocationRaw => ({
  name: 'theme-collection',
  params: { familyId, collectionId },
})

/** Template highlighted in the sidebar and shown in the preview pane (previewing, not selecting). */
export const templateRoute = (t: TemplateRef): RouteLocationRaw => ({
  name: 'theme-template',
  params: { familyId: t.familyId, collectionId: t.collectionId, templateSlug: slugOf(t) },
})

/** Full-screen preview. */
export const previewRoute = (t: TemplateRef): RouteLocationRaw => ({
  name: 'theme-preview',
  params: { familyId: t.familyId, collectionId: t.collectionId, templateSlug: slugOf(t) },
})
