<script setup lang="ts">
/**
 * Always-visible save status for the live editor (docs/ux/live-editor.md §5, §10).
 * No props: reads the wedding store's aggregate `saveState`. Placed by the editor
 * layout in the desktop header and the mobile tab bar (both may be mounted).
 *
 * - Text is NOT a live region (it changes on every keystroke). One polite sr-only
 *   region (owned by the first mounted instance, teleported to <body>) announces
 *   only Failed, Offline, Conflict, and Saved after a manual save / Retry.
 * - Below 400px it shows icon + short word; the full text stays for screen readers.
 * - Actions: Save now (Unsaved), Retry (Failed). Conflict actions live in
 *   <ConflictBanner>; they are shown here only when no banner is mounted.
 * - Also installs Ctrl/Cmd+S.
 */
import { computed, nextTick, ref, watch } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { useInvitationStore, type SaveState } from '@/stores/invitation'

import { conflictBanners, restoreStatusFocus, useAnnouncerOwnership, useSaveShortcut } from '../composables/useSaveStatusUi'

const store = useInvitationStore()
const { t } = useAppLocale()
useSaveShortcut()
const ownsRegion = useAnnouncerOwnership()

const COPY: Record<SaveState, { full: AppMessageKey; short: AppMessageKey; tone: string }> = {
  saved: { full: 'saveStatusSaved', short: 'saveShortSaved', tone: 'text-ink-500' },
  unsaved: { full: 'saveStatusUnsaved', short: 'saveShortUnsaved', tone: 'text-amber-800' },
  invalid: { full: 'saveStatusInvalid', short: 'saveShortInvalid', tone: 'text-danger-600' },
  saving: { full: 'saveStatusSaving', short: 'saveShortSaving', tone: 'text-ink-700' },
  failed: { full: 'saveStatusFailed', short: 'saveShortFailed', tone: 'text-danger-600' },
  offline: { full: 'saveStatusOffline', short: 'saveShortOffline', tone: 'text-ink-700' },
  conflict: { full: 'saveStatusConflict', short: 'saveShortConflict', tone: 'text-amber-800' },
}

const state = computed(() => store.saveState)
const copy = computed(() => COPY[state.value])
const busy = ref(false)
const showConflictActions = computed(() => state.value === 'conflict' && conflictBanners.value === 0)

async function act(run: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  try {
    await run()
  } finally {
    busy.value = false
    // The clicked button disappears with the state it belonged to (WCAG 2.4.3).
    await restoreStatusFocus()
  }
}

// Announcements: clear first so repeating the same text is announced again.
const announcement = ref('')
const ANNOUNCE: Record<'saved' | 'invalid' | 'failed' | 'offline' | 'conflict', AppMessageKey> = {
  saved: 'saveStatusSaved',
  invalid: 'saveStatusInvalid',
  failed: 'saveStatusFailed',
  offline: 'saveStatusOffline',
  conflict: 'saveStatusConflict',
}
watch(
  () => store.announcement,
  (a) => {
    announcement.value = ''
    // The banner (role="alert") already announces a conflict.
    if (!a || (a.kind === 'conflict' && conflictBanners.value > 0)) return
    const text = t(ANNOUNCE[a.kind])
    nextTick(() => (announcement.value = text))
  },
)

const button = [
  'inline-flex h-9 shrink-0 items-center rounded-md border border-ink-500/85 bg-surface px-3 text-sm font-medium text-ink-700 hover:bg-rose-50 min-[400px]:h-8',
  FOCUS_RING,
]
</script>

<template>
  <div data-testid="save-status" :data-state="state" class="flex min-w-0 items-center gap-2 text-sm">
    <p class="flex min-w-0 items-center gap-1.5 outline-none" :class="copy.tone" tabindex="-1" data-save-status-anchor>
      <!-- Icon per state (decorative; the text says it). -->
      <svg v-if="state === 'saved'" class="size-3.5 shrink-0 text-success-600" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span v-else-if="state === 'unsaved'" class="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
      <span v-else-if="state === 'invalid'" class="size-2 shrink-0 rounded-full bg-danger-600" aria-hidden="true" />
      <svg
        v-else-if="state === 'saving'"
        class="size-3.5 shrink-0 motion-safe:animate-spin"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-else-if="state === 'offline'" class="size-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4.5 12.5h7a3 3 0 0 0 .4-6A4.5 4.5 0 0 0 3.6 7.6 2.5 2.5 0 0 0 4.5 12.5ZM2 2l12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <svg v-else class="size-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.75 15 14H1L8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M8 6v3.5M8 11.5v.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span class="leading-tight max-[399px]:sr-only" data-testid="save-status-text">{{ t(copy.full) }}</span>
      <span class="whitespace-nowrap min-[400px]:hidden" aria-hidden="true">{{ t(copy.short) }}</span>
    </p>

    <button v-if="state === 'unsaved' || state === 'invalid'" type="button" :class="button" data-action="save-now" @click="act(() => store.saveNow({ announce: true }))">
      {{ t('saveNow') }}
    </button>
    <button v-else-if="state === 'failed'" type="button" :class="button" data-action="retry-save" @click="act(() => store.retry())">
      {{ t('retrySave') }}
    </button>
    <template v-else-if="showConflictActions">
      <button type="button" :class="button" data-action="reload-latest" @click="act(() => store.reloadLatest())">
        {{ t('reloadLatest') }}
      </button>
      <button type="button" :class="button" data-action="keep-mine" @click="act(() => store.keepMine())">
        {{ t('keepMine') }}
      </button>
    </template>

    <Teleport v-if="ownsRegion" to="body">
      <p class="sr-only" role="status" aria-live="polite" data-testid="save-status-live">{{ announcement }}</p>
    </Teleport>
  </div>
</template>
