/**
 * toPreviewContent(..., { mode: 'public' }) renders a published snapshot for guests:
 * never placeholders, no disabled sections/children, no incomplete financial data.
 */
import { describe, expect, it } from 'vitest'

import { publishableDraft, QRIS_SRC } from '@/test/publishFixture'

import { allPlaceholderTexts, emptyDraft, normalizeDraft, toPreviewContent, type WeddingDraft } from './draft'

const today = new Date(2026, 10, 16)
const pub = (d: WeddingDraft, ui: 'en' | 'id' = 'en') => toPreviewContent(d, ui, today, { mode: 'public' }).content

function everything(): WeddingDraft {
  const d = publishableDraft()
  d.holyRecite1 = { enabled: true, title: '  Ar-Rum 21  ', originalScript: '  وَمِنْ آيَاتِهِ\nأَنْ خَلَقَ  ', translation: 'And of His signs\n  is that He created', reference: '30:21', book: 'Ar-Rum', tradition: 'Islam' }
  d.holyRecite2 = { enabled: false, passage: 'Hidden passage' }
  d.greeting = { enabled: true, title: 'Welcome', message: 'Join us', prayer: 'May God bless\nthis union' }
  d.countdown = { enabled: true, addToCalendar: true }
  d.wishes = { enabled: true, title: 'Wishes' }
  d.amplopDigital = {
    enabled: true,
    title: 'Gifts',
    bankAccountsEnabled: true,
    bankAccounts: [
      { id: 'b1', bankName: 'BCA', accountHolder: 'Alex', accountNumber: '0012 3456' },
      { id: 'b2', bankName: 'Mandiri', accountHolder: '', accountNumber: '999' },
      { id: 'b3', bankName: 'BNI', accountHolder: 'Sarah', accountNumber: '12a4' },
    ],
    qrisEnabled: true,
    qrisImage: { src: QRIS_SRC, alt: 'QRIS' },
    physicalGifts: { enabled: true, recipient: 'Alex', address: 'Jl. Mawar 2\nJakarta', phone: '+62 811' },
  }
  d.opening.guestGreeting = { enabled: true, label: ' Kepada Yth. ' }
  d.events[0]!.dressCode = { enabled: true, text: ' Batik ' }
  d.events[0]!.livestream = { enabled: true, url: 'https://youtube.com/live/x', label: 'Watch' }
  d.closing.familyAcknowledgments = '  Keluarga Besar A\nKeluarga Besar B  '
  return d
}

describe('toPreviewContent public mode', () => {
  it('never inserts placeholder strings, even for an empty draft', () => {
    for (const ui of ['en', 'id'] as const) {
      const json = JSON.stringify(pub(emptyDraft('id'), ui))
      for (const placeholder of allPlaceholderTexts()) expect(json, placeholder).not.toContain(placeholder)
      const json2 = JSON.stringify(pub(normalizeDraft({ events: [{ id: 'x', type: 'akad' }] }), ui))
      for (const placeholder of allPlaceholderTexts()) expect(json2, placeholder).not.toContain(placeholder)
    }
  })

  it('draft mode still uses placeholders (unchanged default)', () => {
    expect(toPreviewContent(emptyDraft(), 'en', today).content.closing.message).toBe('Your closing message will appear here.')
    expect(toPreviewContent(emptyDraft(), 'en', today, { mode: 'draft' }).content.events).toHaveLength(1)
  })

  it('drops incomplete events and gives an RSVP without a title the default heading', () => {
    const d = publishableDraft()
    d.events.push({ id: 'e2', type: 'reception', title: 'Reception', date: '2027-06-12' })
    d.rsvp = { enabled: true }
    const c = pub(d)
    expect(c.events.map((e) => e.id)).toEqual(['e1'])
    expect(c.rsvp.enabled).toBe(true)
    expect(c.rsvp.title).toBe('RSVP')
  })

  it('keeps enabled content (trimmed at the ends only) and new fields', () => {
    const c = pub(everything())
    expect(c.holyRecite1).toEqual({
      enabled: true,
      title: 'Ar-Rum 21',
      originalScript: 'وَمِنْ آيَاتِهِ\nأَنْ خَلَقَ',
      translation: 'And of His signs\n  is that He created',
      reference: '30:21',
      book: 'Ar-Rum',
      tradition: 'Islam',
    })
    expect(c.greeting).toEqual({ enabled: true, title: 'Welcome', message: 'Join us', prayer: 'May God bless\nthis union' })
    expect(c.countdown).toEqual({ enabled: true, addToCalendar: true })
    expect(c.opening.guestGreeting).toEqual({ enabled: true, label: 'Kepada Yth.' })
    expect(c.events[0]!.dressCode).toEqual({ enabled: true, text: 'Batik' })
    expect(c.events[0]!.livestream).toEqual({ enabled: true, url: 'https://youtube.com/live/x', label: 'Watch' })
    expect(c.closing.familyAcknowledgments).toBe('Keluarga Besar A\nKeluarga Besar B')
  })

  it('drops disabled sections and incomplete bank rows; keeps uploaded QRIS', () => {
    const c = pub(everything())
    expect(c.holyRecite2).toBeUndefined()
    expect(c.amplopDigital!.bankAccounts).toEqual([{ id: 'b1', bankName: 'BCA', accountHolder: 'Alex', accountNumber: '0012 3456' }])
    expect(c.amplopDigital!.qrisImage).toEqual({ src: QRIS_SRC, alt: 'QRIS' })
    expect(c.amplopDigital!.physicalGifts).toEqual({ enabled: true, recipient: 'Alex', address: 'Jl. Mawar 2\nJakarta', phone: '+62 811' })
  })

  it('removes disabled child features and financial data', () => {
    const d = everything()
    d.amplopDigital = { ...d.amplopDigital!, bankAccountsEnabled: false, qrisEnabled: false, physicalGifts: { ...d.amplopDigital!.physicalGifts!, enabled: false } }
    d.opening.guestGreeting = { enabled: false, label: 'Dear' }
    d.events[0]!.dressCode = { enabled: false, text: 'Batik' }
    d.events[0]!.livestream = { enabled: true, url: 'http://insecure.example.com' }
    d.greeting = { enabled: true }
    d.countdown = { enabled: false }
    const c = pub(d)
    const json = JSON.stringify(c)
    expect(json).not.toContain('0012 3456')
    expect(json).not.toContain('Jl. Mawar')
    expect(json).not.toContain(QRIS_SRC)
    expect(c.amplopDigital).toBeUndefined() // nothing left to show
    expect(c.opening.guestGreeting).toBeUndefined()
    expect(c.events[0]!.dressCode).toBeUndefined()
    expect(c.events[0]!.livestream).toBeUndefined()
    expect(c.greeting).toEqual({ enabled: false }) // explicit off: no legacy headline fallback
    expect(c.countdown).toEqual({ enabled: false })
  })

  it('refuses QRIS images that are not safe', () => {
    const d = everything()
    d.amplopDigital!.qrisImage = { src: 'javascript:alert(1)', alt: 'x' }
    expect(pub(d).amplopDigital!.qrisEnabled).toBe(false)
    expect(pub(d).amplopDigital!.qrisImage).toBeUndefined()
  })

  it('treats an absent addToCalendar as off', () => {
    const d = publishableDraft()
    d.countdown = { enabled: true }
    expect(pub(d).countdown).toEqual({ enabled: true })
  })
})
