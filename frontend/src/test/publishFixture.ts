/** A saved draft that passes every blocking publish check (Agent B tests). */
import { emptyDraft, type WeddingDraft } from '@/features/wedding/draft'

export const QRIS_SRC = '/media/0f8fad5b-d9cb-469f-a165-70867728950e.png'

export function publishableDraft(): WeddingDraft {
  const d = emptyDraft('en')
  d.opening = { weddingTitle: 'The Wedding of Alex & Sarah', weddingDate: '2027-06-12', coverImage: { src: 'https://cdn.example.com/cover.jpg', alt: 'Alex and Sarah' } }
  d.couple = { groom: { name: 'Alex Morgan', nickname: 'Alex' }, bride: { name: 'Sarah Putri', nickname: 'Sarah' } }
  d.events = [
    { id: 'e1', type: 'ceremony', title: 'Ceremony', date: '2027-06-12', startTime: '09:00', endTime: '10:30', venueName: 'Garden Hall', address: 'Jl. Melati 1, Jakarta' },
  ]
  d.story = { enabled: false, timeline: [] }
  d.gallery = { enabled: false, images: [] }
  d.rsvp = { enabled: true, title: 'RSVP', deadline: '2027-05-01' }
  d.closing = { message: 'Thank you for celebrating with us.' }
  return d
}
