import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { sampleWedding } from '@/features/wedding/sampleWedding'

import { renderTheme } from '../testUtils'
import { DEFAULT_THEME_ID } from './registry'

enableAutoUnmount(afterEach)

describe('ThemeRenderer', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['international', 't-intl'],
    ['traditional', 't-trad'],
    ['ethnic', 't-eth'],
    ['conventional', 't-conv'],
    ['artistic', 't-art'],
  ])('selects the %s theme', async (id, rootClass) => {
    const wrapper = await renderTheme(sampleWedding, id)
    expect(wrapper.find('.wedding-site').attributes('data-theme')).toBe(id)
    expect(wrapper.find(`.wedding-site > article.${rootClass}`).exists()).toBe(true)
    expect(wrapper.emitted('fallback')).toBeUndefined()
  })

  it.each([['does-not-exist'], [''], [null], [undefined]])(
    'falls back to the default theme for invalid id %j',
    async (id) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const wrapper = await renderTheme(sampleWedding, id)
      expect(wrapper.find('.wedding-site').attributes('data-theme')).toBe(DEFAULT_THEME_ID)
      expect(wrapper.emitted('fallback')?.[0]).toEqual([id])
      expect(warn).toHaveBeenCalledOnce()
    },
  )

  it.each(['international', 'traditional', 'ethnic', 'conventional', 'artistic', 'minimalist', 'rustic'])(
    'announces the %s hero heading as level 2 only when embedded in another page',
    async (id) => {
      const full = await renderTheme(sampleWedding, id)
      expect(full.findAll('h1')).toHaveLength(1)
      expect(full.find('h1').attributes('aria-level')).toBeUndefined()
      full.unmount()

      const embedded = await renderTheme(sampleWedding, id, { embedded: true })
      expect(embedded.find('h1').attributes()).toMatchObject({ role: 'heading', 'aria-level': '2' })
    },
  )

  it('renders the parents line under each partner when provided', async () => {
    const content = {
      ...sampleWedding,
      couple: {
        groom: { ...sampleWedding.couple.groom, parents: 'Putra dari Bapak Hadi & Ibu Sri' },
        bride: { ...sampleWedding.couple.bride, parents: 'Putri dari Bapak Joko & Ibu Rina' },
      },
    }
    for (const id of ['international', 'traditional', 'ethnic', 'conventional', 'artistic', 'minimalist', 'rustic']) {
      const wrapper = await renderTheme(content, id)
      const lines = wrapper.findAll('[data-role="parents"]').map((p) => p.text())
      expect(lines, id).toEqual(['Putra dari Bapak Hadi & Ibu Sri', 'Putri dari Bapak Joko & Ibu Rina'])
      wrapper.unmount()
    }
  })

  it('switches theme when the id changes', async () => {
    const wrapper = await renderTheme(sampleWedding, 'international')
    await wrapper.setProps({ themeId: 'artistic' })
    await vi.waitFor(() => expect(wrapper.find('article.t-art').exists()).toBe(true))
    expect(wrapper.find('article.t-intl').exists()).toBe(false)
  })

  it('loads the theme web fonts once', async () => {
    await renderTheme(sampleWedding, 'traditional')
    await renderTheme(sampleWedding, 'traditional')
    expect(document.head.querySelectorAll('link[href*="Cinzel"]').length).toBe(1)
  })

  it('passes the viewport height used by full-screen sections', async () => {
    const wrapper = await renderTheme(sampleWedding, 'international')
    expect(wrapper.find('.wedding-site').attributes('style')).toContain('--site-vh: 100svh')
  })
})
