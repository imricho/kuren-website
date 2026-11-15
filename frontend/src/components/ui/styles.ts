/**
 * Shared class strings for form controls and interactive elements, so every
 * control gets the same visible focus indicator and accessible contrast.
 *
 * - Focus: 2px rose-600 outline with a 2px offset (5.3:1 against white).
 * - Control border: ink-500 at 85% (≈3.6:1 against white, WCAG 1.4.11).
 *
 * Tailwind scans this file, so the classes below are generated.
 */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600'
export const FOCUS_RING_DANGER = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-600'

/** Border for text inputs, selects and textareas. */
export const CONTROL_BORDER = 'border-ink-500/85'

/** Base classes for text-like controls (input/select/textarea), without size. */
export function controlClasses(error?: string | boolean): string {
  return [
    'block w-full rounded-lg border bg-surface text-sm text-ink-900 placeholder:text-ink-500 transition-colors motion-reduce:transition-none',
    error ? `border-danger-600 ${FOCUS_RING_DANGER}` : `${CONTROL_BORDER} hover:border-ink-700 ${FOCUS_RING}`,
  ].join(' ')
}
