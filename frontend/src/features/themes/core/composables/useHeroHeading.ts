import { inject, provide, type InjectionKey } from 'vue'

/** True when a theme is rendered inside an editor/studio page that already has its own h1. */
const EMBEDDED: InjectionKey<boolean> = Symbol('themeEmbedded')

export function provideThemeEmbedded(embedded: boolean) {
  provide(EMBEDDED, embedded)
}

/**
 * Attributes for a theme's hero heading. Themes keep their `<h1>` element (and styles);
 * when embedded, it is announced as a level-2 heading so the host page keeps one h1.
 */
export function useHeroHeading(): Record<string, string | number> {
  return inject(EMBEDDED, false) ? { role: 'heading', 'aria-level': 2 } : {}
}
