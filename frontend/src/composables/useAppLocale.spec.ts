import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { localizedCatalogText, useAppLocale } from './useAppLocale'
import { getFamily, getTheme } from '@/features/themes/core/registry'
import PickerSteps from '@/features/themes/picker/PickerSteps.vue'
import { formatTemplatePath } from '@/features/themes/picker/format'

const { setLocale, t } = useAppLocale()
afterEach(() => setLocale('en'))

describe.each(['en', 'id'] as const)('catalog terminology in %s', (locale) => {
  it('renders the exact one-word hierarchy labels', () => {
    setLocale(locale)
    expect(['family', 'collection', 'template'].map((key) => t(key as 'family' | 'collection' | 'template')))
      .toEqual(['Category', 'Collection', 'Template'])
    const steps = mount(PickerSteps, { props: { current: 2 } })
    expect(steps.findAll('li').map((item) => item.text().replace(/[123—]/g, '').trim()))
      .toEqual(['Category', 'Collection', 'Template'])
    expect(steps.find('[aria-current="step"]').text()).toContain('Collection')
    steps.unmount()
  })

  it('shows Heritage in catalog and selected paths while preserving persisted identifiers', () => {
    setLocale(locale)
    const heritage = getFamily('traditional')!
    expect(heritage.id).toBe('traditional')
    expect(heritage.name).toBe('Heritage')
    expect(localizedCatalogText(heritage.id, 'name', heritage.name)).toBe('Heritage')
    expect(getTheme('traditional')?.id).toBe('traditional')
    expect(formatTemplatePath('traditional')).toMatch(/^Heritage › /)
  })

  it('removes family wording from category headings and accessible labels', () => {
    setLocale(locale)
    const keys = ['allFamilies', 'family', 'chooseFamily', 'previewPaneLocation', 'familyNotFound'] as const
    for (const key of keys) expect(t(key)).not.toMatch(/family|families|keluarga|traditional|tradisional/i)
  })
})
