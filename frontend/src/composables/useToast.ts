/**
 * App-wide toast notifications, rendered by <ToastRegion>.
 *
 * - success/info toasts go in a polite status region and dismiss after ~5 s;
 * - error toasts go in an alert region and stay until closed.
 */
import { ref } from 'vue'

export type ToastTone = 'success' | 'info' | 'error'
export interface Toast {
  id: number
  tone: ToastTone
  message: string
}

export const TOAST_TIMEOUT_MS = 5000

const toasts = ref<Toast[]>([])
let nextId = 1
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function show(message: string, tone: ToastTone = 'success'): number {
  const id = nextId++
  toasts.value = [...toasts.value, { id, tone, message }]
  if (tone !== 'error') timers.set(id, setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS))
  return id
}

function clear() {
  for (const t of toasts.value) dismiss(t.id)
}

export function useToast() {
  return {
    toasts,
    show,
    success: (message: string) => show(message, 'success'),
    info: (message: string) => show(message, 'info'),
    error: (message: string) => show(message, 'error'),
    dismiss,
    clear,
  }
}
