import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import BaseButton from './BaseButton.vue'

enableAutoUnmount(afterEach)

describe('BaseButton', () => {
  it('stays focusable while loading: aria-disabled + aria-busy, never the disabled attribute', async () => {
    const loading = ref(false)
    const submitted = vi.fn()
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h('form', { onSubmit: (e: Event) => (e.preventDefault(), submitted(), (loading.value = true)) }, [
            h(BaseButton, { type: 'submit', loading: loading.value }, () => 'Save'),
          ]),
      }),
      { attachTo: document.body },
    )
    const button = wrapper.get('button')
    ;(button.element as HTMLButtonElement).focus()
    await button.trigger('click')
    await nextTick()
    expect(submitted).toHaveBeenCalledTimes(1)
    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(document.activeElement).toBe(button.element)

    // Activating it again while loading does nothing.
    await button.trigger('click')
    expect(submitted).toHaveBeenCalledTimes(1)

    loading.value = false
    await nextTick()
    expect(button.attributes('aria-busy')).toBeUndefined()
    expect(document.activeElement).toBe(button.element)
  })

  it('swallows clicks while disabled (parent listeners do not run)', async () => {
    const onClick = vi.fn()
    const wrapper = mount(BaseButton, { props: { disabled: true }, attrs: { onClick }, slots: { default: 'Go' } })
    await wrapper.get('button').trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
    await wrapper.setProps({ disabled: false })
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('spins only when motion is welcome and has a visible focus style', () => {
    const wrapper = mount(BaseButton, { props: { loading: true }, slots: { default: 'Saving…' } })
    expect(wrapper.get('[data-testid="spinner"]').classes()).toContain('motion-safe:animate-spin')
    expect(wrapper.get('[data-testid="spinner"]').classes()).not.toContain('animate-spin')
    expect(wrapper.get('button').classes()).toContain('focus-visible:outline-rose-600')
  })
})
