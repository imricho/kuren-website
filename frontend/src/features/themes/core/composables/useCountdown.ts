import { computed, onMounted, onUnmounted, ref, type MaybeRefOrGetter, toValue } from 'vue'

/** Live countdown to a date, ticking once per second while mounted. */
export function useCountdown(target: MaybeRefOrGetter<Date>) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    timer = setInterval(() => (now.value = Date.now()), 1000)
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
