import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import type { ImageForm } from '../forms'
import ImageField from './ImageField.vue'

enableAutoUnmount(afterEach)
beforeEach(() => setActivePinia(createPinia()))

function setup(initial: ImageForm = { src: '', alt: '', focalPoint: null }, errors: Record<string, string> = {}) {
  const model = ref<ImageForm>(initial)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(ImageField, {
          label: 'Cover photo',
          path: 'coverImage',
          errors,
          modelValue: model.value,
          'onUpdate:modelValue': (v: ImageForm) => (model.value = v),
        }),
    }),
    { attachTo: document.body },
  )
  return { wrapper, model }
}

describe('ImageField', () => {
  it('validates the address with isSafeImageSrc and only then shows a thumbnail', async () => {
    const { wrapper, model } = setup()
    const src = wrapper.get('#f-coverImage-src')
    await src.setValue('javascript:alert(1)')
    expect(model.value.src).toBe('javascript:alert(1)')
    expect(src.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Enter an image address starting with https://')
    expect(wrapper.find('[data-testid="image-thumb"] img').exists()).toBe(false)

    await src.setValue('//evil.example/x.jpg')
    expect(src.attributes('aria-invalid')).toBe('true')

    await src.setValue('https://example.com/photo.jpg')
    expect(src.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.get('[data-testid="image-thumb"] img').attributes('src')).toBe('https://example.com/photo.jpg')
  })

  it('requires alt text once an address is set (with a visible marker)', async () => {
    const { wrapper } = setup({ src: '/sample-wedding/cover.svg', alt: '', focalPoint: null }, { 'coverImage.alt': 'Describe the image' })
    const alt = wrapper.get('#f-coverImage-alt')
    // Space before the marker, and required semantics for assistive tech.
    expect(wrapper.get('label[for="f-coverImage-alt"]').text()).toBe('Image description (required)')
    expect(alt.attributes('aria-required')).toBe('true')
    expect(alt.attributes('aria-invalid')).toBe('true')
    expect(document.getElementById(alt.attributes('aria-describedby')!)?.textContent).toBe('Describe the image')
  })

  it('keeps focus in the field after removing the image', async () => {
    const { wrapper, model } = setup({ src: '/sample-wedding/cover.svg', alt: 'A', focalPoint: null })
    await wrapper.get('[data-action="remove-image"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(model.value.src).toBe('')
    expect(document.activeElement?.id).toBe('f-coverImage-src')
  })

  it('shows a load-error state when the image fails to load', async () => {
    const { wrapper } = setup({ src: '/sample-wedding/missing.jpg', alt: 'A', focalPoint: null })
    await wrapper.get('[data-testid="image-thumb"] img').trigger('error')
    expect(wrapper.find('[data-testid="image-load-error"]').text()).toContain('couldn’t be loaded')
  })

  it('has no "coming soon" upload teaser; the dev sample picker uses real files', async () => {
    const { wrapper, model } = setup()
    expect(wrapper.get('[data-action="upload-image"]').text()).toBe('Upload photo')
    expect(wrapper.text()).not.toMatch(/coming soon/i)
    // Vitest runs in development mode, so the sample picker is available.
    const picker = wrapper.get('[data-testid="sample-photo"]')
    await picker.setValue('gallery-2.svg')
    expect(model.value.src).toBe('/sample-wedding/gallery-2.svg')
  })

  it('sets and resets the focal point', async () => {
    const { wrapper, model } = setup({ src: '/sample-wedding/a.jpg', alt: 'A', focalPoint: null })
    expect(wrapper.find('details').exists()).toBe(false)
    const toggle = wrapper.get('[data-action="toggle-focal"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    const panel = document.getElementById(toggle.attributes('aria-controls')!)!
    expect(panel.style.display).toBe('none')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(panel.style.display).toBe('')
    const [x, y] = wrapper.findAll('[data-testid="focal-disclosure"] input[type="number"]')
    await x!.setValue('30')
    await y!.setValue('70')
    expect(model.value.focalPoint).toEqual({ x: 30, y: 70 })
  })
})
