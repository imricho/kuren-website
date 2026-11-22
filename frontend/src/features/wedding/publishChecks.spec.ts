import { describe, expect, it } from 'vitest'

import { publishableDraft, QRIS_SRC } from '@/test/publishFixture'

import { blockingIssues, issueFromServer, publicDisclosure, publishChecks, warningIssues } from './publishChecks'

const today = new Date(2026, 10, 16)
const run = (d = publishableDraft(), themeId: string | null = 'ethnic') => publishChecks(d, { themeId, locale: 'en', today })
const errorKeys = (d = publishableDraft(), themeId: string | null = 'ethnic') =>
  blockingIssues(run(d, themeId)).map((i) => `${i.section}:${i.field}:${i.code}`)

describe('publishChecks', () => {
  it('a complete draft has no blocking issues', () => {
    expect(errorKeys()).toEqual([])
  })

  it('requires theme, wedding date, both names, complete events and a closing message', () => {
    const d = publishableDraft()
    d.opening.weddingDate = undefined
    d.couple = { groom: {}, bride: { name: ' ' } }
    d.events = [{ id: 'e1', type: 'akad', title: 'Akad', date: '2027-06-12', startTime: '08:00', venueName: 'Masjid' }]
    d.closing = {}
    expect(errorKeys(d, null)).toEqual([
      'theme:themeId:required',
      'opening:weddingDate:required',
      'couple:couple.groom.name:required',
      'couple:couple.bride.name:required',
      'events:0.address:required',
      'closing:message:required',
    ])
    d.events = []
    expect(errorKeys(d)).toContain('events:events:required')
  })

  it('links each issue to its editor page and field id', () => {
    const d = publishableDraft()
    d.opening.weddingDate = undefined
    d.couple.bride = {}
    const [date, bride] = blockingIssues(run(d))
    expect(date!.to).toEqual({ name: 'editor-opening', hash: '#f-weddingDate' })
    expect(bride!.to).toEqual({ name: 'editor-opening', hash: '#f-couple-bride-name' })
    expect(bride!.message).toBe('Add the bride’s name.')
    expect(publishChecks(d, { themeId: 'ethnic', locale: 'id', today })[1]!.message).toBe('Tambahkan nama mempelai wanita.')
  })

  it('enabled optional sections need minimum content', () => {
    const d = publishableDraft()
    d.holyRecite1 = { enabled: true, reference: '30:21' }
    d.greeting = { enabled: true, prayer: 'Only a prayer' }
    d.story = { enabled: true, timeline: [{ id: 's', title: 'Only title' }] }
    d.gallery = { images: [] }
    d.wishes = { enabled: true } // never blocks
    d.holyRecite2 = { enabled: false } // disabled never blocks
    expect(errorKeys(d)).toEqual(['holyRecite1:passage:incomplete', 'greeting:message:incomplete', 'story:timeline:incomplete', 'gallery:images:incomplete'])
  })

  it('Amplop Digital: ≥1 method on and every enabled method complete; QRIS must be an upload', () => {
    const d = publishableDraft()
    d.amplopDigital = { enabled: true, bankAccountsEnabled: false, bankAccounts: [], qrisEnabled: false }
    expect(errorKeys(d)).toEqual(['amplopDigital::incomplete'])
    d.amplopDigital = {
      enabled: true,
      bankAccountsEnabled: true,
      bankAccounts: [{ bankName: 'BCA', accountHolder: 'A', accountNumber: '12 34' }, { bankName: 'BNI', accountHolder: 'B', accountNumber: '12ab' }],
      qrisEnabled: true,
      qrisImage: { src: 'https://cdn.example.com/qris.png', alt: 'QRIS' },
      physicalGifts: { enabled: true, recipient: 'Alex' },
    }
    expect(errorKeys(d)).toEqual(['amplopDigital:bankAccounts.1.accountNumber:invalid', 'amplopDigital:qrisImage:invalid', 'amplopDigital:physicalGifts.address:required'])
    d.amplopDigital.bankAccounts = []
    expect(errorKeys(d)).toContain('amplopDigital:bankAccounts:incomplete')
    d.amplopDigital = { enabled: true, bankAccountsEnabled: false, bankAccounts: [], qrisEnabled: true, qrisImage: { src: QRIS_SRC, alt: 'QRIS' } }
    expect(errorKeys(d)).toEqual([])
  })

  it('livestream needs an https link', () => {
    const d = publishableDraft()
    d.events[0]!.livestream = { enabled: true, url: 'http://example.com/live' }
    expect(errorKeys(d)).toEqual(['events:0.livestream.url:invalid'])
    d.events[0]!.livestream = { enabled: true }
    expect(errorKeys(d)).toEqual(['events:0.livestream.url:required'])
    d.events[0]!.livestream = { enabled: false, url: 'http://x' }
    expect(errorKeys(d)).toEqual([])
  })

  it('warns without blocking', () => {
    const d = publishableDraft()
    d.events[0]!.date = '2026-01-01'
    d.rsvp.deadline = '2027-07-01'
    d.opening.coverImage = undefined
    d.closing.image = { src: '/sample-wedding/closing.svg', alt: 'Sample' }
    d.holyRecite1 = { enabled: true, passage: 'A passage' }
    d.amplopDigital = { enabled: true, bankAccountsEnabled: false, bankAccounts: [], qrisEnabled: false, physicalGifts: { enabled: true, recipient: 'A', address: 'Street 1' } }
    const warnings = warningIssues(run(d)).map((i) => i.code)
    expect(warnings).toEqual(expect.arrayContaining(['past_date', 'after_wedding', 'recommended', 'sample_image', 'missing_reference', 'public_address']))
    expect(blockingIssues(run(d))).toEqual([])
  })

  it('maps server 422 details to issues with section-relative fields', () => {
    expect(issueFromServer({ section: 'opening', field: 'opening.weddingDate', code: 'required', message: 'Wedding date is required' })).toMatchObject({
      severity: 'error', section: 'opening', field: 'weddingDate', to: { name: 'editor-opening', hash: '#f-weddingDate' },
    })
    expect(issueFromServer({ section: 'events', field: 'events.1.venueName', code: 'required' }).to).toEqual({ name: 'editor-events', hash: '#f-1-venueName' })
    expect(issueFromServer({ section: 'couple', field: 'couple.groom.name', code: 'required' }).to).toEqual({ name: 'editor-opening', hash: '#f-couple-groom-name' })
    expect(issueFromServer({ section: 'amplopDigital', field: 'amplopDigital', code: 'incomplete' }).to).toEqual({ name: 'editor-gifts' })
    expect(issueFromServer({ section: 'theme', field: 'themeId', code: 'invalid' }).to).toEqual({ name: 'themes' })
  })

  it('lists which financial/delivery details will be public', () => {
    const d = publishableDraft()
    expect(publicDisclosure(d)).toEqual({ bankAccounts: 0, qris: false, physical: [] })
    d.amplopDigital = {
      enabled: true, bankAccountsEnabled: true, bankAccounts: [{ bankName: 'BCA', accountHolder: 'A', accountNumber: '1' }, { bankName: '', accountHolder: '', accountNumber: '' }],
      qrisEnabled: true, qrisImage: { src: QRIS_SRC, alt: 'Q' }, physicalGifts: { enabled: true, recipient: 'A', address: 'B', phone: '+62' },
    }
    expect(publicDisclosure(d)).toEqual({ bankAccounts: 1, qris: true, physical: ['recipient', 'address', 'phone'] })
  })
})
