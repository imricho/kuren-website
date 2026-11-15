import { onBeforeUnmount, ref, type Ref } from 'vue'

/** Reactive `matchMedia(query).matches` (false where matchMedia is unavailable, e.g. jsdom). */
export function useMediaQuery(query: string): Ref<boolean> {
  const mql = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  const matches = ref(mql?.matches ?? false)
  if (mql) {
    const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches)
    mql.addEventListener('change', onChange)
    onBeforeUnmount(() => mql.removeEventListener('change', onChange))
  }
  return matches
}
