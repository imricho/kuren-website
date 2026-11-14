import type { Directive } from 'vue'

const observers = new WeakMap<Element, IntersectionObserver>()

/**
 * `v-reveal`: fade/slide an element in when it scrolls into view.
 * Shows content immediately when IntersectionObserver is unavailable or the
 * visitor prefers reduced motion — content is never hidden permanently.
 */
export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (typeof IntersectionObserver === 'undefined' || reduced) return

    el.classList.add('reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    observers.set(el, observer)
  },
  unmounted(el) {
    observers.get(el)?.disconnect()
    observers.delete(el)
  },
}
