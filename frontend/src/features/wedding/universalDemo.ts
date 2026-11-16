import { sampleWedding } from './sampleWedding'
import type { WeddingContent } from './types'

/** Default sample for every template browsing surface; never written to an invitation. */
export const universalDemo: WeddingContent = {
  ...sampleWedding,
  contentVersion: '1.1',
  holyRecite1: {
    enabled: true,
    passage: 'Your chosen sacred passage appears here.',
    reference: 'Holy Recite 1 · sample content',
    translation: 'Original script and translation can be supplied independently.',
  },
  greeting: { enabled: true, title: sampleWedding.opening.headline, message: sampleWedding.opening.introduction },
  countdown: { enabled: true },
  wishes: { enabled: true, title: 'Wishes & Prayers', introduction: 'Keep us in your thoughts as we begin our life together.' },
  amplopDigital: {
    enabled: true, title: 'Amplop Digital', message: 'Illustrative gift details for this preview only. Do not transfer funds.',
    bankAccountsEnabled: true,
    bankAccounts: [{ bankName: 'Example Bank', accountHolder: 'Sample Couple', accountNumber: '0000000000' }],
    qrisEnabled: true,
    qrisImage: { src: '/sample-wedding/qris-placeholder.svg', alt: 'QRIS image placeholder for template preview; not a payment code' },
    physicalGifts: { enabled: true, recipient: 'Sample Couple', address: 'Your gift delivery address appears here.' },
  },
  holyRecite2: { enabled: true, passage: 'A second passage, blessing or prayer can appear before the closing.', reference: 'Holy Recite 2 · sample content' },
}
