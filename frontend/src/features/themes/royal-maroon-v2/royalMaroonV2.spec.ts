import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { minimalWedding, sampleWedding } from '@/features/wedding/sampleWedding'
import { getTheme, templatesOf } from '../core/registry'
import { renderTheme } from '../testUtils'

enableAutoUnmount(afterEach)

describe('Royal Maroon v2', () => {
  it('is separately selectable alongside the original with its own renderer', () => {
    expect(getTheme('royal-maroon-v2')?.name).toBe('Royal Maroon v2')
    expect(getTheme('traditional')?.name).toBe('Royal Maroon')
    expect(getTheme('royal-maroon-v2')?.component).not.toBe(getTheme('traditional')?.component)
    expect(templatesOf('ceremonial-classic').map(t => t.id)).toContain('royal-maroon-v2')
  })

  it('derives initials from current content and hides decorative artwork', async () => {
    const wrapper = await renderTheme(minimalWedding, 'royal-maroon-v2')
    expect(wrapper.find('.rm2-monogram').text()).toBe('D & A')
    for (const art of wrapper.findAll('.rm2-art')) expect(art.attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('svg[id], svg use, svg image')).toHaveLength(0)
    expect(wrapper.findAll('.rm2-story, .rm2-gallery')).toHaveLength(0)
  })

  it('preserves the real RSVP limitation and avoids repeating the closing signature', async () => {
    const wrapper = await renderTheme(sampleWedding, 'royal-maroon-v2')
    expect(wrapper.find('.rm2-preview-note').text()).toContain('Online RSVP is not available yet')
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.rm2-closing__names').exists()).toBe(false)
    expect(wrapper.find('.rm2-closing').text()).toContain(sampleWedding.closing.thankYou)
  })

  it('carries five coordinated decorative motifs through every section', async () => {
    const wrapper = await renderTheme(sampleWedding, 'royal-maroon-v2')
    for (const kind of ['spray', 'wreath', 'vine', 'corner', 'rosette']) {
      expect(wrapper.find(`.rm2-art--${kind}`).exists()).toBe(true)
    }
    for (const section of wrapper.findAll('.rm2 > header, .rm2 > section, .rm2 > footer')) {
      expect(section.find('.rm2-art').exists()).toBe(true)
    }
    expect(wrapper.findAll('.rm2-mat > .rm2-photo-corner')).toHaveLength(sampleWedding.gallery.images.length)
    expect(wrapper.findAll('.rm2-moment__vine')).toHaveLength(sampleWedding.story.timeline.length)
    for (const art of wrapper.findAll('.rm2-art')) expect(art.attributes('aria-hidden')).toBe('true')
  })
})
