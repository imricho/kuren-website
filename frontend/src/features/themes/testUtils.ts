import { mount } from '@vue/test-utils'
import { expect, vi } from 'vitest'

import type { WeddingContent } from '@/features/wedding/types'

import ThemeRenderer from './core/ThemeRenderer.vue'

/** Mount the renderer and wait for the lazily loaded theme to appear. */
export async function renderTheme(
  content: WeddingContent,
  themeId: string | null | undefined,
  options: { embedded?: boolean } = {},
) {
  const wrapper = mount(ThemeRenderer, { props: { content, themeId, ...options }, attachTo: document.body })
  await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
  return wrapper
}
