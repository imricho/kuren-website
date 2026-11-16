/**
 * CMS v2.0 rendering contract for the eight base renderers: new fields, section
 * order, draft vs public mode, and no orphan wrappers for enabled-but-empty sections.
 */
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { toPreviewContent, type WeddingDraft } from '@/features/wedding/draft'
import { publishableDraft, QRIS_SRC } from '@/test/publishFixture'

import { renderTheme } from './testUtils'
import { SECTION_ORDER } from './universalContent.fixture'

enableAutoUnmount(afterEach)

const BASE_RENDERERS = ['international', 'traditional', 'royal-maroon-v2', 'ethnic', 'conventional', 'artistic', 'still-form', 'wildwood-gathering']
const today = new Date(2026, 10, 16)
const ids = (w: Awaited<ReturnType<typeof renderTheme>>) => w.findAll('[data-section]').map((s) => s.attributes('data-section'))

function fullDraft(): WeddingDraft {
  const d = publishableDraft()
  d.story = { enabled: true, timeline: [{ id: 's1', title: 'We met', description: 'At a café.' }] }
  d.gallery = { enabled: true, images: [{ id: 'g1', src: 'https://cdn.example.com/g1.jpg', alt: 'Us' }] }
  d.holyRecite1 = { enabled: true, title: 'QS Ar-Rum', originalScript: 'وَمِنْ آيَاتِهِ\nأَنْ خَلَقَ لَكُم', translation: 'And among His signs (Ar-Rum)\nis that He created', translationLanguage: 'en', reference: '30:21', book: 'Ar-Rum', attribution: 'Al-Quran' }
  d.holyRecite2 = { enabled: true, passage: 'Love is patient,\nlove is kind.', reference: '1 Corinthians 13:4' }
  d.greeting = { enabled: true, title: 'Welcome', message: 'Join us', prayer: 'Bless this\nunion' }
  d.countdown = { enabled: true, addToCalendar: true }
  d.wishes = { enabled: true, title: 'Send wishes', introduction: 'Leave us a prayer' }
  d.amplopDigital = {
    enabled: true, bankAccountsEnabled: true, bankAccounts: [{ id: 'b1', bankName: 'BCA', accountHolder: 'Alex', accountNumber: '0012 3456' }],
    qrisEnabled: true, qrisImage: { src: QRIS_SRC, alt: 'QRIS code' }, physicalGifts: { enabled: true, recipient: 'Alex', address: 'Jl. Mawar 2' },
  }
  d.opening.guestGreeting = { enabled: true, label: 'Kepada Yth.' }
  d.events[0]!.dressCode = { enabled: true, text: 'Batik\nor formal' }
  d.events[0]!.livestream = { enabled: true, url: 'https://youtube.com/live/abc', label: 'Watch live' }
  d.closing.familyAcknowledgments = 'Keluarga Besar Morgan\nKeluarga Besar Putri'
  return d
}

describe.each(BASE_RENDERERS.map((id) => [id]))('%s v2 fields', (themeId) => {
  it('renders new fields in public mode, in canonical order, with no editor notes or form fields', async () => {
    const content = toPreviewContent(fullDraft(), 'en', today, { mode: 'public' }).content
    const w = await renderTheme(content, themeId, { mode: 'public', guestName: '  Budi‮ Santoso\u0007 ' })
    expect(ids(w)).toEqual(SECTION_ORDER)
    // holyRecite1 right after opening, holyRecite2 right before closing.
    expect(ids(w).indexOf('holyRecite1')).toBe(ids(w).indexOf('opening') + 1)
    expect(ids(w).indexOf('holyRecite2')).toBe(ids(w).indexOf('closing') - 1)

    const recite = w.get('[data-section="holyRecite1"]')
    expect(recite.find('h2').text()).toBe('QS Ar-Rum')
    const script = recite.get('[data-role="original-script"]')
    expect(script.attributes('dir')).toBe('auto')
    expect(script.classes()).toContain('whitespace-pre-line')
    expect(script.element.textContent).toBe('وَمِنْ آيَاتِهِ\nأَنْ خَلَقَ لَكُم')
    const translation = recite.get('[data-role="translation"]')
    expect(translation.attributes('dir')).toBe('auto')
    expect(translation.attributes('lang')).toBe('en')
    expect(translation.element.textContent).toContain('\n')
    expect(recite.get('[data-role="citation"]').text()).toBe('Ar-Rum 30:21 · Al-Quran')
    expect(w.get('[data-section="holyRecite2"] [data-role="passage"]').element.textContent).toBe('Love is patient,\nlove is kind.')

    expect(w.get('[data-section="greeting"] [data-role="prayer"]').element.textContent).toBe('Bless this\nunion')
    const events = w.get('[data-section="events"]')
    expect(events.get('[data-role="dress-code"]').text()).toContain('Batik')
    const live = events.get('a[data-role="livestream"]')
    expect(live.attributes()).toMatchObject({ href: 'https://youtube.com/live/abc', target: '_blank', rel: 'noopener noreferrer' })
    expect(w.get('[data-section="closing"] [data-role="family-acknowledgments"]').text()).toContain('Keluarga Besar Morgan')

    const guest = w.get('[data-section="opening"] [data-testid="guest-greeting"]')
    expect(guest.text()).toContain('Kepada Yth.')
    expect(guest.text()).toContain('Budi Santoso')
    expect(guest.text()).not.toMatch(/[‮\u0007]/)

    const calendar = w.get('[data-section="weddingDate"] [data-testid="add-to-calendar"]')
    expect(calendar.get('a[data-calendar="google"]').attributes('href')).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/)
    expect(calendar.get('a[data-calendar="ics"]').attributes('href')).toMatch(/^data:text\/calendar/)
    expect(calendar.get('a[data-calendar="ics"]').attributes('download')).toBe('alex-sarah-wedding.ics')

    // Public: no editor-only notes, no form fields anywhere.
    expect(w.find('[data-editor-only]').exists()).toBe(false)
    expect(w.text()).not.toContain('not available yet')
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('input').exists()).toBe(false)
    expect(w.get('[data-section="rsvp"]').text()).toContain('RSVP')
    expect(w.get('[data-section="wishes"]').text()).toContain('Leave us a prayer')
    expect(w.get('[data-section="amplopDigital"] .universal-qris img').attributes('src')).toBe(QRIS_SRC)
  })

  it('draft mode shows editor notes, an inert calendar and a sample guest name', async () => {
    const content = toPreviewContent(fullDraft(), 'en', today).content
    const w = await renderTheme(content, themeId)
    expect(w.find('[data-section="wishes"] [data-editor-only]').exists()).toBe(true)
    expect(w.find('[data-section="rsvp"] [data-editor-only]').exists()).toBe(true)
    // Inert in the editor: plain text, not links (nothing to activate).
    expect(w.findAll('[data-calendar]').map((el) => el.element.tagName)).toEqual(['SPAN', 'SPAN'])
    expect(w.find('a[data-calendar]').exists()).toBe(false)
    expect(w.get('[data-testid="guest-greeting"] [data-sample]').text()).toBe('Guest Name')
  })

  it('enabled but empty universal sections render no wrapper (draft mode)', async () => {
    const d = fullDraft()
    d.holyRecite1 = { enabled: true, title: 'Only a title' }
    d.holyRecite2 = { enabled: true, reference: 'Only a reference' }
    d.greeting = { enabled: true, title: '  ' }
    d.amplopDigital = { enabled: true, title: 'Gifts', bankAccountsEnabled: true, bankAccounts: [], qrisEnabled: false }
    const w = await renderTheme(toPreviewContent(d, 'en', today).content, themeId)
    for (const id of ['holyRecite1', 'holyRecite2', 'greeting', 'amplopDigital']) expect(w.find(`[data-section="${id}"]`).exists(), id).toBe(false)
    expect(w.text()).not.toContain('Only a title')
    expect(w.text()).not.toContain('Sacred Passage')
  })

  it('omits the guest greeting on the public page without ?to=', async () => {
    const content = toPreviewContent(fullDraft(), 'en', today, { mode: 'public' }).content
    const w = await renderTheme(content, themeId, { mode: 'public' })
    expect(w.find('[data-testid="guest-greeting"]').exists()).toBe(false)
  })
})
