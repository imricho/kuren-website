/** /i/:slug for every category: variant rendering, renderer fallback, title/meta, ?to=, live RSVP. */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { publishingApi, type PublicInvitation } from '@/api/publishing'
import { variantOf, type VariantId } from '@/features/invitation/registry'
import { everythingDraft } from '@/features/themes/temuvibe/testFixtures'

import PublicInvitationPage from './PublicInvitationPage.vue'

enableAutoUnmount(afterEach)
beforeEach(() => {
  localStorage.clear()
  document.head.querySelectorAll('meta[name="robots"], meta[name="description"]').forEach((m) => m.remove())
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 22, 12) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function snapshot(variant: VariantId, themeId: string, locale: 'en' | 'id' = 'en'): PublicInvitation {
  return { category: variantOf(variant).category, variant, themeId, locale, timezone: 'Asia/Jakarta', content: everythingDraft(variant, locale), publishedAt: '2026-11-22T10:00:00Z' }
}

async function visit(path: string, payload: PublicInvitation) {
  vi.spyOn(publishingApi, 'getPublic').mockResolvedValue(payload)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/i/:slug', component: PublicInvitationPage, props: true }] })
  await router.push(path)
  await router.isReady()
  const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('[data-testid="public-invitation"] .wedding-site > article').exists()).toBe(true))
  return wrapper
}

const CASES: [VariantId, string, string][] = [
  ['wedding_ceremony', 'temuvibe-elegant', 'Alex & Sarah'],
  ['birthday', 'temuvibe-festive', 'Festive Evening 2027'],
  ['family_reunion', 'temuvibe-festive', 'Festive Evening 2027'],
  ['seminar', 'temuvibe-corporate', 'Festive Evening 2027'],
]

describe.each(CASES)('public invitation · %s', (variant, themeId, title) => {
  it('renders the variant in public mode with title, description, noindex and the guest name', async () => {
    const w = await visit('/i/slug-abc123?to=Budi%20Santoso', snapshot(variant, themeId))
    const page = w.get('[data-testid="public-invitation"]')
    expect(page.attributes('data-variant')).toBe(variant)
    expect(page.get('.wedding-site').attributes('data-theme')).toBe(themeId)
    expect(page.get('.wedding-site').attributes('data-render-mode')).toBe('public')
    expect(page.find('[data-editor-only]').exists()).toBe(false)
    expect(page.get('[data-testid="guest-greeting"]').text()).toContain('Budi Santoso')
    await vi.waitFor(() => expect(document.title).toBe(title))
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(`${variantOf(variant).label.en} · 12 June 2027`)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    // Live RSVP form, name prefilled from ?to=.
    const name = page.get<HTMLInputElement>('[data-section="rsvp"] input[name="name"]')
    expect(name.element.value).toBe('Budi Santoso')
    expect(page.get('[data-honeypot]').attributes('aria-hidden')).toBe('true')
    w.unmount()
    expect(document.head.querySelector('meta[name="description"]')).toBeNull()
  })
})

describe('public invitation · renderer selection', () => {
  it('a wedding on a legacy theme keeps its theme and offers the live RSVP form', async () => {
    const w = await visit('/i/alex-sarah-abc123', snapshot('wedding_ceremony', 'ethnic'))
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('ethnic')
    expect(w.find('[data-section="rsvp"] .rsvp--live [data-testid="rsvp-form"]').exists()).toBe(true)
    await vi.waitFor(() => expect(document.title).toBe('Alex & Sarah'))
  })

  it('an incompatible stored template falls back to temuvibe-elegant without crashing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await visit('/i/acme-abc123', snapshot('corporate_event', 'ethnic'))
    expect(w.get('.wedding-site').attributes('data-theme')).toBe('temuvibe-elegant')
    expect(w.find('[data-section="organization"]').exists()).toBe(true)
    expect(w.find('[data-section="couple"]').exists()).toBe(false)
  })

  it('an Indonesian birthday uses Indonesian wording and a submit reaches the slug', async () => {
    const spy = vi.spyOn(publishingApi, 'submitRsvp').mockResolvedValue({ id: 'r1', attendance: 'not_attending', partySize: 0, confirmationMessage: null })
    const payload = snapshot('birthday', 'temuvibe-festive', 'id')
    payload.content.rsvp = { enabled: true, title: 'Konfirmasi', deadline: '2027-05-01' }
    const w = await visit('/i/aisyah-abc123?to=Sari', payload)
    expect(w.get('.tv-hero__kicker').text()).toBe('Perayaan Ulang Tahun')
    await w.get('input[value="not_attending"]').setValue(true)
    await w.get('[data-testid="rsvp-form"]').trigger('submit')
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('aisyah-abc123', { name: 'Sari', attendance: 'not_attending', partySize: 0, guestLabel: 'Sari', website: '' })
    expect(w.get('[data-testid="rsvp-success"]').text()).toContain('Terima kasih')
  })

  it('a full RSVP in the snapshot shows the fully booked state', async () => {
    const payload = snapshot('community_gathering', 'temuvibe-elegant')
    ;(payload.content.rsvp as { full?: boolean }).full = true
    payload.content.rsvp.capacity = 50
    const w = await visit('/i/komunitas-abc123', payload)
    expect(w.get('[data-testid="rsvp-closed"]').attributes('data-state')).toBe('full')
  })
})
