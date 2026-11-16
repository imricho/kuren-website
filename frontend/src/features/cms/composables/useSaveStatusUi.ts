/**
 * Page-wide pieces of the save status UI that must exist once, even though
 * <SaveStatus> may be mounted twice (desktop header + mobile tab bar):
 *  - the Ctrl/Cmd+S shortcut ("Save now");
 *  - which instance owns the polite announcement region;
 *  - whether a <ConflictBanner> is on the page (then it holds the conflict actions).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue'

import { useWeddingStore } from '@/stores/wedding'

let shortcutUsers = 0
let removeShortcut: (() => void) | null = null

/** Ctrl+S / Cmd+S saves right away instead of opening the browser's "Save page". */
export function useSaveShortcut() {
  const store = useWeddingStore()
  onMounted(() => {
    if (shortcutUsers++ > 0) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      event.preventDefault()
      void store.saveNow({ announce: true })
    }
    window.addEventListener('keydown', onKeydown)
    removeShortcut = () => window.removeEventListener('keydown', onKeydown)
  })
  onBeforeUnmount(() => {
    if (--shortcutUsers > 0) return
    removeShortcut?.()
    removeShortcut = null
  })
}

const regionOwners: symbol[] = []
const regionOwner = ref<symbol | null>(null)

/** True for the one mounted instance that renders the announcement region. */
export function useAnnouncerOwnership(): ComputedRef<boolean> {
  const me = Symbol('save-status')
  const update = () => {
    regionOwner.value = regionOwners[0] ?? null
  }
  onMounted(() => {
    regionOwners.push(me)
    update()
  })
  onBeforeUnmount(() => {
    regionOwners.splice(regionOwners.indexOf(me), 1)
    update()
  })
  return computed(() => regionOwner.value === me)
}

/**
 * After a save-status action, its button is usually gone (Save now / Retry / the
 * conflict banner). If focus fell to <body>, put it on the visible status text.
 */
export async function restoreStatusFocus() {
  await nextTick()
  const active = document.activeElement
  if (active && active !== document.body && active.isConnected) return
  const anchors = [...document.querySelectorAll<HTMLElement>('[data-save-status-anchor]')]
  // Prefer the instance that is actually shown (desktop header vs mobile tab bar).
  const shown = (el: HTMLElement) => {
    if (el.getClientRects().length > 0) return true
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (node.hidden || getComputedStyle(node).display === 'none') return false
    }
    return true // no layout information (e.g. tests): not known to be hidden
  }
  anchors.find(shown)?.focus()
}

/** Number of mounted <ConflictBanner>s. */
export const conflictBanners = ref(0)
