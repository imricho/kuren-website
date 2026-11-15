import { describe, expect, it } from 'vitest'

import { daysUntil } from './countdown'

describe('daysUntil', () => {
  const today = new Date(2026, 10, 15, 18, 30) // 15 Nov 2026, evening
  it('counts whole calendar days', () => {
    expect(daysUntil('2026-11-15', today)).toBe(0)
    expect(daysUntil('2026-11-16', today)).toBe(1)
    expect(daysUntil('2027-11-15', today)).toBe(365)
    expect(daysUntil('2026-11-14', today)).toBe(-1)
  })
  it('is undefined without a valid date', () => {
    expect(daysUntil(undefined, today)).toBeUndefined()
    expect(daysUntil('2026-13-01', today)).toBeUndefined()
  })
})
