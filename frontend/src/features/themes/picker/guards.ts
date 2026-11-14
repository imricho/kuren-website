/**
 * Route guards that keep picker URLs canonical:
 *   - family aliases (e.g. /themes/conventional) → canonical family id
 *   - a collection under the wrong family → its owning family
 *   - template aliases and the legacy /themes/:id/preview URL → canonical
 *     /themes/:familyId/:collectionId/:templateId/preview
 *
 * The registry is imported lazily so the catalog stays out of the initial bundle.
 */
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

import { isRenderable } from '../core/types'

const registry = () => import('../core/registry')

export async function canonicalFamily(to: RouteLocationNormalized): Promise<RouteLocationRaw | void> {
  const { getFamily } = await registry()
  const requested = String(to.params.familyId)
  const family = getFamily(requested)
  if (family && family.id !== requested) {
    return { name: 'theme-family', params: { familyId: family.id }, replace: true }
  }
}

export async function canonicalCollection(to: RouteLocationNormalized): Promise<RouteLocationRaw | void> {
  const { getCollection, getFamily } = await registry()
  const familyId = String(to.params.familyId)
  const collectionId = String(to.params.collectionId)
  const collection = getCollection(collectionId)
  const canonicalFamilyId = collection?.familyId ?? getFamily(familyId)?.id
  if (canonicalFamilyId && canonicalFamilyId !== familyId) {
    return { name: 'theme-collection', params: { familyId: canonicalFamilyId, collectionId }, replace: true }
  }
}

/** Works for both the canonical preview route and the legacy /themes/:themeId/preview route. */
export async function canonicalPreview(to: RouteLocationNormalized): Promise<RouteLocationRaw | void> {
  const { DEFAULT_THEME_ID, getTemplate } = await registry()
  const requested = String(to.params.templateId ?? to.params.themeId)
  const template = getTemplate(requested)

  if (!template) {
    // Unknown id: show the default template and tell the user (ThemePreviewPage reads `notFound`).
    const fallback = getTemplate(DEFAULT_THEME_ID)!
    return {
      name: 'theme-preview',
      params: { familyId: fallback.familyId, collectionId: fallback.collectionId, templateId: fallback.id },
      query: { notFound: requested },
      replace: true,
    }
  }
  if (!isRenderable(template)) {
    // Planned templates can't be previewed yet; show them in their collection instead.
    return {
      name: 'theme-collection',
      params: { familyId: template.familyId, collectionId: template.collectionId },
      replace: true,
    }
  }
  const isCanonical =
    to.name === 'theme-preview' &&
    to.params.templateId === template.id &&
    to.params.familyId === template.familyId &&
    to.params.collectionId === template.collectionId
  if (!isCanonical) {
    return {
      name: 'theme-preview',
      params: { familyId: template.familyId, collectionId: template.collectionId, templateId: template.id },
      query: to.query,
      replace: true,
    }
  }
}
