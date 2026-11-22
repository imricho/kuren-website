/** Renderer selection per variant: legacy themes unchanged for weddings, safe fallback otherwise. */
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { toPreviewContent } from '@/features/wedding/draft'
import { sampleWedding } from '@/features/wedding/sampleWedding'

import { everythingDraft, FIXTURE_TODAY } from '../temuvibe/testFixtures'
import { renderTheme } from '../testUtils'

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

const content = (variant: Parameters<typeof everythingDraft>[0]) =>
  toPreviewContent(everythingDraft(variant), 'en', FIXTURE_TODAY, { mode: 'public', variant }).content

describe('ThemeRenderer variant compatibility', () => {
  it('keeps a legacy theme for wedding variants (no warning, no fallback)', async () => {
    const warn = vi.spyOn(console, 'warn')
    const w = await renderTheme(content('wedding_reception'), 'ethnic', { variant: 'wedding_reception' })
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('ethnic')
    expect(w.find('article.t-eth').exists()).toBe(true)
    expect(w.emitted('fallback')).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })

  it('falls back to temuvibe-elegant when the stored template does not support the variant', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await renderTheme(content('seminar'), 'ethnic', { variant: 'seminar' })
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('temuvibe-elegant')
    expect(w.find('article.t-tv').exists()).toBe(true)
    expect(w.emitted('fallback')?.[0]).toEqual(['ethnic'])
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0]![0])).toContain('does not support variant "seminar"')
  })

  it('falls back from a Temuvibe preset that does not cover the category (festive on a seminar)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await renderTheme(content('seminar'), 'temuvibe-festive', { variant: 'seminar' })
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('temuvibe-elegant')
  })

  it('unknown ids on a non-wedding invitation fall back to temuvibe-elegant, not the wedding default', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await renderTheme(content('birthday'), 'does-not-exist', { variant: 'birthday' })
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('temuvibe-elegant')
    expect(w.emitted('fallback')?.[0]).toEqual(['does-not-exist'])
  })

  it('without a variant prop, content offering no couple never renders on a legacy theme', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await renderTheme(content('family_gathering'), 'still-form')
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('temuvibe-elegant')
    expect(w.text()).not.toContain('Groom')
  })

  it('legacy content without variant info renders exactly as before', async () => {
    const warn = vi.spyOn(console, 'warn')
    const w = await renderTheme(sampleWedding, 'traditional')
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('traditional')
    expect(warn).not.toHaveBeenCalled()
  })
})
