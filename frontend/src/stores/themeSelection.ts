/**
 * The customer's chosen theme.
 *
 * TEMPORARY (Workstream 2): kept in this browser's localStorage only. The CMS
 * workstream will persist it on the wedding record and load it from the API.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getTheme, isThemeId } from '@/features/themes/core/registry'

const STORAGE_KEY = 'kuren.selectedThemeId'

function readStored(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isThemeId(value) ? getTheme(value)!.id : null
  } catch {
    return null
  }
}

export const useThemeSelectionStore = defineStore('themeSelection', () => {
  const selectedThemeId = ref<string | null>(readStored())
  const selectedTheme = computed(() => getTheme(selectedThemeId.value))

  function select(idOrAlias: string) {
    // Always store the canonical id, even if an alias was passed.
    const id = getTheme(idOrAlias)?.id
    if (!id) return
    selectedThemeId.value = id
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage unavailable (private mode); selection still works for this visit.
    }
  }

  return { selectedThemeId, selectedTheme, select }
})
