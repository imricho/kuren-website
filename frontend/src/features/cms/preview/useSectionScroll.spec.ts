import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { useSectionScroll } from './useSectionScroll'

function harness() {
  const shown = ref<string[]>(['opening', 'couple'])
  const section = ref<string | null>('couple')
  const scrollTo = vi.fn()
  const Comp = defineComponent({
    setup() {
      const scroller = ref<HTMLElement | null>(null)
      useSectionScroll({ scroller, section: () => section.value, scale: () => 1, visible: () => true })
      return () => h('div', { ref: scroller, onVnodeMounted: (v) => ((v.el as HTMLElement).scrollTo = scrollTo as never) }, shown.value.map((id) => h('section', { key: id, 'data-section': id })))
    },
  })
  const wrapper = mount(Comp, { attachTo: document.body })
  return { wrapper, shown, section, scrollTo }
}

describe('useSectionScroll', () => {
  it('scrolls to a section once it is turned on while it is the current section', async () => {
    const { shown, section, scrollTo } = harness()
    await nextTick()
    await nextTick()
    scrollTo.mockClear()
    section.value = 'holyRecite1' // missing: theme rendered without it (switched off)
    await nextTick()
    await nextTick()
    expect(scrollTo).not.toHaveBeenCalled()
    shown.value = ['opening', 'holyRecite1', 'couple'] // the couple switches it on
    await nextTick()
    await vi.waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1))
  })

  it('stops waiting when the editor moves to another section', async () => {
    const { shown, section, scrollTo } = harness()
    await nextTick()
    section.value = 'holyRecite1'
    await nextTick()
    await nextTick()
    section.value = 'opening'
    await nextTick()
    await nextTick()
    scrollTo.mockClear()
    shown.value = ['opening', 'holyRecite1', 'couple']
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
