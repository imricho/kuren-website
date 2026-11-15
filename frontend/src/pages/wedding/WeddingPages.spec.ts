import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'
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
    installFakeWeddingApi({ themeId: 'ethnic', content: { opening: { weddingTitle: 'T', weddingDate: '2027-01-02' }, couple: { groom: { name: 'A' }, bride: { name: 'B' } } } })
    const { router, wrapper } = await mountApp('/wedding')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding-events')
    const nav = wrapper.get('[data-testid="section-nav"]')
    expect(nav.attributes('aria-label')).toBe('Website sections')
    expect(nav.get('a[aria-current="page"]').attributes('data-section')).toBe('events')
    // One compact list (chips on phones, a column on desktop) — no disclosure toggle.
    expect(nav.find('[data-testid="section-nav-toggle"]').exists()).toBe(false)
    expect(nav.findAll('a[data-section]')).toHaveLength(9)
    expect(nav.get('a[data-section="theme"]').attributes('href')).toBe('/themes')
    // Markers only where meaningful: a check for complete, "Needs details" for required-but-incomplete, nothing for optional.
    expect(nav.find('a[data-section="opening"] [data-status="complete"]').exists()).toBe(true)
    expect(nav.get('a[data-section="events"] [data-status="needed"]').text()).toBe('Needs details')
    expect(nav.get('a[data-section="story"]').text()).toBe('Our story')
    expect(nav.find('[data-status="optional"]').exists()).toBe(false)
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('shows a retry when loading fails', async () => {
    const api = installFakeWeddingApi()
    api.failNext('GET /weddings/me', { status: 500, message: 'Down' })
    const { wrapper } = await mountApp('/wedding/opening')
    expect(wrapper.text()).toContain('We couldn’t load your website.')
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="opening-form"]').exists()).toBe(true)
  })
})

describe('Opening page', () => {
  it('renders the fields with soft "needed" hints and the website language', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    const form = wrapper.get('[data-testid="opening-form"]')
    expect(form.get('h1').text()).toBe('Opening')
    for (const label of ['Bride’s name', 'Groom’s name', 'Website title', 'Wedding date', 'Names as displayed (optional)', 'Headline', 'Introduction', 'Website language'])
      expect(form.text()).toContain(label)
    expect(form.findAll('[data-needed]').map((n) => n.text())).toContain('Needed before publishing')
    expect(form.text()).toContain('Language your guests see')
    expect(form.findAll('fieldset legend').map((l) => l.text())).toEqual(expect.arrayContaining(['The couple', 'The wedding', 'Cover photo']))
    expect(form.get('[data-testid="save-bar"]').attributes('data-state')).toBe('clean')
  })

  it('saves opening + couple names + language, then toasts', async () => {
    const api = installFakeWeddingApi({ content: { couple: { groom: { name: 'Old', nickname: 'Dim' }, bride: {} } } })
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas Pratama')
    await wrapper.get('#f-couple-bride-name').setValue('Ayu Lestari')
    await wrapper.get('#f-weddingTitle').setValue('Pernikahan Dimas & Ayu')
    await wrapper.get('#f-weddingDate').setValue('2027-09-04')
    await wrapper.get('#f-locale').setValue('id')
    expect(wrapper.get('[data-testid="save-bar"]').attributes('data-state')).toBe('dirty')
    expect(wrapper.text()).toContain('Unsaved changes')
    expect(wrapper.text()).toContain('Leave empty to show “Dim & Ayu”.')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')[0]!.body).toEqual({
      weddingTitle: 'Pernikahan Dimas & Ayu',
      weddingDate: '2027-09-04',
    })
    expect(api.callsTo('PUT', '/weddings/w1/sections/couple')[0]!.body).toEqual({
      groom: { name: 'Dimas Pratama', nickname: 'Dim' },
      bride: { name: 'Ayu Lestari' },
    })
    expect(api.callsTo('PATCH', '/weddings/w1')[0]!.body).toEqual({ locale: 'id' })
    expect(wrapper.get('[data-testid="toast-status"]').text()).toContain('Opening saved')
    expect(wrapper.get('[data-testid="save-bar"]').attributes('data-state')).toBe('clean')
    expect(useWeddingStore().completeness.sections.opening.status).toBe('complete')
  })

  it('blocks invalid formats with an error summary and focuses the first field', async () => {
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-weddingTitle').setValue('x'.repeat(121))
    await wrapper.get('#f-coverImage-src').setValue('https://example.com/cover.jpg')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')).toHaveLength(0)
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
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas')
    api.failNext('PUT /weddings/w1/sections/couple', {
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
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await wrapper.get('#f-weddingTitle').setValue('Our wedding')
    await wrapper.get('#f-couple-groom-name').setValue('Dimas')
    await wrapper.get('#f-locale').setValue('id')
    api.failNext('PUT /weddings/w1/sections/couple', { status: 500, message: 'Server error.' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(useWeddingStore().content!.opening.weddingTitle).toBe('Our wedding')
    expect(api.callsTo('PATCH', '/weddings/w1')).toHaveLength(0) // stopped at the failure
    expect(wrapper.get('[data-testid="toast-errors"]').text()).toContain(
      'Opening details saved, but your names couldn’t be saved. Press Save again to retry.',
    )
    expect(wrapper.get('[data-testid="save-bar"]').attributes('data-state')).toBe('dirty')

    // Retry: the opening is not sent again, only the names and the language.
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')).toHaveLength(1)
    expect(api.callsTo('PUT', '/weddings/w1/sections/couple')).toHaveLength(2)
    expect(api.callsTo('PATCH', '/weddings/w1')[0]!.body).toEqual({ locale: 'id' })
    expect(wrapper.get('[data-testid="save-bar"]').attributes('data-state')).toBe('clean')
  })

  it('asks before leaving with unsaved changes', async () => {
    installFakeWeddingApi()
    const { wrapper, router } = await mountApp('/wedding/opening')
    await wrapper.get('#f-headline').setValue('Two hearts')
    void router.push({ name: 'wedding-couple' })
    await flushPromises()
    const dialog = wrapper.get('dialog')
    expect(dialog.text()).toContain('Discard unsaved changes?')
    await dialog.get('[data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding-opening')

    void router.push({ name: 'wedding-couple' })
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('wedding-couple')
    expect(useWeddingStore().anyDirty).toBe(false)
  })
})

describe('section nav dirty badge', () => {
  it('shows "Unsaved" on the current section while its form has unsaved edits', async () => {
    installFakeWeddingApi({ content: { opening: { weddingTitle: 'T', weddingDate: '2027-01-02' }, couple: { groom: { name: 'A' }, bride: { name: 'B' } } } })
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

  it('save state text is not a live region (the toast is the single announcement)', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/closing')
    await wrapper.get('#f-message').setValue('Terima kasih')
    expect(wrapper.get('[data-testid="save-state"]').attributes('role')).toBeUndefined()
    expect(wrapper.get('[data-testid="save-bar"]').find('[role="status"], [aria-live]').exists()).toBe(false)
    const save = wrapper.get('[data-testid="save-bar"] button[type="submit"]')
    ;(save.element as HTMLButtonElement).focus()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[data-testid="toast-status"]').text()).toContain('Closing saved')
    // Focus stays on the save button after saving.
    expect(document.activeElement).toBe(wrapper.get('[data-testid="save-bar"] button[type="submit"]').element)
  })
})

describe('Couple page', () => {
  it('edits the parents line for both people with Indonesian placeholders', async () => {
    const api = installFakeWeddingApi({ content: { couple: { groom: { name: 'Rizky', parents: 'Putra dari Bapak Ahmad' }, bride: { name: 'Ayu' } } } })
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
      expect(api.callsTo('PUT', '/weddings/w1/sections/couple')).toHaveLength(0)
      expect(wrapper.get('[data-testid="error-summary"]').text()).toContain('Orang tua')

      await wrapper.get('#f-groom-parents').setValue('Putra dari Bapak Ahmad & Ibu Siti')
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(api.callsTo('PUT', '/weddings/w1/sections/couple')[0]!.body).toEqual({
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
    installFakeWeddingApi({ content: { opening: { weddingDate: '2027-06-12' } } })
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
    const api = installFakeWeddingApi()
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
    expect(api.callsTo('POST', '/weddings/w1/events')).toHaveLength(0)
    expect(editor.text()).toContain('End time must be after the start time.')
    expect(editor.text()).toContain('Enter a full web address starting with https://')

    await editor.get('#ev-new-endTime').setValue('22:00')
    await editor.get('#ev-new-mapsUrl').setValue('')
    await editor.trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/weddings/w1/events')[0]!.body).toEqual({ type: 'reception', title: 'Resepsi', startTime: '19:00', endTime: '22:00' })
    expect(wrapper.find('[data-testid="event-editor"]').exists()).toBe(false)
    const item = wrapper.get('li[data-item]')
    expect(item.text()).toContain('Resepsi')
    expect(item.text()).toContain('3 detail(s) still needed before publishing')
    expect(wrapper.get('[data-testid="toast-status"]').text()).toContain('“Resepsi” added')
  })

  it('edits, reorders and deletes saved events', async () => {
    const api = installFakeWeddingApi({
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
    expect(api.callsTo('PUT', '/weddings/w1/events/order')[0]!.body).toEqual({ ids: ['b', 'a'] })
    expect(wrapper.findAll('li[data-item]').map((l) => l.attributes('data-item'))).toEqual(['b', 'a'])

    await wrapper.findAll('[data-action="edit"]')[1]!.trigger('click')
    await wrapper.get('#ev-a-venueName').setValue('Masjid Raya')
    await wrapper.get('[data-testid="event-editor"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('PUT', '/weddings/w1/events/a')[0]!.body).toEqual({ type: 'akad', title: 'Akad', venueName: 'Masjid Raya' })

    await wrapper.findAll('[data-action="delete"]')[0]!.trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(api.callsTo('DELETE', '/weddings/w1/events/b')).toHaveLength(1)
    expect(wrapper.findAll('li[data-item]')).toHaveLength(1)
  })
})

describe('event presets', () => {
  it('prefills type and title from a preset and never offers "Celebration" as the default', async () => {
    const api = installFakeWeddingApi()
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
    expect(api.callsTo('POST', '/weddings/w1/events')[0]!.body).toEqual({ type: 'other', title: 'Ngunduh Mantu' })
    // Focus goes to the new item.
    expect(document.activeElement).toBe(wrapper.get('li[data-item] [data-action="edit"]').element)
  })

  it('the Add button of an empty new event stays enabled and explains what is missing', async () => {
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    const save = wrapper.get('[data-action="save-item"]')
    expect(save.attributes('disabled')).toBeUndefined()
    expect(save.attributes('aria-disabled')).toBeUndefined()
    await wrapper.get('[data-testid="event-editor"]').trigger('submit')
    await flushPromises()
    expect(api.callsTo('POST', '/weddings/w1/events')).toHaveLength(0)
    const title = wrapper.get('#ev-new-title')
    expect(title.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(title.element)
    expect(wrapper.text()).toContain('Add at least one detail before adding this item.')
  })
})

describe('stale reorder', () => {
  it('reloads the list after a 409 so it is not stuck', async () => {
    const api = installFakeWeddingApi({ content: { events: [{ id: 'a', type: 'akad', title: 'Akad' }, { id: 'b', type: 'reception', title: 'Resepsi' }] } })
    const { wrapper } = await mountApp('/wedding/events')
    // Another tab added an event meanwhile.
    api.state.content.events.push({ id: 'c', type: 'other', title: 'Ngunduh' })
    api.failNext('PUT /weddings/w1/events/order', { status: 422, code: 'validation_error' })
    await wrapper.get('[data-reorder="b-up"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="toast-errors"]').text()).toContain('The new order couldn’t be saved.')
    expect(api.callsTo('GET', '/weddings/w1/events')).toHaveLength(1)
    expect(wrapper.findAll('li[data-item]').map((l) => l.attributes('data-item'))).toEqual(['a', 'b', 'c'])
  })
})

describe('RSVP page', () => {
  it('has an honest switch and warns when the deadline is after the wedding', async () => {
    installFakeWeddingApi({ content: { opening: { weddingDate: '2027-06-12' } } })
    const { wrapper } = await mountApp('/wedding/rsvp')
    const sw = wrapper.get('input[role="switch"]')
    expect((sw.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('Guests can’t reply online yet; this controls what your website shows.')
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
    installFakeWeddingApi({
      themeId: 'ethnic',
      content: { opening: { weddingTitle: 'Pernikahan Dimas & Ayu' }, couple: { groom: { name: 'Dimas' }, bride: { name: 'Ayu' } } },
    })
    const { wrapper } = await mountApp('/wedding/preview?from=/wedding/events')
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.get('.wedding-site').attributes('data-theme')).toBe('ethnic')
    expect(wrapper.text()).toContain('Dimas & Ayu')
    expect(wrapper.get('[data-testid="preview-theme-name"]').text()).toBe('Woven Indigo')
    expect(wrapper.get('[data-testid="notice-saved"]').text()).toBe('Shows your saved content.')
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
    installFakeWeddingApi({ themeId: null })
    const { wrapper } = await mountApp('/wedding/preview?from=//evil.example')
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.get('.wedding-site').attributes('data-theme')).toBe('international')
    expect(wrapper.get('[data-testid="notice-no-theme"]').text()).toContain('You haven’t chosen a theme yet')
    expect(wrapper.get('[data-testid="back-to-editing"]').attributes('href')).toBe('/wedding')
  })

  it('does not show unsaved edits', async () => {
    installFakeWeddingApi({ themeId: 'ethnic', content: { closing: { message: 'Saved closing words' } } })
    const { wrapper, router } = await mountApp('/wedding/closing')
    await wrapper.get('#f-message').setValue('Unsaved closing words')
    useWeddingStore().setDirty('closing', false) // skip the leave prompt for this test
    await router.push({ name: 'wedding-preview' })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.wedding-site > article').exists()).toBe(true))
    expect(wrapper.text()).toContain('Saved closing words')
    expect(wrapper.text()).not.toContain('Unsaved closing words')
  })
})
