/**
 * The customer's chosen theme.
 *
 * `selectedThemeId` comes from the wedding record (PATCH /weddings/{id}); the
 * Workstream 2 localStorage value is migrated once by the wedding store (see
 * `migrateLegacyTheme`). Previewing a template is session-only.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/api/http'
import { getTheme } from '@/features/themes/core/registry'
import { isSelectable } from '@/features/themes/core/types'

import { StaleError, useWeddingStore } from './wedding'
import { useAuthStore } from './auth'

export const useThemeSelectionStore = defineStore('themeSelection', () => {
  const wedding = useWeddingStore()
  const auth = useAuthStore()

  const selectedThemeId = computed<string | null>(() => wedding.themeId)
  const selectedTheme = computed(() => getTheme(selectedThemeId.value))

  /** Template id whose selection is being saved, if any. */
  const pendingThemeId = ref<string | null>(null)
  /** The last failed selection (cleared on the next attempt). */
  const error = ref<{ themeId: string; message: string } | null>(null)

  /**
   * Select a template (pessimistic: `selectedThemeId` changes only once the server
   * has saved it). Resolves true on success. Drafts and unknown ids are ignored.
   */
  async function select(idOrAlias: string): Promise<boolean> {
    // Always store the canonical id, even if an alias was passed. Drafts are preview-only.
    if (pendingThemeId.value !== null) return false
    const ownerId = auth.user?.id ?? null
    const theme = getTheme(idOrAlias)
    if (!theme || !isSelectable(theme)) return false
    const id = theme.id
    pendingThemeId.value = id
    error.value = null
    try {
      await wedding.ensureLoaded()
      if ((auth.user?.id ?? null) !== ownerId) return false
      if (wedding.loadState !== 'ready') throw new Error(wedding.loadError ?? 'Your website could not be loaded.')
      if (wedding.themeId !== id) await wedding.setTheme(id)
      return (auth.user?.id ?? null) === ownerId
    } catch (err) {
      if (err instanceof StaleError) return false
      error.value = { themeId: id, message: err instanceof ApiError || err instanceof Error ? err.message : String(err) }
      return false
    } finally {
      if (pendingThemeId.value === id) pendingThemeId.value = null
    }
  }

  /**
   * The template currently shown in the preview pane. Previewing is session-only and never
   * changes `selectedThemeId`; it just lets the preview persist while the user browses levels.
   */
  const previewedThemeId = ref<string | null>(null)
  function preview(idOrAlias: string) {
    const id = getTheme(idOrAlias)?.id
    if (id) previewedThemeId.value = id
  }

  return { selectedThemeId, selectedTheme, pendingThemeId, error, select, previewedThemeId, preview }
})
