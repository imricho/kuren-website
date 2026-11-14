import { describe, expect, it } from 'vitest'

import { safeRedirect } from './index'

describe('safeRedirect', () => {
  it('allows in-app paths', () => {
    expect(safeRedirect('/account')).toBe('/account')
  })

  it.each(['https://evil.example', '//evil.example', 'javascript:alert(1)', undefined, ['/x']])(
    'falls back to the dashboard for %s',
    (value) => {
      expect(safeRedirect(value)).toBe('/dashboard')
    },
  )
})
