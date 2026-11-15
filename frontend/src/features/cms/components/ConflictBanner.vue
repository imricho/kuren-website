<script setup lang="ts">
/**
 * Conflict alert (docs/ux/live-editor.md §5): shown while the wedding store is in
 * the Conflict state (another device saved since our revision). Autosave is paused
 * until the couple picks "Reload latest" (asks to confirm, then drops local edits)
 * or "Keep mine" (saves the local edits over the other version).
 *
 * No props. Place it once, directly under the editor header. While it is mounted,
 * <SaveStatus> leaves the conflict buttons to it.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import { useWeddingStore } from '@/stores/wedding'

import { conflictBanners, restoreStatusFocus } from '../composables/useSaveStatusUi'

const store = useWeddingStore()
const { t } = useAppLocale()
const busy = ref(false)

onMounted(() => conflictBanners.value++)
onBeforeUnmount(() => conflictBanners.value--)

async function act(run: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    await run()
  } finally {
    busy.value = false
    await restoreStatusFocus() // the banner unmounts once the conflict is resolved
  }
}

const button = [
  'inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium min-[400px]:h-9 min-[400px]:w-auto',
  FOCUS_RING,
]
</script>

<template>
  <div
    v-if="store.saveState === 'conflict'"
    role="alert"
    class="border-b border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    data-testid="conflict-banner"
  >
    <p class="font-medium">{{ t('conflictTitle') }}</p>
    <p class="mt-0.5">{{ t('conflictBody') }}</p>
    <div class="mt-3 flex flex-col gap-2 min-[400px]:flex-row">
      <button
        type="button"
        :class="[button, 'bg-rose-600 text-white hover:bg-rose-700']"
        :aria-disabled="busy || undefined"
        data-action="reload-latest"
        @click="act(() => store.reloadLatest())"
      >
        {{ t('reloadLatest') }}
      </button>
      <button
        type="button"
        :class="[button, 'border border-ink-500/85 bg-surface text-ink-700 hover:bg-rose-50']"
        :aria-disabled="busy || undefined"
        data-action="keep-mine"
        @click="act(() => store.keepMine())"
      >
        {{ t('keepMine') }}
      </button>
    </div>
  </div>
</template>
