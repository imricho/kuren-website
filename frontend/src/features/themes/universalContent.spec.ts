import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeDraft, toPreviewContent } from '@/features/wedding/draft'
import { TEMPLATES } from './core/registry'
import { isRenderable } from './core/types'
import { renderTheme } from './testUtils'
import { OPTIONAL_SECTIONS, SECTION_ORDER, universalFixture } from './universalContent.fixture'

enableAutoUnmount(afterEach)
const sectionIds = (wrapper: Awaited<ReturnType<typeof renderTheme>>) => wrapper.findAll('[data-section]').map(section => section.attributes('data-section'))

describe.each(TEMPLATES.filter(isRenderable).map(t => [t.id]))('%s universal v1.1 contract', themeId => {
  it('renders thirteen sections in order and independently updates each optional section without mutating stored content', async () => {
    const content = universalFixture()
    const original = JSON.stringify(content)
    const wrapper = await renderTheme(content, themeId)
    expect(sectionIds(wrapper)).toEqual(SECTION_ORDER)
    for (const key of OPTIONAL_SECTIONS) {
      const disabled = { ...content, [key]: { ...content[key], enabled: false } }
      await wrapper.setProps({ content: disabled })
      expect(sectionIds(wrapper), key).toEqual(SECTION_ORDER.filter(id => id !== key))
      expect(wrapper.find(`[data-section="${key}"]`).exists()).toBe(false)
      await wrapper.setProps({ content })
      expect(sectionIds(wrapper), `${key} restored`).toEqual(SECTION_ORDER)
    }
    expect(JSON.stringify(content)).toBe(original)
    expect(wrapper.find('[data-section="holyRecite1"]').text()).toContain('First reference')
    expect(wrapper.find('[data-section="holyRecite2"]').text()).toContain('Second reference')
    expect(wrapper.find('[data-section="holyRecite1"] [dir="auto"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('001234567890123456789')
    expect(wrapper.text()).toContain('00042')
    expect(wrapper.findAll('form:not([aria-disabled="true"])')).toHaveLength(0)
    expect(wrapper.find('[data-section="wishes"] form').exists()).toBe(false)
  })

  it('keeps date with countdown disabled, hides gift subsections independently, and escapes scripture', async () => {
    const content = universalFixture()
    content.countdown = { enabled: false }
    content.holyRecite1!.passage = '<img src=x onerror="alert(1)">'
    content.amplopDigital = { ...content.amplopDigital!, bankAccountsEnabled: false, qrisEnabled: false, physicalGifts: { ...content.amplopDigital!.physicalGifts!, enabled: false } }
    const wrapper = await renderTheme(content, themeId)
    expect(wrapper.find('[data-section="weddingDate"]').text()).not.toBe('')
    expect(wrapper.find('[data-section="weddingDate"] .countdown').exists()).toBe(false)
    expect(wrapper.find('[data-section="holyRecite1"]').text()).toContain('<img src=x')
    expect(wrapper.find('[data-section="holyRecite1"] img').exists()).toBe(false)
    const gifts = wrapper.find('[data-section="amplopDigital"]')
    expect(gifts.text()).not.toContain('001234567890123456789')
    expect(gifts.text()).not.toContain('Gift Address 42')
    expect(gifts.find('img').exists()).toBe(false)
    for (const hidden of ['bankAccountsEnabled', 'qrisEnabled', 'physicalGifts'] as const) {
      const next = universalFixture()
      if (hidden === 'physicalGifts') next.amplopDigital!.physicalGifts!.enabled = false
      else next.amplopDigital![hidden] = false
      await wrapper.setProps({ content: next })
      const rendered = wrapper.find('[data-section="amplopDigital"]')
      expect(rendered.text().includes('001234567890123456789'), hidden).toBe(hidden !== 'bankAccountsEnabled')
      expect(rendered.find('.universal-qris img').exists(), hidden).toBe(hidden !== 'qrisEnabled')
      expect(rendered.text().includes('Gift Address 42'), hidden).toBe(hidden !== 'physicalGifts')
    }
  })
})

it('retains v1.1 fields through draft normalization and live preview without dropping stored values', () => {
  const content = universalFixture()
  const draft = normalizeDraft({ ...content, locale: 'en', story: content.story!, gallery: content.gallery! })
  const preview = toPreviewContent(draft).content
  expect(preview.holyRecite1).toEqual(content.holyRecite1)
  expect(preview.holyRecite2).toEqual(content.holyRecite2)
  expect(preview.amplopDigital).toEqual(content.amplopDigital)
  expect(preview.contentVersion).toBe('1.1')
})

 it('recovers a failed QRIS image on live URL change and refuses unsafe image sources', async () => {
  const content = universalFixture()
  const wrapper = await renderTheme(content, 'international')
  await wrapper.find('.universal-qris img').trigger('error')
  expect(wrapper.find('.universal-qris img').exists()).toBe(false)
  expect(wrapper.find('.universal-qris').text()).toContain('unavailable')
  const changed = structuredClone(content)
  changed.amplopDigital!.qrisImage!.src = 'https://cdn.example.com/replacement.png'
  await wrapper.setProps({ content: changed })
  expect(wrapper.find('.universal-qris img').attributes('src')).toBe('https://cdn.example.com/replacement.png')
  changed.amplopDigital!.qrisImage!.src = 'javascript:alert(1)'
  await wrapper.setProps({ content: structuredClone(changed) })
  expect(wrapper.find('.universal-qris img').exists()).toBe(false)
})
