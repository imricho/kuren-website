/**
 * Test fixtures: a draft with EVERY section filled (including sections a variant does
 * not offer), so tests can prove that only offered sections render.
 */
import { sectionConfig, type VariantId } from '@/features/invitation/registry'
import type { WeddingDraft } from '@/features/wedding/draft'
import { publishableDraft, QRIS_SRC } from '@/test/publishFixture'

export const FIXTURE_TODAY = new Date(2026, 10, 22)

export function everythingDraft(variant: VariantId, locale: 'en' | 'id' = 'en'): WeddingDraft {
  const d = publishableDraft()
  d.locale = locale
  const role = sectionConfig(variant, 'profiles')?.roles?.[0] ?? 'host'
  d.opening.weddingTitle = variant.startsWith('wedding') ? 'The Wedding of Alex & Sarah' : 'Festive Evening 2027'
  d.opening.guestGreeting = { enabled: true, label: 'Kepada Yth.' }
  d.holyRecite1 = { enabled: true, passage: 'Opening passage text', reference: 'Ref 1:1' }
  d.holyRecite2 = { enabled: true, passage: 'Closing passage text', reference: 'Ref 2:2' }
  d.greeting = { enabled: true, title: 'A warm welcome', message: 'Join us for the day' }
  d.countdown = { enabled: true, addToCalendar: true }
  d.events = [
    { id: 'e1', type: 'ceremony', title: 'Main Session', date: '2027-06-12', startTime: '09:00', endTime: '10:30', venueName: 'Garden Hall', address: 'Jl. Melati 1, Jakarta' },
    { id: 'e2', type: 'workshop', title: 'Breakout Workshop', date: '2027-06-12', startTime: '13:00', venueName: 'Room B', address: 'Jl. Melati 1, Jakarta', optional: true },
  ]
  d.story = { enabled: true, title: 'Our Story', timeline: [{ id: 's1', title: 'We met', description: 'At a café.' }] }
  d.gallery = { enabled: true, title: 'Moments', images: [{ id: 'g1', src: 'https://cdn.example.com/g1.jpg', alt: 'A moment' }] }
  d.rsvp = {
    enabled: true, title: 'Kindly reply', deadline: '2027-05-01', maxGuestsPerResponse: 4, confirmationMessage: 'See you there!',
    collectContact: 'email', allowSessionChoice: true,
    registrationFields: [
      { id: 'company', label: 'Company', type: 'text', required: true },
      { id: 'diet', label: 'Dietary needs', type: 'select', required: false, options: ['None', 'Vegetarian'] },
      { id: 'agree', label: 'I agree to be photographed', type: 'checkbox', required: true },
    ],
  }
  d.wishes = { enabled: true, title: 'Send wishes', introduction: 'Leave a note' }
  d.amplopDigital = {
    enabled: true, bankAccountsEnabled: true, bankAccounts: [{ id: 'b1', bankName: 'BCA', accountHolder: 'Alex', accountNumber: '0012 3456' }],
    qrisEnabled: true, qrisImage: { src: QRIS_SRC, alt: 'QRIS code' },
  }
  d.profiles = {
    enabled: true,
    people: [{ id: 'p1', role, name: 'Aisyah Putri', nickname: 'Aisyah', parents: 'Putri dari Bapak Hadi & Ibu Sri', birthDate: '2020-03-14', description: 'Loves painting' }],
  }
  d.milestone = { enabled: true, age: 7, years: 10, occasion: 'Idul Fitri 1448 H', institution: 'Universitas Indonesia', program: 'Computer Science', degree: 'S.Kom', partyTheme: 'Under the sea', description: 'A day to remember' }
  d.organization = { enabled: true, name: 'Acme Indonesia', tagline: 'Building together', description: 'Annual gathering', logo: { src: 'https://cdn.example.com/logo.png', alt: 'Acme logo' }, websiteUrl: 'https://acme.example.com' }
  d.speakers = { enabled: true, people: [{ id: 'sp1', name: 'Dr. Rina Wijaya', role: 'Keynote', organization: 'Acme', bio: 'Researcher' }] }
  d.agenda = {
    enabled: true,
    items: [
      { id: 'a2', time: '10:00', title: 'Keynote talk', sessionId: 'e1', speakerIds: ['sp1'] },
      { id: 'a1', time: '09:00', endTime: '09:30', title: 'Registration', sessionId: 'e1' },
      { id: 'a3', time: '13:00', title: 'Hands-on lab', sessionId: 'e2' },
    ],
  }
  return d
}
