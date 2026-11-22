import { describe, expect, it } from 'vitest'

import { minimalWedding, sampleWedding } from './sampleWedding'
import type { WeddingContent } from './types'
import { validateWeddingContent } from './validation'

const clone = <T>(v: T): T => structuredClone(v)

describe('shared wedding content model', () => {
  it('accepts the full sample wedding', () => {
    expect(validateWeddingContent(sampleWedding)).toEqual([])
  })

  it('accepts the minimal wedding with every optional field omitted', () => {
    expect(validateWeddingContent(minimalWedding)).toEqual([])
    expect(minimalWedding.story).toBeUndefined()
    expect(minimalWedding.gallery).toBeUndefined()
    expect(minimalWedding.opening.coverImage).toBeUndefined()
  })

  it('supports any number of events (not hardcoded to two)', () => {
    const content: WeddingContent = clone(sampleWedding)
    content.events = [
      ...content.events,
      { ...content.events[0]!, id: 'engagement', type: 'engagement', title: 'Lamaran', date: '2027-03-01' },
      { ...content.events[0]!, id: 'pengajian', type: 'other', title: 'Pengajian', date: '2027-06-10' },
    ]
    expect(validateWeddingContent(content)).toEqual([])
  })

  it('reports missing required fields', () => {
    const content = clone(sampleWedding) as WeddingContent
    content.couple.groom.name = ''
    content.closing.message = '  '
    content.events = []
    const problems = validateWeddingContent(content)
    expect(problems).toContain('couple.groom.name is required')
    expect(problems).toContain('closing.message is required')
    expect(problems).toContain('events must contain at least one event')
  })

  it('reports malformed dates, times, event types and duplicate ids', () => {
    const content = clone(sampleWedding) as WeddingContent
    content.opening.weddingDate = '12/06/2027'
    content.events[0]!.startTime = '8am'
    content.events[1]!.id = content.events[0]!.id
    ;(content.events[1] as { type: string }).type = 'banquet'
    content.rsvp.deadline = '2027-13-01'
    const problems = validateWeddingContent(content)
    expect(problems).toEqual(
      expect.arrayContaining([
        'opening.weddingDate must be YYYY-MM-DD',
        'events[0].startTime must be HH:mm',
        'events[1].id must be unique',
        'events[1].type is not a known event type',
        'rsvp.deadline must be YYYY-MM-DD',
      ]),
    )
  })

  it('requires alt text on images', () => {
    const content = clone(sampleWedding) as WeddingContent
    content.gallery!.images[0]!.alt = ''
    expect(validateWeddingContent(content)).toContain('gallery.images[0].alt is required')
  })

  it('checks the optional CMS fields (nickname, Instagram, RSVP extras)', () => {
    const content = clone(sampleWedding) as WeddingContent
    content.couple.groom.nickname = 'Alex'
    content.couple.groom.instagramUrl = 'https://www.instagram.com/alex'
    content.rsvp.confirmationMessage = 'Thank you!'
    content.rsvp.maxGuestsPerResponse = 4
    expect(validateWeddingContent(content)).toEqual([])

    content.couple.bride.instagramUrl = 'http://instagram.com/sarah'
    content.rsvp.maxGuestsPerResponse = 21
    expect(validateWeddingContent(content)).toEqual(
      expect.arrayContaining([
        'couple.bride.instagramUrl must be an https instagram.com URL',
        'rsvp.maxGuestsPerResponse must be a whole number from 1 to 20',
      ]),
    )
    content.couple.bride.instagramUrl = 'https://evil.example/instagram.com'
    content.rsvp.maxGuestsPerResponse = 2.5
    expect(validateWeddingContent(content)).toHaveLength(2)
  })
})
