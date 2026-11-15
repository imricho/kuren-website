/** True when the user asked the OS to reduce motion (no matchMedia → assume reduced, the safe choice). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** `scrollIntoView` that only animates when motion is welcome. */
export function scrollIntoViewRespectingMotion(el: Element | null | undefined, options: ScrollIntoViewOptions = {}) {
  el?.scrollIntoView?.({ ...options, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
