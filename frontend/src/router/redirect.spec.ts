import { describe, expect, it } from 'vitest'

import { safeRedirect } from './index'

describe('safeRedirect', () => {
  it('allows in-app paths (normalised, keeping query and hash)', () => {
    expect(safeRedirect('/account')).toBe('/account')
    expect(safeRedirect('/wedding/events?x=1#top')).toBe('/wedding/events?x=1#top')
    // Still-encoded characters are just part of an in-app path.
    expect(safeRedirect('/%09/evil.example')).toBe('/%09/evil.example')
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    'javascript:alert(1)',
    undefined,
    ['/x'],
    '/\\evil.example',
    '\\evil',
    '/\t/evil.example',
    decodeURIComponent('/%09/evil.example'),
    '/\n/evil.example',
    '/ /evil.example',
    '/\x00/evil',
  ])('falls back to the dashboard for %j', (value) => {
    expect(safeRedirect(value)).toBe('/dashboard')
  })

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil', '/wedding')).toBe('/wedding')
  })
})
