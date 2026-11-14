import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useThemeSelectionStore } from './themeSelection'

describe('theme selection store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts with no selection', () => {
    expect(useThemeSelectionStore().selectedThemeId).toBeNull()
  })

  it('selects and remembers a valid theme', () => {
    useThemeSelectionStore().select('ethnic')
    expect(localStorage.getItem('kuren.selectedThemeId')).toBe('ethnic')

    setActivePinia(createPinia())
    const reloaded = useThemeSelectionStore()
    expect(reloaded.selectedThemeId).toBe('ethnic')
    // The id is stable; only the display name changed with the theme-family update.
    expect(reloaded.selectedTheme?.name).toBe('Woven Indigo')
  })

  it('ignores unknown theme ids, including stale stored ones', () => {
    const store = useThemeSelectionStore()
    store.select('not-a-theme')
    expect(store.selectedThemeId).toBeNull()

    localStorage.setItem('kuren.selectedThemeId', 'removed-theme')
    setActivePinia(createPinia())
    expect(useThemeSelectionStore().selectedThemeId).toBeNull()
  })
})
