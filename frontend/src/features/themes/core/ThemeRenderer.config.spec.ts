/**
 * Template configuration lets one renderer power several templates
 * (e.g. the same layout with a regional palette). The renderer must pass it through.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { sampleWedding } from '@/features/wedding/sampleWedding'

import type { RenderableTemplate } from './types'

const ConfigProbe = defineComponent({
  props: { content: { type: Object, required: true }, config: { type: Object, required: false } },
  setup: (props) => () => h('article', { 'data-config': JSON.stringify(props.config ?? null) }),
})

const probe = (id: string, config?: Record<string, unknown>): RenderableTemplate => ({
  id,
  familyId: 'traditional',
  collectionId: 'javanese',
  name: id,
  tagline: '',
  description: '',
  status: 'available',
  previewImage: 'x.svg',
  config,
  // Real templates use `import()`, which yields an ES module; a bare component is equivalent here.
  component: () => Promise.resolve(ConfigProbe),
})

vi.mock('./registry', () => {
  const templates = [probe('javanese-yogya', { palette: 'sogan', ornament: 'yogyakarta' }), probe('plain')]
  return {
    DEFAULT_THEME_ID: 'plain',
    getTheme: (id: string) => templates.find((t) => t.id === id),
  }
})

const { default: ThemeRenderer } = await import('./ThemeRenderer.vue')

describe('ThemeRenderer template config', () => {
  it('passes the template config to the theme component', async () => {
    const wrapper = mount(ThemeRenderer, { props: { content: sampleWedding, themeId: 'javanese-yogya' } })
    await vi.waitFor(() => expect(wrapper.find('article').exists()).toBe(true))
    expect(JSON.parse(wrapper.find('article').attributes('data-config')!)).toEqual({
      palette: 'sogan',
      ornament: 'yogyakarta',
    })
  })

  it('passes nothing when the template has no config', async () => {
    const wrapper = mount(ThemeRenderer, { props: { content: sampleWedding, themeId: 'plain' } })
    await vi.waitFor(() => expect(wrapper.find('article').exists()).toBe(true))
    expect(wrapper.find('article').attributes('data-config')).toBe('null')
  })
})
