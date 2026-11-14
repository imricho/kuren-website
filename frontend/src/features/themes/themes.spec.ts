/**
 * Every theme must render the SAME shared content model — full, minimal and
 * edge-case content — without errors or Vue warnings.
 */
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { minimalWedding, sampleWedding } from '@/features/wedding/sampleWedding'
import type { WeddingContent } from '@/features/wedding/types'

import { TEMPLATES } from './core/registry'
import { isRenderable } from './core/types'
import { renderTheme } from './testUtils'

enableAutoUnmount(afterEach)

let warn: MockInstance
let error: MockInstance
beforeEach(() => {
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})
afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

const clone = (c: WeddingContent): WeddingContent => structuredClone(c)

// Every renderable template — the 5 available ones and the 12 regional drafts — must honour
// the shared content contract.
describe.each(TEMPLATES.filter(isRenderable).map((t) => [t.id]))('%s theme', (themeId) => {
  it('renders every section of the shared sample data', async () => {
    const wrapper = await renderTheme(sampleWedding, themeId)
    const text = wrapper.text()

    // Opening & couple
    expect(text).toContain('Alexander')
    expect(text).toContain('Sarah Putri')
    expect(text).toContain(sampleWedding.opening.headline)
    expect(text).toContain(sampleWedding.couple.groom.description)
    // Story
    for (const entry of sampleWedding.story.timeline) expect(text).toContain(entry.title)
    // Events (all of them, whatever the count)
    for (const event of sampleWedding.events) {
      expect(text).toContain(event.title)
      expect(text).toContain(event.venueName)
    }
    expect(wrapper.findAll('a[href^="https://www.google.com/maps"]').length).toBe(sampleWedding.events.length)
    // Gallery
    expect(text).toContain(sampleWedding.gallery.title)
    for (const img of sampleWedding.gallery.images) {
      expect(wrapper.find(`img[src="${img.src}"]`).exists()).toBe(true)
    }
    // RSVP & closing
    expect(text).toContain(sampleWedding.rsvp.title)
    expect(text).toContain(sampleWedding.closing.message)
    expect(text).toContain(sampleWedding.closing.thankYou)
  })

  it('renders minimal content (all optional fields missing)', async () => {
    const wrapper = await renderTheme(minimalWedding, themeId)
    const text = wrapper.text()
    expect(text).toContain('Dimas')
    expect(text).toContain('Ayu')
    expect(text).toContain('Wedding Celebration')
    expect(text).toContain(minimalWedding.closing.message)
    expect(text).not.toContain('undefined')
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(text).toContain('RSVP is not being collected online')
  })

  it('omits the gallery section when there are no images', async () => {
    const content = clone(sampleWedding)
    content.gallery!.images = []
    const wrapper = await renderTheme(content, themeId)
    expect(wrapper.text()).not.toContain(sampleWedding.gallery.title)
  })

  it('shows a placeholder instead of a broken image', async () => {
    const content = clone(sampleWedding)
    content.gallery!.images[0]!.src = '/missing.jpg'
    content.gallery!.images[1]!.src = 'javascript:alert(1)'
    const wrapper = await renderTheme(content, themeId)

    await wrapper.find('img[src="/missing.jpg"]').trigger('error')
    expect(wrapper.find('img[src="/missing.jpg"]').exists()).toBe(false)
    expect(wrapper.find('img[src^="javascript:"]').exists()).toBe(false)
    const placeholders = wrapper.findAll('.theme-image--placeholder')
    expect(placeholders.map((p) => p.attributes('aria-label'))).toEqual(
      expect.arrayContaining([content.gallery!.images[0]!.alt, content.gallery!.images[1]!.alt]),
    )
  })

  it('renders three or more events', async () => {
    const content = clone(sampleWedding)
    content.events.push({ ...content.events[0]!, id: 'extra', title: 'Ngunduh Mantu', venueName: 'Rumah Wijaya' })
    const wrapper = await renderTheme(content, themeId)
    expect(wrapper.text()).toContain('Ngunduh Mantu')
    expect(wrapper.text()).toContain('Rumah Wijaya')
  })

  it('uses Indonesian labels and dates when locale is "id"', async () => {
    const wrapper = await renderTheme({ ...clone(sampleWedding), locale: 'id' }, themeId)
    expect(wrapper.text()).toContain('Juni')
    expect(wrapper.text()).toContain('Lihat peta')
  })

  it('hides the RSVP form and explains why when the deadline has passed', async () => {
    const content = clone(sampleWedding)
    content.rsvp.deadline = '2020-01-01'
    const wrapper = await renderTheme(content, themeId)
    expect(wrapper.text()).toContain('RSVP has closed')
    expect(wrapper.find('.rsvp-form').exists()).toBe(false)
  })

  it('omits optional text and images without leaving empty placeholders', async () => {
    const content = clone(sampleWedding)
    delete content.opening.headline
    delete content.opening.introduction
    delete content.couple.groom.image
    delete content.couple.groom.description
    delete content.closing.thankYou
    delete content.closing.image
    content.story!.timeline = []
    const wrapper = await renderTheme(content, themeId)
    const text = wrapper.text()
    expect(text).not.toContain(sampleWedding.opening.headline)
    expect(text).not.toContain(sampleWedding.story.title)
    expect(text).not.toContain('undefined')
    expect(wrapper.find('img[src*="groom"]').exists()).toBe(false)
    expect(wrapper.findAll('.theme-image--placeholder')).toHaveLength(0)
  })

  it('lazy-loads images below the cover', async () => {
    const wrapper = await renderTheme(sampleWedding, themeId)
    const lazy = wrapper.findAll('img').filter((img) => img.attributes('loading') === 'lazy')
    expect(lazy.length).toBeGreaterThanOrEqual(sampleWedding.gallery.images.length)
    expect(wrapper.findAll('img').every((img) => img.attributes('alt'))).toBe(true)
  })
})
