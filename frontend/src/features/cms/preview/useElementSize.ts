import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Reactive content-box size of an element (clientWidth/clientHeight, padding
 * included), kept current with ResizeObserver. Without ResizeObserver (jsdom)
 * it measures once when the element appears.
 */
export function useElementSize(target: Ref<HTMLElement | null>) {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | null = null

  const measure = (el: HTMLElement) => {
    width.value = el.clientWidth
    height.value = el.clientHeight
  }

  watch(
    target,
    (el) => {
      observer?.disconnect()
      observer = null
      if (!el) return
      measure(el)
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(() => measure(el))
        observer.observe(el)
      }
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => observer?.disconnect())

  return { width, height, measure: () => target.value && measure(target.value) }
}
