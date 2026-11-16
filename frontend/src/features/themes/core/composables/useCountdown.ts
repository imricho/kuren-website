import { computed, onMounted, onUnmounted, ref, type MaybeRefOrGetter, toValue } from 'vue'

/** True when the visitor asked for reduced motion (no constantly changing content). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Live countdown to a date. Ticks once per second while mounted — or once a minute
 * when reduced motion is preferred (the seconds unit is then hidden by the timer).
 */
export function useCountdown(target: MaybeRefOrGetter<Date>) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now()), prefersReducedMotion() ? 60_000 : 1000)
  })
  onUnmounted(() => clearInterval(timer))

  return computed(() => {
    const diff = Math.max(0, toValue(target).getTime() - now.value)
    const s = Math.floor(diff / 1000)
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      isPast: diff === 0,
    }
  })
}
