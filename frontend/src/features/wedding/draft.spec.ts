/**
 * toPreviewContent must turn ANY draft into content every theme can render.
 */
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { TEMPLATES } from '@/features/themes/core/registry'
import { isRenderable } from '@/features/themes/core/types'
import { renderTheme } from '@/features/themes/testUtils'

import { deriveCoupleNames, emptyDraft, normalizeDraft, toPreviewContent, type WeddingDraft } from './draft'
import { validateWeddingContent } from './validation'

const today = new Date(2026, 10, 14)

function partialDraft(): WeddingDraft {
  const d = emptyDraft('id')
  d.opening = { weddingTitle: 'Pernikahan Dimas & Ayu' }
  d.couple = { groom: { name: 'Dimas Pratama', nickname: 'Dimas' }, bride: { name: 'Ayu Lestari' } }
  d.events = [
    { id: 'akad', type: 'akad', date: '2027-09-04', startTime: '08:00' },
    { id: 'resepsi', type: 'reception', title: 'Resepsi', venueName: 'Balai Kota' },
  ]
  d.story = { timeline: [{ id: 's1', title: 'Pertama bertemu' }, { id: 's2', title: 'Lamaran', description: 'Di pantai.' }] }
  d.gallery = { images: [{ id: 'g1', src: 'javascript:alert(1)', alt: 'x' }, { id: 'g2', src: '/sample-wedding/gallery-1.svg', alt: 'Foto' }] }
  d.rsvp = { enabled: false }
  return d
}

describe('toPreviewContent', () => {
  it('turns an empty draft into valid content with labelled placeholders', () => {
    const { content, missing } = toPreviewContent(emptyDraft(), 'en', today)
    expect(validateWeddingContent(content)).toEqual([])
    expect(content.opening.weddingTitle).toBe('Your wedding title')
    expect(content.opening.coupleNames).toBe('Your names')
    expect(content.opening.weddingDate).toBe('2027-05-14')
    expect(content.events).toHaveLength(1)
    expect(content.events[0]!.title).toBe('Event details coming soon')
    expect(content.closing.message).toBe('Your closing message will appear here.')
    expect(missing).toEqual(
      expect.arrayContaining([
        { section: 'opening', field: 'weddingTitle' },
        { section: 'opening', field: 'weddingDate' },
        { section: 'couple', field: 'groom.name' },
        { section: 'couple', field: 'bride.name' },
        { section: 'events', field: 'events' },
        { section: 'rsvp', field: 'title' },
        { section: 'closing', field: 'message' },
      ]),
    )
  })

  it('uses the editor language for placeholders', () => {
    const { content } = toPreviewContent(emptyDraft(), 'id', today)
    expect(content.opening.coupleNames).toBe('Nama Anda berdua')
    expect(content.events[0]!.venueName).toBe('Lokasi akan diumumkan')
  })

  it('uses the website language for default section titles', () => {
    expect(toPreviewContent(emptyDraft('id'), 'en', today).content.story!.title).toBe('Kisah Kami')
    expect(toPreviewContent(emptyDraft('id'), 'en', today).content.gallery!.title).toBe('Galeri')
    expect(toPreviewContent(emptyDraft('en'), 'id', today).content.story!.title).toBe('Our Story')
  })

  it('derives couple names from nicknames or first names', () => {
    expect(deriveCoupleNames({ groom: { name: 'Dimas Pratama', nickname: 'Dim' }, bride: { name: 'Ayu Lestari' } })).toBe('Dim & Ayu')
    expect(deriveCoupleNames({ groom: { name: 'Dimas' }, bride: {} })).toBeUndefined()
    const { content } = toPreviewContent(partialDraft(), 'en', today)
    expect(content.opening.coupleNames).toBe('Dimas & Ayu')
  })

  it('fills partial events, drops unsafe images and incomplete story entries', () => {
    const { content, missing } = toPreviewContent(partialDraft(), 'en', today)
    expect(validateWeddingContent(content)).toEqual([])
    expect(content.locale).toBe('id')
    // The wedding date falls back to the first event date, never an empty string.
    expect(content.opening.weddingDate).toBe('2027-09-04')
    expect(content.events[0]!.title).toBe('Akad Nikah')
    expect(content.events[1]!.date).toBe('2027-09-04')
    expect(content.story!.timeline.map((e) => e.id)).toEqual(['s2'])
    expect(content.gallery!.images.map((i) => i.id)).toEqual(['g2'])
    expect(content.rsvp.enabled).toBe(false)
    expect(missing).toEqual(expect.arrayContaining([{ section: 'events', field: '0.venueName' }, { section: 'events', field: '1.startTime' }]))
    expect(missing).not.toContainEqual({ section: 'couple', field: 'groom.name' })
  })

  it('never passes undefined keys or empty strings to themes', () => {
    const d = normalizeDraft({ opening: { weddingTitle: '  ', headline: '' } } as Partial<WeddingDraft>)
    const { content } = toPreviewContent(d, 'en', today)
    expect('headline' in content.opening).toBe(false)
    expect(content.opening.weddingTitle).toBe('Your wedding title')
  })
})

describe('preview content renders in every template', () => {
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

  describe.each(TEMPLATES.filter(isRenderable).map((t) => [t.id]))('%s', (themeId) => {
    it('renders an empty draft', async () => {
      const wrapper = await renderTheme(toPreviewContent(emptyDraft(), 'en', today).content, themeId)
      expect(wrapper.text()).toContain('Your names')
      expect(wrapper.text()).not.toContain('undefined')
    })

    it('renders a partial draft', async () => {
      const wrapper = await renderTheme(toPreviewContent(partialDraft(), 'en', today).content, themeId)
      expect(wrapper.text()).toContain('Dimas')
      expect(wrapper.text()).toContain('Resepsi')
      expect(wrapper.text()).not.toContain('undefined')
    })
  })
})
