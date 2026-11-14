import { describe, expect, it } from 'vitest'

import { ACTION, STATUS_LABEL, countLabel, familySummary, formatTemplatePath } from './format'

describe('picker wording', () => {
  it('formats counts the same way everywhere', () => {
    expect(countLabel({ collectionId: 'ceremonial-classic' })).toBe('1 template available')
    expect(countLabel({ collectionId: 'romantic-floral' })).toBe('1 template available')
    expect(countLabel({ familyId: 'modern-minimalist' })).toBe('1 template available')
    expect(countLabel({ familyId: 'rustic-nature' })).toBe('1 template available')
    expect(countLabel({ familyId: 'traditional' })).toBe('2 templates available')
  })

  it('summarises families in terms that agree with collection statuses', () => {
    expect(familySummary('traditional')).toBe('2 templates available')
    expect(familySummary('classic')).toBe('1 template available')
    expect(familySummary('international')).toBe('1 template available')
    expect(familySummary('modern-minimalist')).toBe('1 template available')
    expect(familySummary('rustic-nature')).toBe('1 template available')
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
