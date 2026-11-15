import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { sampleWedding, minimalWedding } from '@/features/wedding/sampleWedding'
import { renderTheme } from './testUtils'

enableAutoUnmount(afterEach)

describe('theme ornament composition', () => {
  it('keeps Royal filigree decorative and available without a cover image', async () => {
    const wrapper = await renderTheme(minimalWedding, 'traditional')
    expect(wrapper.find('.t-trad').attributes('data-ornament-density')).toBe('ornate')
    expect(wrapper.find('.trad-crest').exists()).toBe(true)
    for (const ornament of wrapper.findAll('.trad-crest, .trad-corner, .trad-divider')) {
      expect(ornament.attributes('aria-hidden')).toBe('true')
      expect(ornament.attributes('focusable')).toBe('false')
      expect(ornament.findAll('image, script, foreignObject')).toHaveLength(0)
    }
    expect(wrapper.find('h1').text()).toContain(minimalWedding.couple.groom.name)
  })

  it('frames Botanical with two bouquets while keeping content unchanged', async () => {
    const wrapper = await renderTheme(sampleWedding, 'conventional')
    expect(wrapper.find('.t-conv').attributes('data-ornament-density')).toBe('balanced')
    expect(wrapper.find('.conv-hero').findAll('.conv-bouquet')).toHaveLength(2)
    for (const bouquet of wrapper.findAll('.conv-bouquet')) {
      expect(bouquet.attributes('aria-hidden')).toBe('true')
      expect(bouquet.attributes('focusable')).toBe('false')
    }
    expect(wrapper.text()).toContain(sampleWedding.opening.coupleNames)
  })

  it('keeps Modern Minimalist free of floral or filigree assets', async () => {
    const wrapper = await renderTheme(sampleWedding, 'still-form')
    expect(wrapper.find('.t-minimal').attributes('data-ornament-density')).toBe('minimal')
    expect(wrapper.findAll('.trad-crest, .trad-corner, .conv-bouquet, .conv-sprig')).toHaveLength(0)
    expect(wrapper.text()).toContain(sampleWedding.closing.message)
  })
})
