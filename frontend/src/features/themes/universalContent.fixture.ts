import { sampleWedding } from '@/features/wedding/sampleWedding'
import type { WeddingContent } from '@/features/wedding/types'

export const SECTION_ORDER = ['opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate', 'events', 'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2', 'closing']
export const OPTIONAL_SECTIONS = ['holyRecite1', 'greeting', 'story', 'gallery', 'rsvp', 'wishes', 'amplopDigital', 'holyRecite2'] as const
export function universalFixture(): WeddingContent {
  return {
    ...structuredClone(sampleWedding), contentVersion: '1.1',
    holyRecite1: { enabled: true, passage: 'First passage\nSecond line', reference: 'First reference', originalScript: 'بِسْمِ اللَّهِ', translation: 'First translation' },
    holyRecite2: { enabled: true, passage: 'Second passage', reference: 'Second reference', originalScript: '愛は寛容です', translation: 'Second translation' },
    greeting: { enabled: true, title: 'Welcome friends', message: 'Please join our celebration' },
    countdown: { enabled: true },
    wishes: { enabled: true, title: 'Your prayers', introduction: 'Keep us in your thoughts' },
    amplopDigital: { enabled: true, bankAccountsEnabled: true,
      bankAccounts: [
        { bankName: 'First Bank', accountHolder: 'Alex', accountNumber: '001234567890123456789' },
        { bankName: 'Second Bank', accountHolder: 'Sarah', accountNumber: '00042' },
      ],
      qrisEnabled: true, qrisImage: { src: '/sample-wedding/qris-test.png', alt: 'QRIS for the couple' },
      physicalGifts: { enabled: true, recipient: 'Alex and Sarah', address: 'Gift Address 42', phone: '+620000000' },
    },
  }
}
