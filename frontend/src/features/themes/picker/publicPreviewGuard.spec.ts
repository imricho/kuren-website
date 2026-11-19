import { describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { canonicalTemplate } from './guards'

vi.mock('../core/registry', () => ({
  DEFAULT_THEME_ID: 'available',
  getTemplate: (id: string) => ({
    id, familyId: 'family', collectionId: 'collection',
    status: id === 'planned' ? 'coming_soon' : id,
    component: id === 'planned' ? undefined : () => Promise.resolve({}),
  }),
  templateSlug: (template: { id: string }) => template.id,
}))

function target(id: string, publicPage: boolean) {
  return { name: 'theme-preview-legacy', params: { themeId: id }, query: {}, meta: { publicPage } } as unknown as RouteLocationNormalized
}

describe('unavailable preview routing', () => {
  it.each(['planned', 'draft', 'hidden'])('keeps public %s previews out of the protected CMS', async id => {
    expect(await canonicalTemplate(target(id, true))).toEqual({ name: 'public-templates', replace: true })
  })
  it('preserves the existing protected planned-template collection destination', async () => {
    expect(await canonicalTemplate(target('planned', false))).toEqual({
      name: 'theme-collection', params: { familyId: 'family', collectionId: 'collection' }, replace: true,
    })
  })
})
