import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import PreviewFrame from './PreviewFrame.vue'

const content = {} as WeddingContent

let shouldThrow = true
const FlakyTheme = defineComponent({
  name: 'ThemeRenderer',
  props: ['content', 'themeId', 'viewportHeight', 'embedded'],
  setup() {
    return () => {
      if (shouldThrow) throw new Error('boom')
      return h('div', { class: 'wedding-site', 'data-ok': '' }, [h('section', { 'data-section': 'couple' })])
    }
  },
})

afterEach(() => vi.restoreAllMocks())

describe('PreviewFrame', () => {
  const mountFrame = (props: Record<string, unknown> = {}) =>
    mount(PreviewFrame, {
      props: { content, themeId: 'international', device: 'phone', zoom: 'fit', gutter: 48, ...props },
      global: { stubs: { ThemeRenderer: FlakyTheme } },
    })

  it('catches theme render errors with a Try again card; the error does not escape', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    shouldThrow = true
    const wrapper = mountFrame()
    await flushPromises()
    const card = wrapper.get('[data-testid="preview-error"]')
    expect(card.attributes('role')).toBe('alert')
    expect(card.text()).toContain('Preview couldn’t load')
    shouldThrow = false
    await wrapper.get('[data-action="preview-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="preview-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-ok]').exists()).toBe(true)
  })

  it('shows a loading skeleton (status) until there is content', () => {
    shouldThrow = false
    const wrapper = mountFrame({ content: null })
    const loading = wrapper.get('[data-testid="preview-loading"]')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.text()).toBe('Loading preview…')
    expect(loading.classes()).toContain('motion-reduce:animate-none')
  })

  it('is a focusable, labelled region at the true device width with inert theme content', () => {
    shouldThrow = false
    const wrapper = mountFrame({ device: 'desktop' })
    const frame = wrapper.get('[data-testid="preview-frame"]')
    expect(frame.attributes()).toMatchObject({ role: 'region', tabindex: '0', 'aria-label': 'Live preview, desktop size — scrollable' })
    expect((frame.element as HTMLElement).style.width).toBe('1280px')
    expect(wrapper.get('[data-testid="preview-content"]').attributes()).toHaveProperty('inert')
  })

  it('scrolls only its own scroller to the section, accounting for the scale', async () => {
    shouldThrow = false
    const scrollTo = vi.fn()
    const wrapper = mountFrame({ section: 'opening' })
    await flushPromises()
    const scroller = wrapper.get('[data-testid="preview-frame"]').element as HTMLElement
    scroller.scrollTo = scrollTo as never
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    const target = wrapper.get('[data-section="couple"]').element as HTMLElement
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 400 } as DOMRect)
    await wrapper.setProps({ section: 'couple' })
    await flushPromises()
    expect(scrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' })
    // Missing section → nothing happens.
    scrollTo.mockClear()
    await wrapper.setProps({ section: 'story' })
    await flushPromises()
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
