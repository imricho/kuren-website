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
const templateById = indexWithAliases(TEMPLATES)

/** A template that can be rendered (available or hidden), by id or alias. Unknown/planned → undefined. */
export function getTheme(id: string | null | undefined): RenderableTemplate | undefined {
  const template = id ? templateById.get(id) : undefined
  return template && isRenderable(template) ? template : undefined
}

/** True for ids that can be rendered (what a wedding may store as its theme). */
export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && getTheme(id) !== undefined
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

/** Number of selectable templates in a family. */
export function availableCountInFamily(familyId: string): number {
  return THEMES.filter((t) => t.familyId === familyId).length
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
  unique('template', templates.flatMap((t) => [t.id, ...(t.aliases ?? [])]))

  const fams = new Map(families.map((f) => [f.id, f]))
  const cols = new Map(collections.map((c) => [c.id, c]))

  for (const c of collections) {
    const family = fams.get(c.familyId)
    if (!family) problems.push(`collection "${c.id}" references unknown family "${c.familyId}"`)
    else if (c.status === 'available' && family.status !== 'available')
      problems.push(`collection "${c.id}" is available but its family "${family.id}" is not`)
    if (c.reference.kind === 'cultural' && c.status === 'available' && c.reference.review !== 'reviewed')
      problems.push(`cultural collection "${c.id}" must be reviewed before it is available`)
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
