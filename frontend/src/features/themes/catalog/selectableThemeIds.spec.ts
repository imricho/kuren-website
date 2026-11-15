/**
 * The backend only accepts theme ids from an allowlist generated from this registry.
 * Fail fast when the registry and the allowlists drift apart.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { THEMES } from '../core/registry'

const frontendList = resolve(__dirname, 'selectable-theme-ids.json')
// frontend/src/features/themes/catalog → repo root → backend/app/core
const backendList = resolve(__dirname, '../../../../../backend/app/core/selectable_theme_ids.json')

const read = (path: string): string[] => JSON.parse(readFileSync(path, 'utf8')) as string[]
const sorted = (ids: readonly string[]) => [...ids].sort()

describe('selectable theme allowlist', () => {
  it('matches the selectable (available) templates in the registry', () => {
    expect(sorted(read(frontendList))).toEqual(sorted(THEMES.map((t) => t.id)))
  })

  it.skipIf(!existsSync(backendList))(
    'is identical to backend/app/core/selectable_theme_ids.json (skipped when the backend folder is not accessible, e.g. in the frontend container)',
    () => {
      expect(sorted(read(backendList))).toEqual(sorted(read(frontendList)))
    },
  )
})
