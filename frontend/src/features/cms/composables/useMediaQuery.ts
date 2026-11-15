/**
 * Reactive `matchMedia`. Without matchMedia (tests, very old browsers) it
 * returns `fallback`.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useMediaQuery(query: string, fallback = false): Ref<boolean> {
  const matches = ref(fallback)
  let media: MediaQueryList | null = null
  const update = () => (matches.value = !!media?.matches)
  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    media = window.matchMedia(query)
    update()
    media.addEventListener?.('change', update)
  })
  onBeforeUnmount(() => media?.removeEventListener?.('change', update))
  return matches
}

/** Phones (<640px) get compact list actions; tests without matchMedia get the desktop layout. */
export const useIsPhone = () => useMediaQuery('(max-width: 639px)', false)
