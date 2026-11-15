import { describe, expect, it } from 'vitest'

import { ACTION, STATUS_LABEL, countLabel, familySummary, formatTemplatePath } from './format'

describe('picker wording', () => {
  it('formats counts the same way everywhere', () => {
    expect(countLabel({ collectionId: 'ceremonial-classic' })).toBe('3 templates available')
    expect(countLabel({ collectionId: 'romantic-floral' })).toBe('2 templates available')
    expect(countLabel({ familyId: 'modern-minimalist' })).toBe('8 templates available')
    expect(countLabel({ familyId: 'rustic-nature' })).toBe('8 templates available')
    expect(countLabel({ familyId: 'traditional' })).toBe('9 templates available')
  })

  it('summarises families in terms that agree with collection statuses', () => {
    for (const family of ['traditional', 'classic', 'international', 'artistic', 'modern-minimalist', 'rustic-nature']) {
      expect(familySummary(family)).toBe(family === 'traditional' ? '9 templates available' : '8 templates available')
    }
  })

  it('formats the selected path as Family › Collection › Template', () => {
    expect(formatTemplatePath('conventional')).toBe('Conventional / Classic › Romantic Floral › Blush Garden')
    expect(formatTemplatePath('nope')).toBeUndefined()
  })

  it('keeps preview and select as distinct actions', () => {
    expect(ACTION.preview).not.toBe(ACTION.select)
    expect(STATUS_LABEL.coming_soon).toBe('In development')
  })
})
