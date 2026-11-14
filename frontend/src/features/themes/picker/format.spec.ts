import { describe, expect, it } from 'vitest'

import { ACTION, STATUS_LABEL, countLabel, familySummary, formatTemplatePath } from './format'

describe('picker wording', () => {
  it('formats counts the same way everywhere', () => {
    expect(countLabel({ collectionId: 'nusantara-heritage' })).toBe('2 templates available')
    expect(countLabel({ collectionId: 'romantic-floral' })).toBe('1 template available')
    expect(countLabel({ collectionId: 'javanese' })).toBe('2 templates coming soon')
    expect(countLabel({ collectionId: 'batak' })).toBe('1 template coming soon')
    expect(countLabel({ collectionId: 'dayak' })).toBe('In development')
    expect(countLabel({ familyId: 'traditional' })).toBe('2 templates available · 3 coming soon')
  })

  it('summarises families in terms that agree with collection statuses', () => {
    expect(familySummary('traditional')).toBe('2 templates available · 12 regional collections coming soon')
    expect(familySummary('classic')).toBe('1 template available')
    expect(familySummary('international')).toBe('1 template available')
    expect(familySummary('modern-minimalist')).toBe('In development — no collections yet')
    expect(familySummary('rustic-nature')).toBe('In development — no collections yet')
  })

  it('formats the selected path as Family › Collection › Template', () => {
    expect(formatTemplatePath('conventional')).toBe('Conventional / Classic › Romantic Floral › Blush Garden')
    expect(formatTemplatePath('nope')).toBeUndefined()
  })

  it('keeps preview and select as distinct actions', () => {
    expect(ACTION.preview).not.toBe(ACTION.select)
    expect(STATUS_LABEL.coming_soon).toBe('Coming soon')
  })
})
