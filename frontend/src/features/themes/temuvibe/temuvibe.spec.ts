/**
 * The Temuvibe schema-driven renderer, for every one of the 17 variants:
 * only offered + enabled + non-empty sections, in canonical order; public mode has no
 * placeholders or editor-only nodes; draft mode shows labelled samples.
 */
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { invitationPlaceholderTexts } from '@/features/invitation/draft'
import { SECTION_ORDER, VARIANT_IDS, sectionsFor, type VariantId } from '@/features/invitation/registry'
import { allPlaceholderTexts, emptyDraft, toPreviewContent } from '@/features/wedding/draft'

import { renderTheme } from '../testUtils'
import { TEMUVIBE_PRESET_IDS } from './presets'
import { everythingDraft, FIXTURE_TODAY } from './testFixtures'
import { sectionAnchor } from './visibleSections'

enableAutoUnmount(afterEach)

let warn: MockInstance
let error: MockInstance
beforeEach(() => {
  warn = vi.spyOn(console, 'warn')
  error = vi.spyOn(console, 'error')
})
afterEach(() => {
  expect(warn).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

const ids = (w: Awaited<ReturnType<typeof renderTheme>>) => w.findAll('[data-section]').map((s) => s.attributes('data-section'))
const publicContent = (variant: VariantId, locale: 'en' | 'id' = 'en') =>
  toPreviewContent(everythingDraft(variant, locale), 'en', FIXTURE_TODAY, { mode: 'public', variant }).content

describe.each(VARIANT_IDS.map((v) => [v]))('temuvibe-elegant · %s', (variant) => {
  it('renders exactly the offered sections, in canonical order, with no editor-only nodes or placeholders (public)', async () => {
    const content = publicContent(variant)
    const w = await renderTheme(content, 'temuvibe-elegant', { mode: 'public', variant, guestName: 'Budi' })
    const offered = sectionsFor(variant).map((s) => s.id)
    const expected = SECTION_ORDER.filter((id) => offered.includes(id)).map(sectionAnchor)
    expect(ids(w)).toEqual(expected)
    // Nothing the variant does not offer.
    for (const id of SECTION_ORDER.filter((s) => !offered.includes(s))) expect(w.find(`[data-section="${sectionAnchor(id)}"]`).exists(), id).toBe(false)
    if (!offered.includes('organization')) expect(w.text()).not.toContain('Acme Indonesia')
    if (!offered.includes('milestone')) expect(w.text()).not.toContain('Under the sea')
    if (!offered.includes('speakers')) expect(w.text()).not.toContain('Dr. Rina Wijaya')
    if (!offered.includes('couple')) expect(w.text()).not.toContain('Sarah Putri')
    // Public: no editor notes, no samples, no placeholder text.
    expect(w.find('[data-editor-only]').exists()).toBe(false)
    expect(w.find('[data-sample]').exists()).toBe(false)
    for (const p of [...allPlaceholderTexts(), ...invitationPlaceholderTexts()].filter((x) => x !== 'RSVP')) expect(w.text()).not.toContain(p)
    expect(w.text()).not.toContain('undefined')
    // One h1; sections use h2.
    expect(w.findAll('h1')).toHaveLength(1)
    for (const section of w.findAll('section[data-section]')) expect(section.find('h2').exists(), section.attributes('data-section')).toBe(true)
    // Guest personalisation.
    expect(w.get('[data-testid="guest-greeting"]').text()).toContain('Budi')
  })

  it('draft mode marks samples and shows the non-submitting RSVP sample', async () => {
    const d = emptyDraft('en')
    d.opening = { weddingDate: '2027-06-12' }
    d.rsvp = { enabled: true, title: 'RSVP' }
    for (const s of sectionsFor(variant)) {
      if (s.id === 'profiles') d.profiles = { enabled: true, people: [] }
      if (s.id === 'agenda') d.agenda = { enabled: true, items: [] }
      if (s.id === 'speakers') d.speakers = { enabled: true, people: [] }
    }
    const content = toPreviewContent(d, 'en', FIXTURE_TODAY, { variant }).content
    const w = await renderTheme(content, 'temuvibe-elegant', { variant })
    const offered = sectionsFor(variant).map((s) => s.id)
    for (const id of ['profiles', 'agenda', 'speakers'] as const) {
      if (offered.includes(id)) expect(w.find(`[data-section="${id}"] [data-sample="true"]`).exists(), id).toBe(true)
    }
    if (offered.includes('rsvp')) {
      const rsvp = w.get('[data-section="rsvp"]')
      expect(rsvp.find('[data-editor-only]').exists()).toBe(true)
      expect(rsvp.find('form fieldset[disabled]').exists()).toBe(true)
      expect(rsvp.find('[data-testid="rsvp-live"]').exists()).toBe(false)
    }
  })
})

describe('temuvibe presets', () => {
  it.each(TEMUVIBE_PRESET_IDS.map((id) => [id]))('%s renders a celebration and a corporate invitation with its tokens', async (presetId) => {
    for (const variant of ['birthday', 'seminar'] as const) {
      const w = await renderTheme(publicContent(variant), presetId, { mode: 'public', variant })
      const root = w.get('article.t-tv')
      // festive is not offered for corporate → the renderer falls back to elegant (covered in ThemeRenderer spec).
      if (presetId === 'temuvibe-festive' && variant === 'seminar') {
        warn.mockClear()
        w.unmount()
        continue
      }
      if (presetId === 'temuvibe-corporate' && variant === 'birthday') {
        warn.mockClear()
        w.unmount()
        continue
      }
      expect(root.attributes('data-variant')).toBe(presetId)
      expect(root.attributes('style')).toContain('--tv-bg:')
      expect(root.attributes('style')).toContain('--tv-font-display:')
      w.unmount()
    }
  })
})

describe('variant-aware content', () => {
  it('birthday: celebrant profile, age milestone and party theme, no wedding wording', async () => {
    const w = await renderTheme(publicContent('birthday'), 'temuvibe-festive', { mode: 'public', variant: 'birthday' })
    expect(w.get('[data-section="opening"] .tv-hero__kicker').text()).toBe('Birthday celebration')
    expect(w.get('[data-section="profiles"] h2').text()).toBe('The celebrant')
    expect(w.get('[data-section="milestone"] h2').text()).toBe('Turning 7')
    expect(w.get('[data-section="milestone"]').text()).toContain('Under the sea')
    expect(w.get('[data-section="milestone"]').text()).not.toContain('Universitas Indonesia')
    expect(w.get('[data-section="weddingDate"] h2').text()).toBe('Save the date')
    expect(w.text()).not.toMatch(/wedding|groom|bride/i)
    // The calendar entry uses the event title, not "Wedding of".
    expect(new URL(w.get('a[data-calendar="google"]').attributes('href')!).searchParams.get('text')).toBe('Festive Evening 2027')
  })

  it('Indonesian wording is natural (khitanan, graduation, seminar)', async () => {
    const k = await renderTheme(publicContent('khitanan', 'id'), 'temuvibe-elegant', { mode: 'public', variant: 'khitanan' })
    expect(k.get('.tv-hero__kicker').text()).toBe('Tasyakuran Khitanan')
    expect(k.get('[data-section="profiles"] h2').text()).toBe('Ananda')
    expect(k.get('[data-section="profiles"] [data-role="parents"]').text()).toBe('Putri dari Bapak Hadi & Ibu Sri')
    expect(k.get('[data-section="weddingDate"] h2').text()).toBe('Catat Tanggalnya')
    k.unmount()
    const g = await renderTheme(publicContent('graduation', 'id'), 'temuvibe-elegant', { mode: 'public', variant: 'graduation' })
    expect(g.get('[data-section="milestone"] h2').text()).toBe('Wisuda')
    expect(g.get('[data-section="milestone"] [data-field="institution"]').text()).toContain('Universitas Indonesia')
    g.unmount()
    const s = await renderTheme(publicContent('seminar', 'id'), 'temuvibe-corporate', { mode: 'public', variant: 'seminar' })
    expect(s.get('[data-section="agenda"] h2').text()).toBe('Susunan Acara')
    expect(s.get('[data-section="speakers"] h2').text()).toBe('Pembicara')
    expect(s.get('[data-section="events"] h2').text()).toBe('Sesi')
  })

  it('aqiqah shows the birth date; anniversary shows years together', async () => {
    const a = await renderTheme(publicContent('aqiqah'), 'temuvibe-elegant', { mode: 'public', variant: 'aqiqah' })
    expect(a.get('[data-section="profiles"] [data-role="birth-date"]').text()).toBe('Born 14 March 2020')
    expect(a.get('[data-section="profiles"] h2').text()).toBe('Our little one')
    a.unmount()
    const n = await renderTheme(publicContent('anniversary'), 'temuvibe-elegant', { mode: 'public', variant: 'anniversary' })
    expect(n.get('[data-section="milestone"] h2').text()).toBe('10 years together')
    expect(n.get('h1').text()).toBe('Alex & Sarah')
  })

  it('anniversary with the couple hidden does not render the couple', async () => {
    const d = everythingDraft('anniversary')
    d.couple = { ...d.couple, enabled: false }
    const content = toPreviewContent(d, 'en', FIXTURE_TODAY, { mode: 'public', variant: 'anniversary' }).content
    const w = await renderTheme(content, 'temuvibe-elegant', { mode: 'public', variant: 'anniversary' })
    expect(w.find('[data-section="couple"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Sarah Putri')
  })

  it('corporate: logo in the hero, agenda in time order with linked speakers and sessions, optional session flag', async () => {
    const w = await renderTheme(publicContent('workshop'), 'temuvibe-corporate', { mode: 'public', variant: 'workshop' })
    expect(w.get('[data-section="opening"] [data-role="organization-brand"]').text()).toContain('Acme Indonesia')
    expect(w.get('[data-section="opening"] img').attributes('alt')).toBe('Acme logo')
    const titles = w.findAll('[data-section="agenda"] h3').map((h) => h.text())
    expect(titles).toEqual(['Registration', 'Keynote talk', 'Hands-on lab'])
    const link = w.get('[data-section="agenda"] [data-role="agenda-speakers"] a')
    expect(link.attributes('href')).toBe('#tv-speaker-sp1')
    expect(w.find('#tv-speaker-sp1').exists()).toBe(true)
    expect(w.findAll('[data-section="agenda"] [data-role="agenda-session"]').map((p) => p.text())).toEqual(['Part of Main Session', 'Part of Main Session', 'Part of Breakout Workshop'])
    expect(w.findAll('[data-section="events"] [data-role="optional"]').map((b) => b.text())).toEqual(['Optional'])
    const site = w.get('[data-section="organization"] a[data-role="website"]')
    expect(site.attributes()).toMatchObject({ href: 'https://acme.example.com', target: '_blank', rel: 'noopener noreferrer' })
  })

  it('user text is direction-neutral (dir="auto") and images below the hero are lazy', async () => {
    const w = await renderTheme(publicContent('seminar'), 'temuvibe-elegant', { mode: 'public', variant: 'seminar' })
    expect(w.get('[data-section="speakers"] h3').attributes('dir')).toBe('auto')
    expect(w.get('[data-section="agenda"] h3').attributes('dir')).toBe('auto')
    const lazy = w.findAll('section img')
    expect(lazy.length).toBeGreaterThan(0)
    for (const img of lazy) expect(img.attributes('loading')).toBe('lazy')
  })

  it('legacy wedding content (no `sections`) renders the 13 wedding sections', async () => {
    const content = toPreviewContent(everythingDraft('wedding_ceremony'), 'en', FIXTURE_TODAY, { mode: 'public' }).content
    const w = await renderTheme(content, 'temuvibe-minimal', { mode: 'public' })
    expect(ids(w)).toEqual(['opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate', 'events', 'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing'])
    expect(w.get('.tv-hero__kicker').text()).toBe('The Wedding of Alex & Sarah')
  })

  it('public RSVP is the live form only when the page provides the slug', async () => {
    const content = publicContent('birthday')
    const live = await renderTheme(content, 'temuvibe-festive', { mode: 'public', variant: 'birthday', slug: 'aisyah-abc123' })
    expect(live.find('[data-section="rsvp"] [data-testid="rsvp-form"]').exists()).toBe(true)
    live.unmount()
    const info = await renderTheme(content, 'temuvibe-festive', { mode: 'public', variant: 'birthday' })
    expect(info.find('[data-section="rsvp"] form').exists()).toBe(false)
    expect(info.get('[data-section="rsvp"]').text()).toContain('See you there!')
  })
})
