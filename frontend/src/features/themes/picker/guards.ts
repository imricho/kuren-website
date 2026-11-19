/**
 * Route guards that keep picker URLs canonical:
 *   - family aliases (e.g. /themes/conventional) → canonical family id (/themes/classic)
 *   - a collection under the wrong family → its owning family
 *   - template ids, slugs and aliases, and the legacy /themes/:id/preview URL →
 *     canonical /themes/:familyId/:collectionId/:templateSlug[/preview]
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

/**
 * For the studio template route, the full-screen preview route and the legacy
 * /themes/:themeId/preview route.
 */
export async function canonicalTemplate(to: RouteLocationNormalized): Promise<RouteLocationRaw | void> {
  const { DEFAULT_THEME_ID, getTemplate, templateSlug } = await registry()
  const requested = String(to.params.templateSlug ?? to.params.themeId)
  const template = getTemplate(requested)
  // The legacy URL always means full-screen preview.
  const target = to.name === 'theme-template' ? 'theme-template' : 'theme-preview'

  if (!template) {
    // Unknown template: show the default and tell the user (the page reads `notFound`).
    const fallback = getTemplate(DEFAULT_THEME_ID)!
    return {
      name: target,
      params: { familyId: fallback.familyId, collectionId: fallback.collectionId, templateSlug: templateSlug(fallback) },
      query: { notFound: requested },
      replace: true,
    }
  }
  if (to.meta.publicPage && template.status !== 'available') {
    // Public discovery only exposes templates that can actually be chosen.
    return { name: 'public-templates', replace: true }
  }
  if (!isRenderable(template)) {
    // Planned templates can't be previewed yet; show their collection instead.
    return {
      name: 'theme-collection',
      params: { familyId: template.familyId, collectionId: template.collectionId },
      replace: true,
    }
  }
  const slug = templateSlug(template)
  const isCanonical =
    to.name === target &&
    to.params.templateSlug === slug &&
    to.params.familyId === template.familyId &&
    to.params.collectionId === template.collectionId
  if (!isCanonical) {
    return {
      name: target,
      params: { familyId: template.familyId, collectionId: template.collectionId, templateSlug: slug },
      query: to.query,
      replace: true,
    }
  }
}
