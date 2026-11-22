import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useInvitationStore } from '@/stores/invitation'
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

describe('editor layout', () => {
  it('redirects /wedding to the first incomplete section', async () => {
    installFakeInvitationApi({ themeId: 'ethnic', content: { opening: { weddingTitle: 'T', weddingDate: '2027-01-02' }, couple: { groom: { name: 'A' }, bride: { name: 'B' } } } })
    const { router, wrapper } = await mountApp('/wedding')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor-events')
    const nav = wrapper.get('[data-testid="section-nav"]')
    expect(nav.attributes('aria-label')).toBe('Website sections')
    expect(nav.get('a[aria-current="page"]').attributes('data-section')).toBe('events')
    // One compact list (chips on phones, a column on desktop) — no disclosure toggle.
    expect(nav.find('[data-testid="section-nav-toggle"]').exists()).toBe(false)
    // Five group tabs; the chips show only the current route's group (Events & Location → Events).
    expect(nav.findAll('[role="tab"]').map((tab) => tab.attributes('data-group'))).toEqual(['wedding', 'events', 'moments', 'guests', 'finishing'])
    expect(nav.get('[role="tab"][aria-selected="true"]').attributes('data-group')).toBe('events')
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['events'])
    expect(nav.get('a[data-section="events"] [data-status="needed"]').text()).toBe('Needs details')
    // Our Wedding: markers only where meaningful (a check for complete, nothing for optional).
    await nav.get('[data-group="wedding"]').trigger('click')
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate'])
    expect(nav.find('a[data-section="opening"] [data-status="complete"]').exists()).toBe(true)
    // Universal sections default off: "Hidden".
    expect(nav.get('a[data-section="holyRecite1"] [data-status="hidden"]').text()).toBe('Hidden')
    await nav.get('[data-group="moments"]').trigger('click')
    expect(nav.get('a[data-section="story"]').text()).toBe('Our story')
    expect(nav.find('[data-status="optional"]').exists()).toBe(false)
    // One level-1 heading: the embedded preview announces the theme's hero <h1> as level 2.
    expect(wrapper.findAll('h1').filter((el) => el.attributes('aria-level') === undefined)).toHaveLength(1)
  })

  it('shows a retry when loading fails', async () => {
    const api = installFakeInvitationApi()
    api.failNext('GET /invitations/w1', { status: 500, message: 'Down' })
    const { wrapper } = await mountApp('/wedding/opening')
    expect(wrapper.text()).toContain('We couldn’t load your website.')
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="opening-form"]').exists()).toBe(true)
  })
})

describe('Opening page', () => {
  it('renders the fields with soft "needed" hints and the website language', async () => {
    installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/opening')
    const form = wrapper.get('[data-testid="opening-form"]')
    expect(form.get('h1').text()).toBe('Opening')
    for (const label of ['Bride’s name', 'Groom’s name', 'Website title', 'Wedding date', 'Names as displayed (optional)', 'Headline', 'Introduction', 'Website language'])
      expect(form.text()).toContain(label)
    expect(form.findAll('[data-needed]').map((n) => n.text())).toContain('Needed before publishing')
    expect(form.text()).toContain('Language your guests see')
    expect(form.findAll('fieldset legend').map((l) => l.text())).toEqual(expect.arrayContaining(['The couple', 'The wedding', 'Cover photo']))
    // Autosave: no Save/Discard bar in the form.
    expect(form.find('[data-testid="save-bar"]').exists()).toBe(false)
    expect(useInvitationStore().saveState).toBe('saved')
  })

  it('saves opening + couple names + language on Enter (Save now), without a toast', async () => {
    const api = installFakeInvitationApi({ content: { couple: { groom: { name: 'Old', nickname: 'Dim' }, bride: {} } } })
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas Pratama')
    await wrapper.get('#f-couple-bride-name').setValue('Ayu Lestari')
    await wrapper.get('#f-weddingTitle').setValue('Pernikahan Dimas & Ayu')
    await wrapper.get('#f-weddingDate').setValue('2027-09-04')
    await wrapper.get('#f-locale').setValue('id')
    expect(useInvitationStore().saveState).toBe('unsaved')
    expect(wrapper.text()).toContain('Leave empty to show “Dim & Ayu”.')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/sections/opening')[0]!.body).toEqual({
      weddingTitle: 'Pernikahan Dimas & Ayu',
      weddingDate: '2027-09-04',
    })
    expect(api.callsTo('PUT', '/invitations/w1/sections/couple')[0]!.body).toEqual({
      groom: { name: 'Dimas Pratama', nickname: 'Dim' },
      bride: { name: 'Ayu Lestari' },
    })
    expect(api.callsTo('PATCH', '/invitations/w1')[0]!.body).toEqual({ locale: 'id' })
    expect(wrapper.get('[data-testid="toast-status"]').text()).toBe('')
    expect(useInvitationStore().saveState).toBe('saved')
    expect(useInvitationStore().completeness.sections.opening.status).toBe('complete')
  })

  it('blocks invalid formats with an error summary and focuses the first field', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-weddingTitle').setValue('x'.repeat(121))
    await wrapper.get('#f-coverImage-src').setValue('https://example.com/cover.jpg')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/sections/opening')).toHaveLength(0)
    const summary = wrapper.get('[data-testid="error-summary"]')
    // Not a live region: focus moves to the first invalid field instead.
    expect(summary.attributes('role')).toBeUndefined()
    expect(summary.text()).toContain('Website title: Use 120 characters or fewer.')
    expect(summary.text()).toContain('Describe the image')
    expect(summary.get('a').attributes('href')).toBe('#f-weddingTitle')
    expect(wrapper.get('#f-weddingTitle').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement?.id).toBe('f-weddingTitle')
  })

  it('shows server 422 errors inline (including couple names)', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas')
    api.failNext('PUT /invitations/w1/sections/couple', {
      status: 422,
      code: 'validation_error',
      details: [{ field: 'groom.name', message: 'name is not allowed' }],
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('#f-couple-groom-name').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Name is not allowed')
    // The inline errors + summary explain it; no extra alert toast.
    expect(wrapper.get('[data-testid="toast-errors"]').text()).toBe('')
    expect(document.activeElement?.id).toBe('f-couple-groom-name')
  })

  it('after a partial success only the unsaved part stays dirty', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-weddingTitle').setValue('Our wedding')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas')
    await wrapper.get('#f-locale').setValue('id')
    // A non-transient failure (403) is not retried automatically: Failed, with a manual Retry.
    api.failNext('PUT /invitations/w1/sections/couple', { status: 403, message: 'Nope.' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const store = useInvitationStore()
    expect(store.content!.opening.weddingTitle).toBe('Our wedding')
    expect(api.callsTo('PATCH', '/invitations/w1')).toHaveLength(0) // stopped at the failure
    expect(store.saveState).toBe('failed')
    expect(store.isSectionDirty('opening')).toBe(true)

    // Retry: the opening is not sent again, only the names and the language.
    await store.retry()
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/sections/opening')).toHaveLength(1)
    expect(api.callsTo('PUT', '/invitations/w1/sections/couple')).toHaveLength(2)
    expect(api.callsTo('PATCH', '/invitations/w1')[0]!.body).toEqual({ locale: 'id' })
    expect(store.saveState).toBe('saved')
  })

  it('saves pending edits when leaving; asks only if something could not be saved', async () => {
    const api = installFakeInvitationApi()
    const { wrapper, router } = await mountApp('/wedding/opening')
    // A valid edit is simply saved on the way out.
    await wrapper.get('#f-headline').setValue('Two hearts')
    await router.push({ name: 'editor-couple' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor-couple')
    expect(wrapper.find('dialog[open]').exists()).toBe(false)
    expect(api.state.content.opening.headline).toBe('Two hearts')

    // An invalid edit can't be saved: ask.
    await router.push({ name: 'editor-opening' })
    await flushPromises()
    await wrapper.get('#f-weddingTitle').setValue('x'.repeat(121))
    void router.push({ name: 'editor-couple' })
    await flushPromises()
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain('Discard unsaved changes?')
    await dialog.get('[data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor-opening')
    expect(document.activeElement?.id).toBe('f-weddingTitle') // the flush attempt pointed at the problem

    void router.push({ name: 'editor-couple' })
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('editor-couple')
    expect(useInvitationStore().anyDirty).toBe(false)
  })
})

describe('section nav dirty badge', () => {
  it('shows "Unsaved" on the current section while its form has unsaved edits', async () => {
    installFakeInvitationApi({ content: { opening: { weddingTitle: 'T', weddingDate: '2027-01-02' }, couple: { groom: { name: 'A' }, bride: { name: 'B' } } } })
    const { wrapper } = await mountApp('/wedding/opening')
    const link = () => wrapper.get('[data-testid="section-nav"] a[data-section="opening"]')
    expect(link().find('[data-testid="unsaved-badge"]').exists()).toBe(false)
    expect(link().find('[data-status="complete"]').exists()).toBe(true)
    await wrapper.get('#f-headline').setValue('Two hearts')
    expect(link().get('[data-testid="unsaved-badge"]').text()).toBe('Unsaved')
    expect(link().find('[data-status="complete"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(link().find('[data-testid="unsaved-badge"]').exists()).toBe(false)
  })

  it('Enter in a field saves right away, without a toast', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/closing')
    await wrapper.get('#f-message').setValue('Terima kasih')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/sections/closing')).toHaveLength(1)
    expect(wrapper.get('[data-testid="toast-status"]').text()).toBe('')
    expect(useInvitationStore().saveState).toBe('saved')
  })
})

describe('Couple page', () => {
  it('edits the parents line for both people with Indonesian placeholders', async () => {
    const api = installFakeInvitationApi({ content: { couple: { groom: { name: 'Rizky', parents: 'Putra dari Bapak Ahmad' }, bride: { name: 'Ayu' } } } })
    const { setLocale } = (await import('@/composables/useAppLocale')).useAppLocale()
    setLocale('id')
    try {
      const { wrapper } = await mountApp('/wedding/couple')
      const groom = wrapper.get('#f-groom-parents')
      expect((groom.element as HTMLInputElement).value).toBe('Putra dari Bapak Ahmad')
      expect(wrapper.get('label[for="f-groom-parents"]').text()).toBe('Orang tua')
      expect(groom.attributes('placeholder')).toBe('Putra dari Bapak … & Ibu …')
      expect(wrapper.get('#f-bride-parents').attributes('placeholder')).toBe('Putri dari Bapak … & Ibu …')
      await wrapper.get('#f-bride-parents').setValue('Putri dari Bapak Budi & Ibu Sari')
      await wrapper.get('#f-groom-parents').setValue('x'.repeat(201))
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(api.callsTo('PUT', '/invitations/w1/sections/couple')).toHaveLength(0)
      expect(wrapper.get('[data-testid="error-summary"]').text()).toContain('Orang tua')

      await wrapper.get('#f-groom-parents').setValue('Putra dari Bapak Ahmad & Ibu Siti')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(api.callsTo('PUT', '/invitations/w1/sections/couple')[0]!.body).toEqual({
        groom: { name: 'Rizky', parents: 'Putra dari Bapak Ahmad & Ibu Siti' },
        bride: { name: 'Ayu', parents: 'Putri dari Bapak Budi & Ibu Sari' },
      })
    } finally {
      setLocale('en')
    }
  })
})

describe('readable dates', () => {
  it('shows the full date in the UI language next to the date input, linked by aria-describedby', async () => {
    installFakeInvitationApi({ content: { opening: { weddingDate: '2027-06-12' } } })
    const { setLocale } = (await import('@/composables/useAppLocale')).useAppLocale()
    setLocale('id')
    try {
      const { wrapper } = await mountApp('/wedding/opening')
      const input = wrapper.get('#f-weddingDate')
      const hint = wrapper.get('#f-weddingDate-extra')
      expect(hint.text()).toBe('Sabtu, 12 Juni 2027')
      expect(input.attributes('aria-describedby')?.split(' ')).toContain('f-weddingDate-extra')
      await input.setValue('')
      expect(wrapper.find('#f-weddingDate-extra').exists()).toBe(false)
    } finally {
      setLocale('en')
    }
  })
})

describe('Events page', () => {
  it('shows an empty state, then adds an event with validation', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/events')
    expect(wrapper.text()).toContain('No events yet')
    await wrapper.get('[data-action="add"]').trigger('click')
    const editor = wrapper.get('[data-testid="event-editor"]')
    // Type options use the UI language.
    expect(editor.findAll('select option').map((o) => o.text())).toEqual([
      'Engagement', 'Akad Nikah', 'Holy Matrimony', 'Wedding Ceremony', 'Reception', 'Celebration',
    ])
    await editor.get('#ev-new-title').setValue('Resepsi')
    await editor.get('#ev-new-type').setValue('reception')
    await editor.get('#ev-new-startTime').setValue('19:00')
    await editor.get('#ev-new-endTime').setValue('18:00')
    await editor.get('#ev-new-mapsUrl').setValue('maps.google.com')
    await editor.trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/events')).toHaveLength(0)
    expect(editor.text()).toContain('End time must be after the start time.')
    expect(editor.text()).toContain('Enter a full web address starting with https://')

    await editor.get('#ev-new-endTime').setValue('22:00')
    await editor.get('#ev-new-mapsUrl').setValue('')
    await editor.trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/events')[0]!.body).toEqual({ type: 'reception', title: 'Resepsi', startTime: '19:00', endTime: '22:00' })
    expect(wrapper.find('[data-testid="event-editor"]').exists()).toBe(false)
    const item = wrapper.get('li[data-item]')
    expect(item.text()).toContain('Resepsi')
    expect(item.text()).toContain('3 detail(s) still needed before publishing')
    expect(wrapper.get('[data-testid="toast-status"]').text()).toContain('“Resepsi” added')
  })

  it('edits, reorders and deletes saved events', async () => {
    const api = installFakeInvitationApi({
      content: {
        events: [
          { id: 'a', type: 'akad', title: 'Akad' },
          { id: 'b', type: 'reception', title: 'Resepsi' },
        ],
      },
    })
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-reorder="b-up"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/order')[0]!.body).toEqual({ ids: ['b', 'a'] })
    expect(wrapper.findAll('li[data-item]').map((l) => l.attributes('data-item'))).toEqual(['b', 'a'])

    await wrapper.findAll('[data-action="edit"]')[1]!.trigger('click')
    await wrapper.get('#ev-a-venueName').setValue('Masjid Raya')
    await wrapper.get('[data-testid="event-editor"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/a')[0]!.body).toEqual({ type: 'akad', title: 'Akad', venueName: 'Masjid Raya' })

    await wrapper.findAll('[data-action="delete"]')[0]!.trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('DELETE', '/invitations/w1/events/b')).toHaveLength(1)
    expect(wrapper.findAll('li[data-item]')).toHaveLength(1)
  })
})

describe('event presets', () => {
  it('prefills type and title from a preset and never offers "Celebration" as the default', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    const editor = wrapper.get('[data-testid="event-editor"]')
    // Focus moves into the new form (its first control: the first preset).
    expect(document.activeElement).toBe(editor.get('[data-preset="akad"]').element)
    expect(editor.findAll('[data-preset]').map((b) => b.text())).toEqual(['Akad Nikah', 'Pemberkatan', 'Reception', 'Ngunduh Mantu', 'Custom event'])
    expect((editor.get('#ev-new-type').element as HTMLSelectElement).value).toBe('reception')

    await editor.get('[data-preset="holy_matrimony"]').trigger('click')
    expect(editor.get('[data-preset="holy_matrimony"]').attributes('aria-pressed')).toBe('true')
    expect((editor.get('#ev-new-type').element as HTMLSelectElement).value).toBe('holy_matrimony')
    expect((editor.get('#ev-new-title').element as HTMLInputElement).value).toBe('Pemberkatan')

    await editor.get('[data-preset="ngunduh_mantu"]').trigger('click')
    expect((editor.get('#ev-new-type').element as HTMLSelectElement).value).toBe('other')
    expect((editor.get('#ev-new-title').element as HTMLInputElement).value).toBe('Ngunduh Mantu')

    await editor.trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/events')[0]!.body).toEqual({ type: 'other', title: 'Ngunduh Mantu' })
    // Focus goes to the new item.
    expect(document.activeElement).toBe(wrapper.get('li[data-item] [data-action="edit"]').element)
  })

  it('the Add button of an empty new event stays enabled and explains what is missing', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    const save = wrapper.get('[data-action="save-item"]')
    expect(save.attributes('disabled')).toBeUndefined()
    expect(save.attributes('aria-disabled')).toBeUndefined()
    await wrapper.get('[data-testid="event-editor"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/events')).toHaveLength(0)
    const title = wrapper.get('#ev-new-title')
    expect(title.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(title.element)
    expect(wrapper.text()).toContain('Add at least one detail before adding this item.')
  })
})

describe('stale reorder', () => {
  it('reloads the list after a 409 so it is not stuck', async () => {
    const api = installFakeInvitationApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad' }, { id: 'b', type: 'reception', title: 'Resepsi' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    // Another tab added an event meanwhile.
    api.state.content.events.push({ id: 'c', type: 'other', title: 'Ngunduh' })
    api.failNext('PUT /invitations/w1/events/order', { status: 422, code: 'validation_error' })
    await wrapper.get('[data-reorder="b-up"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="toast-errors"]').text()).toContain('The new order couldn’t be saved.')
    expect(api.callsTo('GET', '/invitations/w1/events')).toHaveLength(1)
    expect(wrapper.findAll('li[data-item]').map((l) => l.attributes('data-item'))).toEqual(['a', 'b', 'c'])
  })
})

describe('RSVP page', () => {
  it('has an honest switch and warns when the deadline is after the wedding', async () => {
    installFakeInvitationApi({ content: { opening: { weddingDate: '2027-06-12' } } })
    const { wrapper } = await mountApp('/wedding/rsvp')
    const sw = wrapper.get('input[role="switch"]')
    expect((sw.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="rsvp-offline-note"]').text()).toBe('Guests reply on your invitation. Their replies appear under Responses. See responses')
    await wrapper.get('#f-deadline').setValue('2027-07-01')
    expect(wrapper.get('[data-testid="deadline-warning"]').text()).toContain('after your wedding date')
    await wrapper.get('#f-maxGuestsPerResponse').setValue('25')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter a whole number from 1 to 20.')
  })
})

describe('Wedding preview page', () => {
  it('renders SAVED content with the selected theme and explains placeholders', async () => {
    installFakeInvitationApi({
      themeId: 'ethnic',
      content: { opening: { weddingTitle: 'Pernikahan Dimas & Ayu' }, couple: { groom: { name: 'Dimas' }, bride: { name: 'Ayu' } } },
    })
    const { wrapper } = await mountApp('/wedding/preview?from=/wedding/events')
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.get('.wedding-site').attributes('data-theme')).toBe('ethnic')
    expect(wrapper.text()).toContain('Dimas & Ayu')
    expect(wrapper.get('[data-testid="preview-theme-name"]').text()).toBe('Woven Indigo')
    expect(wrapper.get('[data-testid="notice-saved"]').text()).toBe('Shows your latest edits.')
    expect(wrapper.find('[data-testid="notice-no-theme"]').exists()).toBe(false)
    const placeholders = wrapper.get('[data-testid="notice-placeholders"]')
    expect(placeholders.findAll('a').map((a) => a.text())).toEqual(['Opening', 'Events', 'RSVP', 'Closing'])
    expect(wrapper.get('[data-testid="back-to-editing"]').attributes('href')).toBe('/wedding/events')
    // Exactly one level-1 heading once the theme has rendered. In the framed (desktop) preview the
    // page owns the h1 and the embedded theme's hero <h1> is announced as level 2.
    await flushPromises()
    const level1 = wrapper.findAll('h1').filter((h) => h.attributes('aria-level') === undefined)
    expect(level1).toHaveLength(1)
    expect(level1[0]!.element.closest('.wedding-site')).toBeNull()
    const hero = wrapper.find('.wedding-site h1')
    expect(hero.attributes()).toMatchObject({ role: 'heading', 'aria-level': '2' })
  })

  it('falls back to the default theme with a notice and ignores unsafe ?from=', async () => {
    installFakeInvitationApi({ themeId: null })
    const { wrapper } = await mountApp('/wedding/preview?from=//evil.example')
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.get('.wedding-site').attributes('data-theme')).toBe('international')
    expect(wrapper.get('[data-testid="notice-no-theme"]').text()).toContain('You haven’t chosen a theme yet')
    expect(wrapper.get('[data-testid="back-to-editing"]').attributes('href')).toBe('/invitations/w1/edit')
  })

  it('shows in-progress edits (the same live content as the editor preview)', async () => {
    installFakeInvitationApi({ themeId: 'ethnic', content: { closing: { message: 'Saved closing words' } } })
    const { wrapper, router } = await mountApp('/wedding/closing')
    await wrapper.get('#f-message').setValue('Unsaved closing words')
    useInvitationStore().setDirty('closing', false) // skip the leave prompt for this test
    await router.push({ name: 'invitation-preview' })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.get('.wedding-site').text()).toContain('Unsaved closing words')
    expect(wrapper.get('.wedding-site').text()).not.toContain('Saved closing words')
  })
})

// --- Live draft + autosave (Agent B) ------------------------------------------------

describe('live draft: the preview follows the forms', () => {
  it('typing on Opening updates livePreviewContent synchronously (title, names, language, cover image)', async () => {
    installFakeInvitationApi({ content: { couple: { groom: { name: 'Dimas' }, bride: { name: 'Ayu' } } } })
    const { wrapper } = await mountApp('/wedding/opening')
    const store = useInvitationStore()
    const title = wrapper.get('#f-weddingTitle').element as HTMLInputElement
    title.value = 'Pernikahan Kami'
    title.dispatchEvent(new Event('input'))
    // No await: the live preview is computed from the working copy right away.
    expect(store.livePreviewContent!.opening.weddingTitle).toBe('Pernikahan Kami')
    expect(store.previewContent!.opening.weddingTitle).not.toBe('Pernikahan Kami')
    expect(store.livePreviewMissing.some((m) => m.field === 'weddingTitle')).toBe(false)

    await wrapper.get('#f-couple-bride-name').setValue('Ayu Lestari')
    expect(store.livePreviewContent!.couple.bride.name).toBe('Ayu Lestari')
    await wrapper.get('#f-weddingDate').setValue('2027-09-04')
    expect(store.livePreviewContent!.opening.weddingDate).toBe('2027-09-04')
    await wrapper.get('#f-locale').setValue('id')
    expect(store.livePreviewContent!.locale).toBe('id')

    await wrapper.get('#f-coverImage-src').setValue('https://example.com/cover.jpg')
    await wrapper.get('#f-coverImage-alt').setValue('The two of us')
    expect(store.livePreviewContent!.opening.coverImage).toEqual({ src: 'https://example.com/cover.jpg', alt: 'The two of us' })
    await wrapper.get('#f-coverImage-src').setValue('javascript:alert(1)')
    expect(store.livePreviewContent!.opening.coverImage).toBeUndefined()
  })

  it('event edits (date, venue) reflect in the preview; a new event shows once it has content', async () => {
    installFakeInvitationApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad', date: '2027-01-02' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    const store = useInvitationStore()
    await wrapper.get('[data-action="edit"]').trigger('click')
    await wrapper.get('#ev-a-date').setValue('2027-03-04')
    await wrapper.get('#ev-a-venueName').setValue('Masjid Raya')
    expect(store.livePreviewContent!.events[0]).toMatchObject({ id: 'a', date: '2027-03-04', venueName: 'Masjid Raya' })
    expect(store.content!.events[0]!.date).toBe('2027-01-02')
    await wrapper.get('[data-action="done-item"]').trigger('click')
    await flushPromises()
    expect(store.content!.events[0]!.date).toBe('2027-03-04') // Done saved it

    await wrapper.get('[data-action="add"]').trigger('click')
    expect(store.livePreviewContent!.events).toHaveLength(1) // empty new form: not shown
    await wrapper.get('[data-preset="reception"]').trigger('click')
    expect(store.livePreviewContent!.events.map((e) => e.title)).toEqual(['Akad', 'Reception'])
  })

  it('hiding Our story / Gallery hides the section in the preview, keeps the content and autosaves it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const api = installFakeInvitationApi({
        content: { story: { title: 'Kisah', timeline: [{ id: 's1', title: 'Met', description: 'At school' }] } },
      })
      const { wrapper, router } = await mountApp('/wedding/story')
      const store = useInvitationStore()
      expect(store.livePreviewContent!.story?.timeline).toHaveLength(1)
      const sw = wrapper.get('#f-enabled')
      expect(sw.attributes('role')).toBe('switch')
      expect(wrapper.get('label[for="f-enabled"]').text()).toBe('Show on website')
      expect((sw.element as HTMLInputElement).checked).toBe(true)
      expect(wrapper.find('[data-testid="section-hidden-note"]').exists()).toBe(false)
      await sw.setValue(false)
      expect(store.livePreviewContent!.story?.enabled).toBe(false)
      expect(wrapper.get('[data-testid="section-hidden-note"]').text()).toBe('Hidden from your invitation — your content is kept')
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()
      expect(api.callsTo('PUT', '/invitations/w1/sections/story')[0]!.body).toEqual({ title: 'Kisah', enabled: false })
      expect(store.content!.story.timeline).toHaveLength(1)
      expect(store.previewContent!.story?.enabled).toBe(false)

      await router.push({ name: 'editor-gallery' })
      await flushPromises()
      expect(store.livePreviewContent!.gallery).toBeDefined()
      await wrapper.get('#f-enabled').setValue(false)
      expect(store.livePreviewContent!.gallery?.enabled).toBe(false)
      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()
      expect(api.callsTo('PUT', '/invitations/w1/sections/gallery')[0]!.body).toEqual({ enabled: false })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('autosave on the pages', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('saves a section once after 1000 ms idle, with If-Match, and no toast', async () => {
    const api = installFakeInvitationApi({ revision: 3 })
    const { wrapper } = await mountApp('/wedding/closing')
    const store = useInvitationStore()
    await wrapper.get('#f-message').setValue('Terima')
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.get('#f-message').setValue('Terima kasih')
    expect(store.saveState).toBe('unsaved')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    const puts = api.callsTo('PUT', '/invitations/w1/sections/closing')
    expect(puts).toEqual([{ method: 'PUT', path: '/invitations/w1/sections/closing', body: { message: 'Terima kasih' }, ifMatch: '"3"' }])
    expect(store.saveState).toBe('saved')
    expect(store.isSectionDirty('closing')).toBe(false)
    expect(wrapper.get('[data-testid="toast-status"]').text()).toBe('')
  })

  it('autosaves an open item editor; Done flushes and closes it', async () => {
    const api = installFakeInvitationApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="edit"]').trigger('click')
    await wrapper.get('#ev-a-venueName').setValue('Masjid Raya')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/a')[0]).toMatchObject({ body: { type: 'akad', title: 'Akad', venueName: 'Masjid Raya' }, ifMatch: '"1"' })
    await wrapper.get('#ev-a-address').setValue('Jl. Merdeka 1')
    await wrapper.get('[data-action="done-item"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/a')).toHaveLength(2)
    expect(wrapper.find('[data-testid="event-editor"]').exists()).toBe(false)
    // Closing the editor by its toggle also saves first.
    await wrapper.get('[data-action="edit"]').trigger('click')
    await wrapper.get('#ev-a-description').setValue('Dress code: batik')
    await wrapper.get('[data-action="edit"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/a')).toHaveLength(3)
    expect(wrapper.find('[data-testid="event-editor"]').exists()).toBe(false)
  })

  it('a new item is never autosaved, and a double Add creates exactly one record', async () => {
    const api = installFakeInvitationApi()
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="add"]').trigger('click')
    await wrapper.get('#ev-new-title').setValue('Resepsi')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.callsTo('POST', '/invitations/w1/events')).toHaveLength(0)
    const editor = wrapper.get('[data-testid="event-editor"]')
    api.holdResponses()
    await editor.trigger('submit')
    await editor.trigger('submit')
    await wrapper.get('[data-action="save-item"]').trigger('click')
    api.release()
    await flushPromises()
    expect(api.callsTo('POST', '/invitations/w1/events')).toHaveLength(1)
    expect(api.callsTo('POST', '/invitations/w1/events')[0]!.ifMatch).toBe('"1"')
    expect(api.state.content.events).toHaveLength(1)
    const store = useInvitationStore()
    expect(store.items('events')).toHaveLength(1)
    expect(store.livePreviewContent!.events.map((e) => e.title)).toEqual(['Resepsi']) // no temporary duplicate
    expect(wrapper.get('[data-testid="toast-status"]').text()).toContain('“Resepsi” added')
  })

  it('reorder and delete stay explicit and send If-Match', async () => {
    const api = installFakeInvitationApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad' }, { id: 'b', type: 'reception', title: 'Resepsi' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-reorder="b-up"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('PUT', '/invitations/w1/events/order')[0]!.ifMatch).toBe('"1"')
    await wrapper.findAll('[data-action="delete"]')[0]!.trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('DELETE', '/invitations/w1/events/b')[0]!.ifMatch).toBe('"2"')
    expect(useInvitationStore().revision).toBe(3)
  })

  it('a 404 (item gone / not yours) is Failed without retries, and the edits are kept', async () => {
    const api = installFakeInvitationApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="edit"]').trigger('click')
    api.failNext('PUT /invitations/w1/events/a', { status: 404, code: 'not_found' })
    await wrapper.get('#ev-a-venueName').setValue('Gedung')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.callsTo('PUT', '/invitations/w1/events/a')).toHaveLength(1)
    expect(useInvitationStore().saveState).toBe('failed')
    expect((wrapper.get('#ev-a-venueName').element as HTMLInputElement).value).toBe('Gedung')
  })

  it('a conflict on a page keeps the edits and stops autosaving until resolved', async () => {
    const api = installFakeInvitationApi({ content: { closing: { message: 'Old' } } })
    const { wrapper } = await mountApp('/wedding/closing')
    const store = useInvitationStore()
    api.editElsewhere((c) => (c.closing = { message: 'From the laptop' }))
    await wrapper.get('#f-message').setValue('From the phone')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(store.saveState).toBe('conflict')
    await wrapper.get('#f-thankYou').setValue('Thanks!')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.callsTo('PUT', '/invitations/w1/sections/closing')).toHaveLength(1)
    await store.keepMine({ confirm: false })
    await flushPromises()
    expect(api.state.content.closing).toEqual({ message: 'From the phone', thankYou: 'Thanks!' })
    expect(store.saveState).toBe('saved')
  })
})
