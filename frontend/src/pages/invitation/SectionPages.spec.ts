/**
 * Phase C editor pages: the v2.0 sections (profiles, milestone, organization,
 * agenda, speakers), the optional couple, sessions for non-wedding variants, the
 * RSVP extensions and settings — load, edit, autosave payload, validation.
 */
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import type { VariantId } from '@/features/invitation/registry'
import type { WeddingDraft } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mountApp } from '@/test/mountApp'

enableAutoUnmount(afterEach)

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as never
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  useToast().clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function autosave() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}

function open(variant: VariantId, section: string, content: Partial<WeddingDraft> = {}) {
  const api = installFakeInvitationApi({ invitations: [{ id: 'x1', variant, themeId: 'temuvibe-elegant', content }] })
  return { api, mounted: mountApp(`/invitations/x1/edit/${section}`) }
}
const lastPut = (api: ReturnType<typeof installFakeInvitationApi>, section: string) =>
  api.callsTo('PUT', `/invitations/x1/sections/${section}`).at(-1)?.body

describe('Profiles page', () => {
  it('offers only the variant’s roles and person fields, and autosaves the whole section', async () => {
    const { api, mounted } = open('khitanan', 'profiles', { profiles: { enabled: true, people: [] } })
    const { wrapper } = await mounted
    await wrapper.get('[data-action="add-person"]').trigger('click')
    await flushPromises()
    // khitanan: one role (child) → no role select; parents shown; no birth date.
    expect(wrapper.find('#f-people-0-role').exists()).toBe(false)
    expect(wrapper.find('#f-people-0-parents').exists()).toBe(true)
    expect(wrapper.find('#f-people-0-birthDate').exists()).toBe(false)
    await wrapper.get('#f-people-0-name').setValue('  Raka ')
    await wrapper.get('#f-people-0-parents').setValue('Putra dari Bapak Hadi')
    await autosave()
    const body = lastPut(api, 'profiles') as { enabled: boolean; people: Record<string, unknown>[] }
    expect(body.enabled).toBe(true)
    expect(body.people).toHaveLength(1)
    expect(body.people[0]).toMatchObject({ role: 'child', name: 'Raka', parents: 'Putra dari Bapak Hadi' })
    expect(typeof body.people[0]!.id).toBe('string')
    expect(api.invitation('x1')!.content.profiles?.people[0]?.name).toBe('Raka')
  })

  it('lists several roles where the variant allows them and shows birth dates for aqiqah', async () => {
    const { mounted } = open('family_reunion', 'profiles', { profiles: { enabled: true, people: [{ id: 'p1', role: 'host', name: 'Om Budi' }] } })
    const { wrapper } = await mounted
    const options = wrapper.get('#f-people-0-role').findAll('option').map((o) => o.attributes('value'))
    expect(options).toEqual(['host', 'organizer'])

    const aqiqah = open('aqiqah', 'profiles', { profiles: { enabled: true, people: [{ id: 'p1', role: 'child', name: 'Alya' }] } })
    const { wrapper: w2 } = await aqiqah.mounted
    expect(w2.find('#f-people-0-birthDate').exists()).toBe(true)
  })

  it('holds autosave while a person has details but no name, and drops fully empty rows', async () => {
    const { api, mounted } = open('graduation', 'profiles', { profiles: { enabled: true, people: [] } })
    const { wrapper } = await mounted
    await wrapper.get('[data-action="add-person"]').trigger('click')
    await wrapper.get('[data-action="add-person"]').trigger('click')
    await flushPromises()
    await wrapper.get('#f-people-1-description').setValue('Cum laude')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/profiles')).toHaveLength(0)
    expect(wrapper.text()).toContain('Fill this in, or remove the row.')
    await wrapper.get('#f-people-1-name').setValue('Dina')
    await autosave()
    const body = lastPut(api, 'profiles') as { people: { name: string }[] }
    expect(body.people.map((p) => p.name)).toEqual(['Dina'])
  })

  it('asks before removing a person with details', async () => {
    const { mounted } = open('birthday', 'profiles', { profiles: { enabled: true, people: [{ id: 'p1', role: 'celebrant', name: 'Nadia' }] } })
    const { wrapper } = await mounted
    const confirm = useConfirm()
    await wrapper.get('[data-action="remove-row"]').trigger('click')
    expect(confirm.state.open).toBe(true)
    expect(confirm.state.options.title).toBe('Remove Nadia?')
    confirm.cancel()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="repeater-row"]')).toHaveLength(1)
    await wrapper.get('[data-action="remove-row"]').trigger('click')
    confirm.confirm()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="repeater-row"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="row-status"]').text()).toBe('Nadia removed')
  })
})

describe('Milestone page', () => {
  it('shows only the variant’s fields and saves numbers', async () => {
    const { api, mounted } = open('birthday', 'milestone', { milestone: { enabled: true } })
    const { wrapper } = await mounted
    expect(wrapper.findAll('[data-field]').map((el) => el.attributes('data-field'))).toEqual(['age', 'partyTheme'])
    await wrapper.get('#f-age').setValue('30')
    await wrapper.get('#f-partyTheme').setValue('Retro')
    await autosave()
    expect(lastPut(api, 'milestone')).toEqual({ enabled: true, age: 30, partyTheme: 'Retro' })
  })

  it('validates whole numbers in range', async () => {
    const { api, mounted } = open('anniversary', 'milestone', { milestone: { enabled: true } })
    const { wrapper } = await mounted
    expect(wrapper.findAll('[data-field]').map((el) => el.attributes('data-field'))).toEqual(['years'])
    await wrapper.get('#f-years').setValue('101')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/milestone')).toHaveLength(0)
    expect(wrapper.text()).toContain('Enter a whole number from 1 to 100.')
  })
})

describe('Organization page', () => {
  it('saves the organization and accepts https websites only', async () => {
    const { api, mounted } = open('seminar', 'organization', { organization: { enabled: true } })
    const { wrapper } = await mounted
    await wrapper.get('#f-name').setValue('Acme')
    await wrapper.get('#f-websiteUrl').setValue('http://acme.example')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/organization')).toHaveLength(0)
    await wrapper.get('#f-websiteUrl').setValue('https://acme.example')
    await autosave()
    expect(lastPut(api, 'organization')).toEqual({ enabled: true, name: 'Acme', websiteUrl: 'https://acme.example' })
  })
})

describe('Agenda page', () => {
  const content: Partial<WeddingDraft> = {
    events: [{ id: 'e1', type: 'session', title: 'Main Session' }],
    speakers: { enabled: true, people: [{ id: 's1', name: 'Dr. Rina' }] },
    agenda: { enabled: true, items: [] },
  }

  it('links items to a session and speakers and checks the times', async () => {
    const { api, mounted } = open('seminar', 'agenda', content)
    const { wrapper } = await mounted
    await wrapper.get('[data-action="add-agenda-item"]').trigger('click')
    await flushPromises()
    await wrapper.get('#f-items-0-time').setValue('10:00')
    await wrapper.get('#f-items-0-endTime').setValue('09:00')
    await wrapper.get('#f-items-0-title').setValue('Keynote')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/agenda')).toHaveLength(0)
    await wrapper.get('#f-items-0-endTime').setValue('11:00')
    await wrapper.get('#f-items-0-sessionId').setValue('e1')
    await wrapper.get('[data-speaker="s1"]').setValue(true)
    await autosave()
    const body = lastPut(api, 'agenda') as { items: Record<string, unknown>[] }
    expect(body.items[0]).toMatchObject({ time: '10:00', endTime: '11:00', title: 'Keynote', sessionId: 'e1', speakerIds: ['s1'] })
  })

  it('has no speaker links where the variant has no speakers', async () => {
    const { mounted } = open('family_reunion', 'agenda', { ...content, agenda: { enabled: true, items: [{ id: 'a1', title: 'Lunch' }] } })
    const { wrapper } = await mounted
    expect(wrapper.find('[data-testid="agenda-speakers-0"]').exists()).toBe(false)
  })
})

describe('Speakers page', () => {
  it('adds a speaker with a role and keeps the limit', async () => {
    const { api, mounted } = open('workshop', 'speakers', { speakers: { enabled: true, people: [] } })
    const { wrapper } = await mounted
    await wrapper.get('[data-action="add-speaker"]').trigger('click')
    await flushPromises()
    await wrapper.get('#f-people-0-name').setValue('Dr. Rina')
    await wrapper.get('#f-people-0-role').setValue('Keynote')
    await autosave()
    expect((lastPut(api, 'speakers') as { people: unknown[] }).people[0]).toMatchObject({ name: 'Dr. Rina', role: 'Keynote' })

    const people = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, name: `S${i}` }))
    const full = open('workshop', 'speakers', { speakers: { enabled: true, people } })
    const { wrapper: w2 } = await full.mounted
    expect(w2.get('[data-action="add-speaker"]').attributes('disabled')).toBeDefined()
    expect(w2.get('[data-testid="row-limit"]').text()).toContain('30')
  })
})

describe('Couple page (anniversary)', () => {
  it('has a real show/hide switch saved as couple.enabled', async () => {
    const { api, mounted } = open('anniversary', 'couple', { couple: { groom: { name: 'Budi' }, bride: { name: 'Sari' } } })
    const { wrapper } = await mounted
    const toggle = wrapper.get('[data-testid="section-toggle"] input[role="switch"]')
    expect((toggle.element as HTMLInputElement).checked).toBe(true)
    await toggle.setValue(false)
    await autosave()
    expect(lastPut(api, 'couple')).toMatchObject({ enabled: false, groom: { name: 'Budi' } })
    expect(useInvitationStore().livePreviewContent?.sections).not.toContain('couple')
  })

  it('stays always shown for weddings (no switch)', async () => {
    const { mounted } = open('engagement', 'couple')
    const { wrapper } = await mounted
    expect(wrapper.find('[data-testid="section-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="always-shown"]').exists()).toBe(true)
  })
})

describe('Sessions (events) for non-wedding variants', () => {
  it('uses session wording, the variant’s types and presets, and an optional toggle for corporate', async () => {
    const { api, mounted } = open('seminar', 'events')
    const { wrapper } = await mounted
    expect(wrapper.get('h1').text()).toBe('Sessions')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    const types = wrapper.get('[data-testid="event-editor"] select').findAll('option').map((o) => o.attributes('value'))
    expect(types).toContain('talk')
    expect(wrapper.findAll('[data-preset]').map((b) => b.attributes('data-preset'))).toEqual(['variant-0', 'custom'])
    await wrapper.get('[data-preset="variant-0"]').trigger('click')
    expect(wrapper.find('[data-testid="event-optional"]').exists()).toBe(true)
    await wrapper.get('[data-testid="event-optional"] input').setValue(true)
    await wrapper.get('[data-testid="event-editor"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/x1/events')[0]!.body).toMatchObject({ type: 'session', title: 'Main Session', optional: true })
  })

  it('keeps the wedding presets and six types for weddings', async () => {
    installFakeInvitationApi()
    const { wrapper } = await mountApp('/invitations/w1/edit/events')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="event-editor"] select').findAll('option')).toHaveLength(6)
    expect(wrapper.find('[data-testid="event-optional"]').exists()).toBe(false)
  })
})

describe('RSVP extensions', () => {
  it('saves capacity, contact collection, session choice and registration fields', async () => {
    const { api, mounted } = open('seminar', 'rsvp', { rsvp: { enabled: true, title: 'Register' } })
    const { wrapper } = await mounted
    await wrapper.get('#f-capacity').setValue('200')
    await wrapper.get('#f-collectContact').setValue('email')
    await wrapper.get('#f-allowSessionChoice').setValue(true)
    expect(wrapper.find('[data-testid="no-optional-sessions"]').exists()).toBe(true)
    await wrapper.get('[data-action="add-registration-field"]').trigger('click')
    await flushPromises()
    await wrapper.get('#f-registrationFields-0-label').setValue('Meal')
    await wrapper.get('#f-registrationFields-0-type').setValue('select')
    await flushPromises()
    await wrapper.get('#f-registrationFields-0-options-0').setValue('Veg')
    await wrapper.get('#f-registrationFields-0-options-1').setValue('Veg')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/rsvp')).toHaveLength(0)
    expect(wrapper.text()).toContain('Each choice must be different.')
    await wrapper.get('#f-registrationFields-0-options-1').setValue('Meat')
    await autosave()
    expect(lastPut(api, 'rsvp')).toMatchObject({
      capacity: 200,
      collectContact: 'email',
      allowSessionChoice: true,
      registrationFields: [{ label: 'Meal', type: 'select', required: false, options: ['Veg', 'Meat'] }],
    })
  })

  it('validates capacity and limits questions to 10', async () => {
    const fields = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, label: `Q${i}`, type: 'text' as const, required: false }))
    const { api, mounted } = open('workshop', 'rsvp', { rsvp: { enabled: true, title: 'RSVP', registrationFields: fields } })
    const { wrapper } = await mounted
    expect(wrapper.get('[data-action="add-registration-field"]').attributes('disabled')).toBeDefined()
    await wrapper.get('#f-capacity').setValue('0')
    await autosave()
    expect(api.callsTo('PUT', '/invitations/x1/sections/rsvp')).toHaveLength(0)
    expect(wrapper.text()).toContain('Enter a whole number from 1 to 100000.')
  })
})

describe('Settings page', () => {
  it('edits title, timezone and language as record settings, and lists compatible templates only', async () => {
    const { api, mounted } = open('seminar', 'settings')
    const { wrapper } = await mounted
    const templates = wrapper.get('#st-themeId').findAll('option').map((o) => o.attributes('value'))
    expect(templates.every((id) => id?.startsWith('temuvibe-'))).toBe(true)
    expect(templates).not.toContain('temuvibe-festive')
    await wrapper.get('#st-title').setValue('Tech talk')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('#st-timezone').setValue('Asia/Makassar')
    await flushPromises()
    const patches = api.callsTo('PATCH', '/invitations/x1').map((c) => c.body)
    expect(patches).toContainEqual({ title: 'Tech talk' })
    expect(patches).toContainEqual({ timezone: 'Asia/Makassar' })
    expect(api.invitation('x1')!.revision).toBe(1)
  })
})
