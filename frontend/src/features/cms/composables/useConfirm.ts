/**
 * Promise-based confirmation shared by the CMS (rendered by <ConfirmHost>).
 * Only one question is open at a time; asking again cancels the previous one.
 */
import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  tone?: 'danger' | 'default'
}

const state = reactive({
  open: false,
  options: { title: '', confirmLabel: '', cancelLabel: '' } as ConfirmOptions,
})
let resolver: ((value: boolean) => void) | null = null

function settle(value: boolean) {
  state.open = false
  const r = resolver
  resolver = null
  r?.(value)
}

export function useConfirm() {
  function ask(options: ConfirmOptions): Promise<boolean> {
    if (resolver) settle(false)
    state.options = options
    state.open = true
    return new Promise<boolean>((resolve) => (resolver = resolve))
  }
  return { state, ask, confirm: () => settle(true), cancel: () => settle(false) }
}
