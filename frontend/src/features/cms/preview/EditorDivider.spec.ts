import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import EditorDivider from './EditorDivider.vue'
import { editorWidthBounds } from './editorWidth'

function mountDivider(initial = 40, bounds = { min: 30, max: 55 }, reverse = false) {
  const width = ref(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(EditorDivider, { modelValue: width.value, 'onUpdate:modelValue': (v: number) => (width.value = v), bounds, reverse, controls: 'editor-panel' }),
  })
  const wrapper = mount(Host)
  return { wrapper, width, sep: () => wrapper.get('[role="separator"]') }
}

describe('EditorDivider', () => {
  it('is a labelled, focusable vertical separator controlling the editor panel', () => {
    const { sep } = mountDivider()
    expect(sep().attributes()).toMatchObject({
      tabindex: '0',
      'aria-orientation': 'vertical',
      'aria-controls': 'editor-panel',
      'aria-valuemin': '30',
      'aria-valuemax': '55',
      'aria-valuenow': '40',
      'aria-valuetext': 'Editor 40%',
      'aria-label': 'Resize editor',
    })
  })

  it('a single click (no drag) toggles between the narrowest and widest editor (WCAG 2.5.7)', async () => {
    const { sep, width } = mountDivider()
    const click = async (x: number) => {
      await sep().trigger('pointerdown', { button: 0, pointerId: 1, clientX: x })
      await sep().trigger('pointerup', { button: 0, pointerId: 1, clientX: x + 1 })
    }
    await click(400)
    expect(width.value).toBe(30) // at/above the default → narrowest
    await click(300)
    expect(width.value).toBe(55) // below the default → widest
  })

  it('resizes with arrows (±2, Shift ±10), Home/End and resets with Enter / double-click', async () => {
    const { sep, width } = mountDivider()
    await sep().trigger('keydown', { key: 'ArrowRight' })
    expect(width.value).toBe(42)
    expect(sep().attributes('aria-valuenow')).toBe('42')
    await sep().trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(width.value).toBe(32)
    await sep().trigger('keydown', { key: 'ArrowLeft' })
    await sep().trigger('keydown', { key: 'ArrowLeft' })
    expect(width.value).toBe(30) // clamped
    await sep().trigger('keydown', { key: 'End' })
    expect(width.value).toBe(55)
    expect(sep().attributes('aria-valuetext')).toBe('Editor 55%')
    await sep().trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(width.value).toBe(55)
    await sep().trigger('keydown', { key: 'Home' })
    expect(width.value).toBe(30)
    await sep().trigger('keydown', { key: 'Enter' })
    expect(width.value).toBe(40)
    await sep().trigger('keydown', { key: 'End' })
    await sep().trigger('dblclick')
    expect(width.value).toBe(40)
  })

  it('moves the separator in the arrow direction when the editor is on the right', async () => {
    const { sep, width } = mountDivider(40, { min: 30, max: 49 }, true)
    await sep().trigger('keydown', { key: 'ArrowRight' })
    expect(width.value).toBe(38)
    await sep().trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(width.value).toBe(48)
    await sep().trigger('keydown', { key: 'ArrowLeft' })
    expect(width.value).toBe(49)
  })

  it('keeps the editor ≥360px and the preview ≥420px', () => {
    expect(editorWidthBounds(1000)).toEqual({ min: 36, max: 55 })
    const narrow = editorWidthBounds(800)
    expect(narrow.min).toBe(45)
    expect(narrow.max).toBeCloseTo(46.5, 1)
    expect(editorWidthBounds(0)).toEqual({ min: 30, max: 55 })
  })
})
