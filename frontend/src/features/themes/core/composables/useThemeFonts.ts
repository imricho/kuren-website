import { watch, type MaybeRefOrGetter, toValue } from 'vue'

const loaded = new Set<string>()

/**
 * Inject a theme's web-font stylesheet once, on demand. Themes declare
 * fallback font stacks, so text renders immediately and swaps in when ready
 * (Google Fonts URLs use `display=swap`).
 */
export function useThemeFonts(href: MaybeRefOrGetter<string | undefined>) {
  watch(
    () => toValue(href),
    (url) => {
      if (!url || loaded.has(url) || typeof document === 'undefined') return
      loaded.add(url)
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      link.dataset.themeFont = ''
      document.head.appendChild(link)
    },
    { immediate: true },
  )
}
