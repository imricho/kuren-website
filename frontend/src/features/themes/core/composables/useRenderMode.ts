import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'

/**
 * Where a theme is being rendered:
 *  - `draft`: editor live preview, full-screen draft preview, template browsing.
 *    Editor-only notes ("Online RSVP is not available yet") and inert previews of
 *    interactive features may appear.
 *  - `public`: the published invitation guests see. No editor/sample text, no
 *    form fields, interactive features (Add to Calendar) are live.
 */
export type RenderMode = 'draft' | 'public'

interface RenderContext {
  mode: ComputedRef<RenderMode>
  /** Sanitised guest name from `?to=` (public page only). */
  guestName: ComputedRef<string | undefined>
}

const RENDER_CONTEXT: InjectionKey<RenderContext> = Symbol('themeRenderContext')

export function provideRenderContext(source: { mode: () => RenderMode; guestName: () => string | undefined }) {
  provide(RENDER_CONTEXT, { mode: computed(source.mode), guestName: computed(source.guestName) })
}

const DEFAULT_CONTEXT: RenderContext = {
  mode: computed(() => 'draft' as const),
  guestName: computed(() => undefined),
}

export function useRenderContext(): RenderContext {
  return inject(RENDER_CONTEXT, DEFAULT_CONTEXT)
}

/** True while rendering for the couple (editor/preview), false on the published page. */
export function useIsDraftRender(): ComputedRef<boolean> {
  const { mode } = useRenderContext()
  return computed(() => mode.value !== 'public')
}

const CONTROL_OR_BIDI = /[\u0000-\u001F\u007F-\u009F؜​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g
export const GUEST_NAME_MAX = 80

/**
 * Guest name from the `?to=` query: text only, control and bidi-override
 * characters removed, whitespace collapsed, at most 80 characters.
 * Returns undefined when nothing usable is left.
 */
export function sanitizeGuestName(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(CONTROL_OR_BIDI, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return undefined
  const chars = Array.from(cleaned)
  return chars.length > GUEST_NAME_MAX ? chars.slice(0, GUEST_NAME_MAX).join('').trim() : cleaned
}
