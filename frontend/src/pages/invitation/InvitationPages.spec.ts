/** The invitation list (home), the new-invitation wizard and the RSVP responses page. */
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import { compatibleTemplates } from '@/features/invitation/catalog'
import { CATEGORIES, variantsOf } from '@/features/invitation/registry'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mountApp } from '@/test/mountApp'

enableAutoUnmount(afterEach)

beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as never
})
afterEach(() => {
  useToast().clear()
  vi.restoreAllMocks()
})

const two = () => [
  { id: 'w1', themeId: 'ethnic', title: 'Our wedding', content: { opening: { weddingDate: '2027-06-12' } }, updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'b1', variant: 'birthday' as const, themeId: 'temuvibe-festive', updatedAt: '2026-03-01T00:00:00Z' },
]

describe('Invitations list', () => {
  it('shows an empty state that starts the wizard (nothing is auto-created)', async () => {
    const api = installFakeInvitationApi({ hasWedding: false })
    const { wrapper, router } = await mountApp('/invitations')
    expect(wrapper.find('[data-testid="invitations-empty"]').exists()).toBe(true)
    expect(api.callsTo('POST', '/invitations')).toHaveLength(0)
    await wrapper.get('[data-testid="invitations-empty"] [data-action="create-invitation"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('invitation-new')
  })

  it('lists cards newest first with name, variant, template, status, date and actions', async () => {
    installFakeInvitationApi({ invitations: two() })
    const { wrapper } = await mountApp('/invitations')
    const cards = wrapper.findAll('[data-invitation]')
    expect(cards.map((c) => c.attributes('data-invitation'))).toEqual(['b1', 'w1'])
    const wedding = wrapper.get('[data-invitation="w1"]')
    expect(wedding.get('[data-testid="card-name"]').text()).toBe('Our wedding')
    expect(wedding.get('[data-testid="card-variant"]').text()).toBe('Wedding Ceremony')
    expect(wedding.get('[data-testid="card-status"]').attributes('data-state')).toBe('draft')
    expect(wedding.get('[data-testid="card-date"]').text()).toContain('2027')
    expect(wrapper.get('[data-invitation="b1"] [data-testid="card-name"]').text()).toBe('Birthday') // no title → variant label
    expect(wedding.get('[data-action="edit"]').attributes('href')).toBe('/invitations/w1/edit')
    expect(wedding.get('[data-action="preview"]').attributes('href')).toBe('/invitations/w1/preview?from=/invitations')
    expect(wedding.get('[data-action="responses"]').attributes('href')).toBe('/invitations/w1/responses')
  })

  it('shows the public link with a copy button once published, and the unpublished-changes state', async () => {
    const api = installFakeInvitationApi({ invitations: two() })
    await fetch('/api/v1/invitations/w1/publish', { method: 'POST' })
    api.editElsewhere(() => {}, 'w1')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { wrapper } = await mountApp('/invitations')
    const card = wrapper.get('[data-invitation="w1"]')
    expect(card.get('[data-testid="card-status"]').attributes('data-state')).toBe('unpublished_changes')
    expect(card.get('[data-testid="card-url"]').text()).toBe(`${location.origin}/i/alex-sarah-abc123`)
    await card.get('[data-action="copy-link"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/i/alex-sarah-abc123`)
  })

  it('deletes only after a confirmation that names the invitation and mentions replies', async () => {
    const api = installFakeInvitationApi({ invitations: two() })
    const { wrapper } = await mountApp('/invitations')
    const confirm = useConfirm()
    await wrapper.get('[data-invitation="w1"] [data-action="delete"]').trigger('click')
    expect(confirm.state.options.title).toBe('Delete “Our wedding”?')
    expect(confirm.state.options.message).toContain('RSVP replies')
    confirm.cancel()
    await flushPromises()
    expect(api.callsTo('DELETE', '/invitations/w1')).toHaveLength(0)
    await wrapper.get('[data-invitation="w1"] [data-action="delete"]').trigger('click')
    confirm.confirm()
    await flushPromises()
    expect(api.callsTo('DELETE', '/invitations/w1')).toHaveLength(1)
    expect(wrapper.findAll('[data-invitation]').map((c) => c.attributes('data-invitation'))).toEqual(['b1'])
  })

  it('/dashboard is the list', async () => {
    installFakeInvitationApi({ invitations: two() })
    const { router } = await mountApp('/dashboard')
    expect(router.currentRoute.value.name).toBe('invitations')
  })
})

describe('New invitation wizard', () => {
  it('offers every category’s variants and only compatible templates', async () => {
    installFakeInvitationApi({ hasWedding: false })
    const { wrapper, router } = await mountApp('/invitations/new')
    expect(wrapper.findAll('[data-category]').map((el) => el.attributes('data-category'))).toEqual(CATEGORIES.map((c) => c.id))
    for (const category of CATEGORIES) {
      await router.push({ query: { category: category.id, step: 'variant' } })
      await flushPromises()
      expect(wrapper.findAll('[data-variant]').map((el) => el.attributes('data-variant'))).toEqual(variantsOf(category.id).map((v) => v.id))
      for (const v of variantsOf(category.id)) {
        await router.push({ query: { category: category.id, variant: v.id, step: 'template' } })
        await flushPromises()
        const shown = wrapper.findAll('[data-template]').map((el) => el.attributes('data-template'))
        expect(shown, v.id).toEqual(compatibleTemplates(v.id).map((t) => t.id))
      }
    }
  })

  it('walks Category → Variant → Template → Name, keeps choices on Back, and creates then opens the editor', async () => {
    const api = installFakeInvitationApi({ hasWedding: false })
    const { wrapper, router } = await mountApp('/invitations/new')
    expect(wrapper.get('[aria-current="step"]').attributes('data-step')).toBe('category')
    expect(wrapper.get('[data-action="next"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-category="corporate"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-action="next"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-variant="seminar"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-action="next"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-template="temuvibe-corporate"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-action="back"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ step: 'variant', category: 'corporate', variant: 'seminar', template: 'temuvibe-corporate' })
    expect((wrapper.get('[data-variant="seminar"]').element as HTMLInputElement).checked).toBe(true)
    await router.push({ query: { ...router.currentRoute.value.query, step: 'name' } })
    await flushPromises()
    await wrapper.get('#wz-title').setValue('Tech talk')
    await wrapper.get('#wz-timezone').setValue('Asia/Makassar')
    await flushPromises()
    await wrapper.get('[data-action="create"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations')[0]!.body).toEqual({
      category: 'corporate', variant: 'seminar', themeId: 'temuvibe-corporate', title: 'Tech talk', locale: 'id', timezone: 'Asia/Makassar',
    })
    expect(router.currentRoute.value.params.id).toBe('w1')
    expect(String(router.currentRoute.value.name)).toMatch(/^editor/)
  })

  it('resumes from the URL after a reload, and never skips ahead past a missing choice', async () => {
    installFakeInvitationApi({ hasWedding: false })
    const { wrapper } = await mountApp('/invitations/new?step=name&category=celebration&variant=birthday&template=temuvibe-festive')
    expect(wrapper.find('[data-testid="step-name"]').exists()).toBe(true)
    const skipped = await mountApp('/invitations/new?step=name&category=celebration')
    expect(skipped.wrapper.find('[data-testid="step-variant"]').exists()).toBe(true)
  })

  it('preselects ?template= when compatible and explains when it is not', async () => {
    installFakeInvitationApi({ hasWedding: false })
    const ok = await mountApp('/invitations/new?step=template&category=wedding&variant=wedding_ceremony&template=ethnic')
    expect((ok.wrapper.get('[data-template="ethnic"]').element as HTMLInputElement).checked).toBe(true)
    const bad = await mountApp('/invitations/new?step=template&category=corporate&variant=seminar&template=ethnic')
    expect(bad.wrapper.find('[data-testid="template-incompatible"]').exists()).toBe(true)
    expect(bad.wrapper.find('[data-template="ethnic"]').exists()).toBe(false)
    expect(bad.wrapper.get('[data-action="next"]').attributes('disabled')).toBeDefined()
  })
})

describe('Responses page', () => {
  const replies = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      name: `Guest ${i + 1}`,
      attendance: i % 3 === 2 ? ('not_attending' as const) : ('attending' as const),
      partySize: i % 3 === 2 ? 0 : 2,
      email: i === 0 ? 'g1@example.com' : null,
      sessionIds: i === 0 ? ['e1'] : [],
      answers: (i === 0 ? { company: 'Acme', veg: true } : {}) as Record<string, string | boolean>,
      message: i === 0 ? 'See you!' : null,
    }))

  function setup(n: number) {
    const api = installFakeInvitationApi({
      invitations: [{
        id: 'x1',
        variant: 'seminar',
        content: {
          events: [{ id: 'e1', type: 'session', title: 'Workshop A', optional: true }],
          rsvp: { enabled: true, capacity: 100, registrationFields: [{ id: 'company', label: 'Company', type: 'text', required: false }] },
        },
      }],
    })
    api.seedResponses('x1', replies(n))
    return api
  }

  it('shows the summary, an accessible table and the CSV export link', async () => {
    setup(3)
    const { wrapper } = await mountApp('/invitations/x1/responses')
    const summary = (key: string) => wrapper.get(`[data-summary="${key}"] dd`).text()
    expect([summary('responses'), summary('attending'), summary('notAttending'), summary('attendingPeople'), summary('capacityLeft')]).toEqual(['3', '2', '1', '4', '96'])
    const table = wrapper.get('[data-testid="responses-table"]')
    expect(table.find('caption').text()).toBe('Replies 1–3 of 3')
    expect(table.findAll('th[scope="col"]').length).toBe(9)
    const first = table.get('[data-response="r1"]')
    expect(first.get('th[scope="row"]').text()).toBe('Guest 1')
    expect(first.text()).toContain('g1@example.com')
    expect(first.text()).toContain('Workshop A')
    expect(first.text()).toContain('Company: Acme')
    expect(first.text()).toContain('veg: Yes')
    expect(wrapper.get('[data-action="export-csv"]').attributes()).toMatchObject({ href: '/api/v1/invitations/x1/rsvp-responses.csv', download: '' })
    expect(wrapper.find('[data-testid="responses-cards"]').exists()).toBe(true)
  })

  it('paginates 25 at a time', async () => {
    const api = setup(30)
    const { wrapper, router } = await mountApp('/invitations/x1/responses')
    expect(wrapper.get('[data-testid="responses-pagination"]').text()).toContain('Showing 1–25 of 30')
    expect(wrapper.find('[data-action="prev-page"]').exists()).toBe(false)
    await wrapper.get('[data-action="next-page"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.offset).toBe('25')
    expect(api.calls.at(-1)?.path).toBe('/invitations/x1/rsvp-responses?limit=25&offset=25')
    expect(wrapper.get('[data-testid="responses-pagination"]').text()).toContain('Showing 26–30 of 30')
  })

  it('deletes a reply after confirming, then refreshes the totals', async () => {
    const api = setup(2)
    const { wrapper } = await mountApp('/invitations/x1/responses')
    const confirm = useConfirm()
    await wrapper.get('[data-testid="responses-table"] [data-response="r1"] [data-action="delete-response"]').trigger('click')
    expect(confirm.state.options.title).toBe('Delete the reply from Guest 1?')
    confirm.confirm()
    await flushPromises()
    expect(api.callsTo('DELETE', '/invitations/x1/rsvp-responses/r1')).toHaveLength(1)
    expect(wrapper.get('[data-summary="responses"] dd').text()).toBe('1')
  })

  it('shows an empty state without replies', async () => {
    setup(0)
    const { wrapper } = await mountApp('/invitations/x1/responses')
    expect(wrapper.find('[data-testid="responses-empty"]').exists()).toBe(true)
  })
})
