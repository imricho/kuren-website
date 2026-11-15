import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('dev sample photos', () => {
  it('only lists files that exist in public/sample-wedding', () => {
    const source = readFileSync(resolve(__dirname, 'components/ImageField.vue'), 'utf8')
    const block = source.match(/SAMPLE_PHOTOS[^=]*= import\.meta\.env\.DEV \? \[([\s\S]*?)\]/)![1]!
    const files = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(existsSync(resolve(__dirname, '../../../public/sample-wedding', file)), file).toBe(true)
  })
})
