import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { TOAST_TIMEOUT_MS, useToast } from '@/composables/useToast'

import ToastRegion from './ToastRegion.vue'

enableAutoUnmount(afterEach)

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    useToast().clear()
    vi.useRealTimers()
  })

  it('announces success politely and dismisses it after ~5 s', async () => {
    const wrapper = mount(ToastRegion)
    useToast().success('Opening saved')
    await nextTick()
    const status = wrapper.get('[data-testid="toast-status"]')
    expect(status.attributes('role')).toBe('status')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toContain('Opening saved')
    vi.advanceTimersByTime(TOAST_TIMEOUT_MS + 10)
    await nextTick()
    expect(status.text()).not.toContain('Opening saved')
  })

  it('shows errors in an alert region until closed', async () => {
    const wrapper = mount(ToastRegion)
    useToast().error('Opening couldn’t be saved.')
    await nextTick()
    const alert = wrapper.get('[data-testid="toast-errors"]')
    expect(alert.attributes('role')).toBe('alert')
    vi.advanceTimersByTime(TOAST_TIMEOUT_MS * 3)
    await nextTick()
    expect(alert.text()).toContain('Opening couldn’t be saved.')
    await alert.get('button[aria-label="Close notification"]').trigger('click')
    expect(alert.text()).toBe('')
  })
})
