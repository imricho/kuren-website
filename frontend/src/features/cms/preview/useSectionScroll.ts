/**
 * One-way sync: when the editor's current section changes, scroll the preview
 * frame's scroller to that section (`[data-section="<key>"]`). The user may
 * scroll the preview freely afterwards; nothing syncs back.
 *
 *  - Never moves focus.
 *  - Missing section (theme rendered without it) → do nothing.
 *  - Theme not rendered yet (async chunk) → wait for it once, then try.
 *  - Hidden preview (mobile Edit tab) → remember the request and apply it when
 *    the preview becomes visible again (`flush`).
 *  - Smooth only when motion is welcome.
 */
import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

import { prefersReducedMotion } from '../motion'

export interface SectionScrollOptions {
  scroller: Ref<HTMLElement | null>
  section: () => string | null | undefined
  /** Current CSS scale of the scroller (rects are scaled, scrollTop is not). */
  scale: () => number
  visible: () => boolean
}

const selectorFor = (key: string) =>
  `[data-section="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key.replace(/"/g, '')}"]`

/** Offset of `target` inside `scroller`, in the scroller's own (unscaled) scroll coordinates. */
export function sectionScrollTop(scroller: HTMLElement, target: HTMLElement, scale: number): number {
  const delta = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  return Math.max(0, Math.round(scroller.scrollTop + delta / (scale || 1)))
}

export function useSectionScroll(options: SectionScrollOptions) {
  let pending: string | null = null
  let observer: MutationObserver | null = null

  const stopWaiting = () => {
    observer?.disconnect()
    observer = null
  }

  /** Try to apply the pending request. Returns true when it is settled (scrolled or dropped). */
  function attempt(): boolean {
    const scroller = options.scroller.value
    const key = pending
    if (!key) return true
    if (!scroller || !options.visible()) return false
    const target = scroller.querySelector<HTMLElement>(selectorFor(key))
    if (!target) {
      // Theme rendered but has no such section → drop it; not rendered yet → keep waiting.
      if (scroller.querySelector('[data-section]')) {
        pending = null
        return true
      }
      return false
    }
    pending = null
    const top = sectionScrollTop(scroller, target, options.scale())
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top, behavior })
    else scroller.scrollTop = top
    return true
  }

  function waitForTheme() {
    stopWaiting()
    const scroller = options.scroller.value
    if (!scroller || typeof MutationObserver !== 'function') return
    observer = new MutationObserver(() => {
      if (attempt()) stopWaiting()
    })
    observer.observe(scroller, { childList: true, subtree: true })
  }

  function request(key: string | null | undefined) {
    pending = key ?? null
    stopWaiting()
    void nextTick(() => {
      if (!attempt() && options.visible()) waitForTheme()
    })
  }

  /** Apply a request deferred while the preview was hidden. Returns true if one was applied/settled. */
  function flush(): boolean {
    if (!pending) return false
    if (!attempt()) {
      waitForTheme()
      return true
    }
    return true
  }

  watch(options.section, request, { immediate: true })
  watch(options.scroller, (el) => el && pending && request(pending))
  onBeforeUnmount(stopWaiting)

  return { flush, hasPending: () => pending !== null }
}
