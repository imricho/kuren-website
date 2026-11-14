/**
 * Central theme registry: Family → Collection → Template.
 *
 * - Families and collections are configuration (catalog/).
 * - Templates with a renderer live in their own folder and are listed in
 *   RENDERABLE_TEMPLATES; planned ones are in catalog/planned.ts.
 *
 * To add a template: create its folder with an `index.ts` exporting a
 * RenderableTemplate (with familyId + collectionId), then add it below.
 * The renderer and the content model don't change.
 *
 * Backwards compatible with Workstream 2: THEMES, getTheme, isThemeId and
 * DEFAULT_THEME_ID behave exactly as before.
 */
import { artisticTheme } from '../artistic'
import { COLLECTIONS } from '../catalog/collections'
import { FAMILIES } from '../catalog/families'
import { PLANNED_TEMPLATES } from '../catalog/planned'
import { conventionalTheme } from '../conventional'
import { ethnicTheme } from '../ethnic'
import { internationalTheme } from '../international'
import { minimalistTheme } from '../minimalist'
import { rusticTheme } from '../rustic'
import { traditionalTheme } from '../traditional'
import {
  isRenderable,
  type RenderableTemplate,
  type ThemeCollection,
  type ThemeFamily,
  type ThemeTemplate,
} from './types'

const RENDERABLE_TEMPLATES: readonly RenderableTemplate[] = [
  internationalTheme,
  traditionalTheme,
  ethnicTheme,
  conventionalTheme,
  artisticTheme,
  minimalistTheme,
  rusticTheme,
]

/** Every template (renderable and planned), in display order. */
export const TEMPLATES: readonly ThemeTemplate[] = Object.freeze([...RENDERABLE_TEMPLATES, ...PLANNED_TEMPLATES])
export { COLLECTIONS, FAMILIES }

/** Selectable templates (available + renderable). Same meaning as in Workstream 2. */
export const THEMES: readonly RenderableTemplate[] = Object.freeze(
  RENDERABLE_TEMPLATES.filter((t) => t.status === 'available'),
)

export const DEFAULT_THEME_ID = internationalTheme.id

/** Ids that would clash with picker routes (/themes/:familyId/:collectionId, /themes/:id/preview). */
export const RESERVED_IDS: ReadonlySet<string> = new Set(['preview'])

// --- Lookups --------------------------------------------------------------------

/** id and every alias → entry. Aliases let old or friendlier URLs resolve to the canonical entry. */
function indexWithAliases<T extends { id: string; aliases?: string[] }>(items: readonly T[]) {
  const map = new Map<string, T>()
  for (const item of items) for (const key of [item.id, ...(item.aliases ?? [])]) if (!map.has(key)) map.set(key, item)
  return map
}

const familyById = indexWithAliases(FAMILIES)
const collectionById = new Map(COLLECTIONS.map((c) => [c.id, c]))
// Templates resolve by id, URL slug or alias.
const templateById = new Map<string, ThemeTemplate>()
for (const t of TEMPLATES)
  for (const key of [t.id, templateSlug(t), ...(t.aliases ?? [])]) if (!templateById.has(key)) templateById.set(key, t)

/** The public URL slug of a template. */
export function templateSlug(t: Pick<ThemeTemplate, 'id' | 'slug'>): string {
  return t.slug ?? t.id
}

/** A template that can be rendered (available or hidden), by id or alias. Unknown/planned → undefined. */
export function getTheme(id: string | null | undefined): RenderableTemplate | undefined {
  const template = id ? templateById.get(id) : undefined
  return template && isRenderable(template) ? template : undefined
}

/** True for ids a wedding may store as its theme: selectable (available) templates only. */
export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && getTheme(id)?.status === 'available'
}

export function getTemplate(id: string | null | undefined): ThemeTemplate | undefined {
  return id ? templateById.get(id) : undefined
}

export function getFamily(id: string | null | undefined): ThemeFamily | undefined {
  return id ? familyById.get(id) : undefined
}

export function getCollection(id: string | null | undefined): ThemeCollection | undefined {
  return id ? collectionById.get(id) : undefined
}

/** Listed collections of a family (hidden ones excluded). */
export function collectionsOf(familyId: string): ThemeCollection[] {
  return COLLECTIONS.filter((c) => c.familyId === familyId && c.status !== 'hidden')
}

/** Listed templates of a collection, including planned ones (hidden excluded). */
export function templatesOf(collectionId: string): ThemeTemplate[] {
  return TEMPLATES.filter((t) => t.collectionId === collectionId && t.status !== 'hidden')
}

export function availableTemplatesOf(collectionId: string): RenderableTemplate[] {
  return templatesOf(collectionId).filter((t): t is RenderableTemplate => t.status === 'available')
}

/** Templates that can be previewed: available ones and drafts. */
export function previewableTemplatesOf(collectionId: string): RenderableTemplate[] {
  return templatesOf(collectionId).filter(
    (t): t is RenderableTemplate => t.status === 'available' || t.status === 'draft',
  )
}

/** Number of selectable templates in a family. */
export function availableCountInFamily(familyId: string): number {
  return THEMES.filter((t) => t.familyId === familyId).length
}

/** Collection counts by availability within a family. */
export function collectionCounts(familyId: string) {
  const listed = collectionsOf(familyId)
  return {
    total: listed.length,
    available: listed.filter((c) => c.status === 'available').length,
    draft: listed.filter((c) => c.status === 'draft').length,
    comingSoon: listed.filter((c) => c.status === 'coming_soon').length,
  }
}

/** Template counts by availability, for a family or a collection. Single source for picker labels. */
export function templateCounts(scope: { familyId?: string; collectionId?: string }) {
  const listed = TEMPLATES.filter(
    (t) =>
      t.status !== 'hidden' &&
      (scope.familyId === undefined || t.familyId === scope.familyId) &&
      (scope.collectionId === undefined || t.collectionId === scope.collectionId),
  )
  return {
    available: listed.filter((t) => t.status === 'available').length,
    draft: listed.filter((t) => t.status === 'draft').length,
    comingSoon: listed.filter((t) => t.status === 'coming_soon').length,
  }
}

/** Family and collection a template belongs to, for breadcrumbs and labels. */
export function templatePath(id: string | null | undefined) {
  const template = getTemplate(id)
  if (!template) return undefined
  return { family: getFamily(template.familyId)!, collection: getCollection(template.collectionId)!, template }
}

// --- Integrity ------------------------------------------------------------------

/**
 * Rules for cultural briefs. A culturally specific collection can only become available
 * when its sources are verified, it has been reviewed by named reviewers, and (if needed)
 * a specific locality/subtradition is chosen. Items can only be "confirmed" with a verified source.
 */
export function validateBrief(c: ThemeCollection): string[] {
  const problems: string[] = []
  const b = c.brief
  if (!b) return [`cultural collection "${c.id}" needs a cultural brief`]
  const verifiedSources = b.sources.filter((s) => s.verified).length
  const confirmedCount = Object.values(b.confirmed).flat().length

  if (confirmedCount > 0 && verifiedSources === 0)
    problems.push(`collection "${c.id}" lists confirmed references without a verified source`)
  if ((b.review.status === 'reviewed') !== (c.reference.review === 'reviewed'))
    problems.push(`collection "${c.id}" review status is inconsistent between reference and brief`)
  if (b.review.status === 'reviewed' && b.review.reviewers.length === 0)
    problems.push(`collection "${c.id}" is marked reviewed but names no reviewers`)
  if (c.status === 'draft' && b.designStatus !== 'draft')
    problems.push(`collection "${c.id}" is shown as a draft but its brief's designStatus is ${b.designStatus}`)
  if (b.designStatus === 'draft' && !b.draft?.templateIds.length)
    problems.push(`collection "${c.id}" has a draft design but no draft templates recorded`)
  if (b.designStatus === 'draft' && b.suggestedReviewers.length === 0)
    problems.push(`collection "${c.id}" has a draft design but no suggested reviewers`)
  if (b.selectedLocality && !b.localities.some((l) => l.id === b.selectedLocality))
    problems.push(`collection "${c.id}" selects an unknown locality "${b.selectedLocality}"`)
  for (const s of b.sources) if (!/^https:\/\//.test(s.url)) problems.push(`collection "${c.id}" has a non-https source URL`)

  if (c.status === 'available') {
    if (b.review.status !== 'reviewed') problems.push(`collection "${c.id}" must be reviewed before it is available`)
    if (verifiedSources === 0) problems.push(`collection "${c.id}" needs at least one verified source before it is available`)
    if (b.localityRequired && !b.selectedLocality)
      problems.push(`collection "${c.id}" needs a ${b.localityLabel} before it is available`)
  }
  return problems
}


/** Validate the catalog's references and rules. Returns problems; empty means valid. */
export function validateCatalog(
  families: readonly ThemeFamily[] = FAMILIES,
  collections: readonly ThemeCollection[] = COLLECTIONS,
  templates: readonly ThemeTemplate[] = TEMPLATES,
): string[] {
  const problems: string[] = []
  const unique = (kind: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${kind} id "${id}"`)
      if (RESERVED_IDS.has(id)) problems.push(`${kind} id "${id}" is reserved`)
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push(`${kind} id "${id}" must be kebab-case`)
      seen.add(id)
    }
  }
  // Ids and aliases share one namespace per level, so an alias can never shadow another entry.
  unique('family', families.flatMap((f) => [f.id, ...(f.aliases ?? [])]))
  unique('collection', collections.map((c) => c.id))
  unique('template', templates.flatMap((t) => [...new Set([t.id, t.slug ?? t.id]), ...(t.aliases ?? [])]))

  const fams = new Map(families.map((f) => [f.id, f]))
  const cols = new Map(collections.map((c) => [c.id, c]))

  for (const c of collections) {
    const family = fams.get(c.familyId)
    if (!family) problems.push(`collection "${c.id}" references unknown family "${c.familyId}"`)
    else if ((c.status === 'available' || c.status === 'draft') && family.status !== 'available')
      problems.push(`collection "${c.id}" is available but its family "${family.id}" is not`)
    if (c.reference.kind === 'cultural' && c.status === 'available' && c.reference.review !== 'reviewed')
      problems.push(`cultural collection "${c.id}" must be reviewed before it is available`)
    if (c.reference.kind === 'cultural') problems.push(...validateBrief(c))
  }

  for (const t of templates) {
    const collection = cols.get(t.collectionId)
    if (!fams.has(t.familyId)) problems.push(`template "${t.id}" references unknown family "${t.familyId}"`)
    if (!collection) {
      problems.push(`template "${t.id}" references unknown collection "${t.collectionId}"`)
      continue
    }
    if (collection.familyId !== t.familyId)
      problems.push(`template "${t.id}" is in family "${t.familyId}" but its collection belongs to "${collection.familyId}"`)
    if (t.status === 'available' && collection.status !== 'available')
      problems.push(`template "${t.id}" is available but its collection "${collection.id}" is not`)
    if (t.status === 'draft' && !['draft', 'available'].includes(collection.status))
      problems.push(`template "${t.id}" is a draft but its collection "${collection.id}" is ${collection.status}`)
    if (t.localityId && !collection.brief?.localities.some((l) => l.id === t.localityId))
      problems.push(`template "${t.id}" references unknown locality "${t.localityId}"`)
    // Runtime check for data that bypasses the types (e.g. future JSON/API catalogs).
    const component = (t as { component?: unknown }).component
    if (t.status !== 'coming_soon' && typeof component !== 'function')
      problems.push(`template "${t.id}" is ${t.status} but has no renderer`)
    if (t.status === 'coming_soon' && component !== undefined)
      problems.push(`template "${t.id}" is coming soon but has a renderer; mark it available or hidden`)
  }

  for (const f of families) {
    const hasAvailable = templates.some((t) => t.familyId === f.id && t.status === 'available')
    if (f.status === 'available' && !hasAvailable) problems.push(`family "${f.id}" is available but has no available templates`)
  }

  if (!templates.some((t) => t.id === DEFAULT_THEME_ID && t.status === 'available'))
    problems.push(`default theme "${DEFAULT_THEME_ID}" must be available`)

  return problems
}

if (import.meta.env.DEV) {
  const problems = validateCatalog()
  if (problems.length) console.error('[themes] Catalog problems:\n - ' + problems.join('\n - '))
}
