/** CMS v2.0 editor pages: navigation groups, section visibility, universal sections, uploads. */
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Let the 1 s autosave debounce fire and the request finish. */
async function autosave() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}
const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

describe('section navigation groups', () => {
  it('shows five group tabs; the active group follows the route', async () => {
    installFakeWeddingApi()
    const { wrapper, router } = await mountApp('/wedding/gifts')
    const nav = wrapper.get('[data-testid="section-nav"]')
    const tabs = nav.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['Wedding', 'Events', 'Moments', 'Guests', 'Finish'])
    expect(nav.get('[role="tab"][aria-selected="true"]').attributes('data-group')).toBe('finishing')
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['amplopDigital', 'holyRecite2', 'closing', 'publish'])
    expect(nav.get('a[data-section="publish"]').attributes('href')).toBe('/wedding/publish')
    expect(nav.get('a[data-section="amplopDigital"]').attributes('aria-current')).toBe('page')
    // Theme is linked from the preview toolbar, not a chip.
    expect(nav.find('a[data-section="theme"]').exists()).toBe(false)

    await router.push({ name: 'wedding-wishes' })
    await flushPromises()
    expect(nav.get('[role="tab"][aria-selected="true"]').attributes('data-group')).toBe('guests')
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['rsvp', 'wishes'])
  })

  it('arrow keys move between group tabs; Our Moments has a non-interactive music note', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    const nav = wrapper.get('[data-testid="section-nav"]')
    await nav.get('[data-group="wedding"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(nav.get('[aria-selected="true"]').attributes('data-group')).toBe('events')
    expect(document.activeElement?.getAttribute('data-group')).toBe('events')
    await nav.get('[data-group="events"]').trigger('keydown', { key: 'End' })
    await nav.get('[data-group="finishing"]').trigger('keydown', { key: 'ArrowRight' })
    expect(nav.get('[aria-selected="true"]').attributes('data-group')).toBe('wedding')
    await nav.get('[data-group="moments"]').trigger('click')
    const note = nav.get('[data-note="music"]')
    expect(note.element.tagName).toBe('P')
    expect(note.text()).toBe('Background music isn’t available yet — your invitation never plays music')
    expect(note.find('input, a, button').exists()).toBe(false)
  })

  it('marks disabled optional sections "Hidden" and keeps names in the accessible label', async () => {
    installFakeWeddingApi({ content: { story: { enabled: false, timeline: [] }, holyRecite1: { enabled: true, passage: 'x' } } })
    const { wrapper } = await mountApp('/wedding/story')
    const nav = wrapper.get('[data-testid="section-nav"]')
    expect(nav.get('a[data-section="story"]').text()).toBe('Our storyHidden')
    expect(nav.find('a[data-section="gallery"] [data-status="hidden"]').exists()).toBe(false)
    await nav.get('[data-group="wedding"]').trigger('click')
    expect(nav.find('a[data-section="holyRecite1"] [data-status="hidden"]').exists()).toBe(false)
    expect(nav.find('a[data-section="greeting"] [data-status="hidden"]').exists()).toBe(true)
  })

  it('counts the 5 mandatory sections + theme', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    expect(wrapper.get('[data-testid="sections-done"]').text()).toBe('0 of 6 done')
  })
})

describe('section visibility header', () => {
  it('mandatory sections have no switch and say "Always shown"', async () => {
    installFakeWeddingApi()
    for (const path of ['/wedding/opening', '/wedding/couple', '/wedding/date', '/wedding/events', '/wedding/closing']) {
      const { wrapper } = await mountApp(path)
      expect(wrapper.get('[data-testid="always-shown"]').text()).toBe('Always shown')
      expect(wrapper.find('[data-testid="section-toggle"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('optional sections: OFF hides the fields (kept), shows the note, announces, keeps focus', async () => {
    installFakeWeddingApi({ content: { wishes: { enabled: true, title: 'Doa' } } })
    const { wrapper } = await mountApp('/wedding/wishes')
    expect(wrapper.find('[data-testid="always-shown"]').exists()).toBe(false)
    const sw = wrapper.get('[data-testid="section-toggle"] input[role="switch"]')
    expect(wrapper.get('label[for="f-enabled"]').text()).toBe('Show on website')
    ;(sw.element as HTMLInputElement).focus()
    await sw.setValue(false)
    expect(document.activeElement).toBe(sw.element)
    expect(wrapper.get('[data-testid="section-fields"]').isVisible()).toBe(false)
    expect((wrapper.get('#f-title').element as HTMLInputElement).value).toBe('Doa')
    expect(wrapper.get('[data-testid="section-hidden-note"]').text()).toBe('Hidden from your invitation — your content is kept')
    const status = wrapper.get('[data-testid="section-toggle-status"]')
    expect(status.attributes('aria-live')).toBe('polite')
    expect(status.text()).toBe('Wishes & Prayers hidden from your invitation')
  })

  it('Story, Gallery and RSVP use the same toggle row', async () => {
    installFakeWeddingApi()
    for (const path of ['/wedding/story', '/wedding/gallery', '/wedding/rsvp']) {
      const { wrapper } = await mountApp(path)
      expect(wrapper.find('header [data-testid="section-toggle"]').exists()).toBe(true)
      wrapper.unmount()
    }
  })
})

describe('Holy Recite pages', () => {
  it('renders the fields with RTL-ready original script and saves exactly what was typed', async () => {
    fakeTimers()
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/holy-recite-1')
    const store = useWeddingStore()
    expect(wrapper.get('h1').text()).toBe('Holy Recite 1')
    expect(wrapper.get('[data-testid="section-fields"]').isVisible()).toBe(false) // off by default
    await wrapper.get('#f-enabled').setValue(true)
    const original = wrapper.get('[data-testid="original-script"]')
    expect(original.attributes('dir')).toBe('auto')
    expect(original.attributes('lang')).toBeUndefined()
    expect(original.attributes('spellcheck')).toBe('false')
    expect(original.attributes('autocapitalize')).toBe('off')
    expect(original.attributes('autocomplete')).toBe('off')
    expect(original.attributes('style')).toContain('Amiri')
    expect(wrapper.get('[data-testid="recite-guidance"]').text()).toContain('we never change your text')
    for (const label of ['Heading', 'Tradition or scripture', 'Book', 'Reference', 'Passage in the original language', 'Passage (Latin script or transliteration)', 'Translation', 'Translation language', 'Attribution'])
      expect(wrapper.text()).toContain(label)

    const arabic = 'وَمِنْ آيَاتِهِ\nأَنْ خَلَقَ لَكُم'
    await original.setValue(arabic)
    await wrapper.get('#f-translation').setValue('Line one\n\n  indented line')
    await wrapper.get('#f-reference').setValue('30:21')
    expect(store.liveDraft!.holyRecite1).toMatchObject({ enabled: true, originalScript: arabic })
    expect(store.livePreviewContent!.holyRecite1?.originalScript).toBe(arabic)
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/holyRecite1')[0]!.body).toEqual({
      enabled: true,
      originalScript: arabic,
      translation: 'Line one\n\n  indented line',
      reference: '30:21',
    })
    expect(api.callsTo('PUT', '/weddings/w1/sections/holyRecite2')).toHaveLength(0)
  })

  it('Holy Recite 2 is independent and never copies 1', async () => {
    installFakeWeddingApi({ content: { holyRecite1: { enabled: true, passage: 'First' } } })
    const { wrapper, router } = await mountApp('/wedding/holy-recite-1')
    expect((wrapper.get('#f-passage').element as HTMLTextAreaElement).value).toBe('First')
    await router.push({ name: 'wedding-holy-recite-2' })
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Holy Recite 2')
    expect(wrapper.get('form').attributes('data-recite')).toBe('holyRecite2')
    expect((wrapper.get('#f-passage').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.get('#f-enabled').element as HTMLInputElement).checked).toBe(false)
  })

  it('holds autosave on over-long values', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({ content: { holyRecite1: { enabled: true } } })
    const { wrapper } = await mountApp('/wedding/holy-recite-1')
    await wrapper.get('#f-reference').setValue('x'.repeat(201))
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/holyRecite1')).toHaveLength(0)
    expect(useWeddingStore().saveState).toBe('invalid')
  })
})

describe('Greeting page', () => {
  it('seeds from the Opening headline/introduction without enabling it', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({ content: { opening: { headline: 'Bismillah', introduction: 'Dengan hormat' } } })
    const { wrapper } = await mountApp('/wedding/greeting')
    expect((wrapper.get('#f-enabled').element as HTMLInputElement).checked).toBe(false)
    expect((wrapper.get('#f-title').element as HTMLInputElement).value).toBe('Bismillah')
    expect((wrapper.get('#f-message').element as HTMLTextAreaElement).value).toBe('Dengan hormat')
    expect(wrapper.find('[data-testid="greeting-seeded"]').exists()).toBe(true)
    await autosave()
    expect(api.writes()).toHaveLength(0) // seeding alone saves nothing

    await wrapper.get('#f-enabled').setValue(true)
    await wrapper.get('#f-prayer').setValue('Semoga sakinah')
    expect(useWeddingStore().liveDraft!.greeting).toEqual({ enabled: true, title: 'Bismillah', message: 'Dengan hormat', prayer: 'Semoga sakinah' })
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/greeting')[0]!.body).toEqual({
      enabled: true,
      title: 'Bismillah',
      message: 'Dengan hormat',
      prayer: 'Semoga sakinah',
    })
  })

  it('uses the stored greeting when there is one', async () => {
    installFakeWeddingApi({ content: { opening: { headline: 'Old' }, greeting: { enabled: false, title: 'Salam' } } })
    const { wrapper } = await mountApp('/wedding/greeting')
    expect((wrapper.get('#f-title').element as HTMLInputElement).value).toBe('Salam')
    expect(wrapper.find('[data-testid="greeting-seeded"]').exists()).toBe(false)
  })
})

describe('Wedding Date & Countdown page', () => {
  it('edits the same opening.weddingDate and the countdown options as siblings', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({ content: { opening: { weddingTitle: 'T', weddingDate: '2027-06-12', guestGreeting: { enabled: true, label: 'Kepada Yth.' } } } })
    const { wrapper, router } = await mountApp('/wedding/date')
    const store = useWeddingStore()
    expect(wrapper.find('[data-testid="section-toggle"]').exists()).toBe(false)
    expect((wrapper.get('#f-weddingDate').element as HTMLInputElement).value).toBe('2027-06-12')
    await wrapper.get('#f-weddingDate').setValue('2027-07-01')
    expect(store.livePreviewContent!.opening.weddingDate).toBe('2027-07-01')
    await wrapper.get('#cd-enabled').setValue(true)
    expect(store.liveDraft!.countdown).toEqual({ enabled: true, addToCalendar: false })
    await autosave()
    // Opening is saved whole with only the date changed (PUT replaces the section).
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')[0]!.body).toEqual({
      weddingTitle: 'T',
      weddingDate: '2027-07-01',
      guestGreeting: { enabled: true, label: 'Kepada Yth.' },
    })
    expect(api.callsTo('PUT', '/weddings/w1/sections/countdown')[0]!.body).toEqual({ enabled: true, addToCalendar: false })

    // Turning the countdown off keeps the add-to-calendar choice independent.
    await wrapper.get('#cd-addToCalendar').setValue(true)
    await wrapper.get('#cd-enabled').setValue(false)
    expect(wrapper.get('#cd-addToCalendar').isVisible()).toBe(true)
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/countdown').at(-1)!.body).toEqual({ enabled: false, addToCalendar: true })

    await router.push({ name: 'wedding-opening' })
    await flushPromises()
    expect((wrapper.get('#f-weddingDate').element as HTMLInputElement).value).toBe('2027-07-01')
  })
})

describe('Wishes page', () => {
  it('is honest that there is no online guestbook yet', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/wishes')
    expect(wrapper.get('[data-testid="wishes-coming-soon"]').text()).toBe('Guests can’t send wishes online yet — the guestbook is coming soon.')
    expect(wrapper.find('[data-testid="wishes-form"] textarea[name="wish"]').exists()).toBe(false)
  })
})

describe('Amplop Digital page', () => {
  it('defaults bank transfer on when first enabled, warns about privacy, and saves string account numbers', async () => {
    fakeTimers()
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/gifts')
    const store = useWeddingStore()
    await wrapper.get('#f-enabled').setValue(true)
    expect((wrapper.get('#f-bankAccountsEnabled').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('#f-qrisEnabled').element as HTMLInputElement).checked).toBe(false)
    const privacy = wrapper.get('[data-testid="amplop-privacy"]')
    expect(privacy.attributes('role')).toBe('note')
    expect(privacy.text()).toContain('Anyone with your invitation link can see these details')

    await wrapper.get('[data-action="add-bank-account"]').trigger('click')
    await flushPromises()
    expect(document.activeElement?.id).toBe('f-bankAccounts-0-bankName')
    await wrapper.get('#f-bankAccounts-0-bankName').setValue('BCA')
    await wrapper.get('#f-bankAccounts-0-accountHolder').setValue('Ayu Lestari')
    const number = wrapper.get('#f-bankAccounts-0-accountNumber')
    expect(number.attributes('type')).toBe('text')
    expect(number.attributes('inputmode')).toBe('numeric')
    expect(number.attributes('autocomplete')).toBe('off')
    await number.setValue('0012 3456-789')
    expect(wrapper.get('[data-testid="bank-row"] [data-testid="extra-hint"]').text()).toBe('Guests will see: BCA · 0012 3456-789 · Ayu Lestari')
    // An extra empty row is dropped from the payload.
    await wrapper.get('[data-action="add-bank-account"]').trigger('click')
    expect(store.liveDraft!.amplopDigital!.bankAccounts).toHaveLength(1)
    await autosave()
    const body = api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')[0]!.body as Record<string, unknown>
    const accounts = body.bankAccounts as { id: string; accountNumber: unknown }[]
    expect(accounts).toHaveLength(1)
    expect(accounts[0]!.accountNumber).toBe('0012 3456-789')
    expect(typeof accounts[0]!.accountNumber).toBe('string')
    expect(accounts[0]!.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    expect(body).toMatchObject({ enabled: true, bankAccountsEnabled: true, qrisEnabled: false })
    expect(body.physicalGifts).toBeUndefined()
  })

  it('half-filled or invalid rows hold autosave', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({
      content: { amplopDigital: { enabled: true, bankAccountsEnabled: true, qrisEnabled: false, bankAccounts: [] } },
    })
    const { wrapper } = await mountApp('/wedding/gifts')
    await wrapper.get('[data-action="add-bank-account"]').trigger('click')
    await wrapper.get('#f-bankAccounts-0-bankName').setValue('BRI')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')).toHaveLength(0)
    expect(useWeddingStore().saveState).toBe('invalid')
    expect(wrapper.get('[data-testid="error-summary"]').text()).toContain('Fill in all three details')

    await wrapper.get('#f-bankAccounts-0-accountHolder').setValue('Dimas')
    await wrapper.get('#f-bankAccounts-0-accountNumber').setValue('12a34')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')).toHaveLength(0)
    expect(wrapper.text()).toContain('Use digits only')
    await wrapper.get('#f-bankAccounts-0-accountNumber').setValue('01234')
    await autosave()
    expect((api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')[0]!.body as { bankAccounts: { accountNumber: string }[] }).bankAccounts[0]!.accountNumber).toBe('01234')
  })

  it('reorders and removes rows (with confirmation); child switches keep data and disable their panels', async () => {
    installFakeWeddingApi({
      content: {
        amplopDigital: {
          enabled: true,
          bankAccountsEnabled: true,
          qrisEnabled: false,
          bankAccounts: [
            { id: 'a', bankName: 'BCA', accountHolder: 'A', accountNumber: '1' },
            { id: 'b', bankName: 'BNI', accountHolder: 'B', accountNumber: '2' },
          ],
          physicalGifts: { enabled: false, address: 'Jl. Mawar 1' },
        },
      },
    })
    const { wrapper } = await mountApp('/wedding/gifts')
    const store = useWeddingStore()
    await wrapper.get('[data-reorder="b-up"]').trigger('click')
    expect(store.liveDraft!.amplopDigital!.bankAccounts.map((b) => b.id)).toEqual(['b', 'a'])
    await flushPromises()
    expect(document.activeElement?.getAttribute('data-reorder')).toBe('b-down')

    const confirm = useConfirm()
    await wrapper.findAll('[data-action="remove-bank-account"]')[0]!.trigger('click')
    expect(confirm.state.open).toBe(true)
    expect(confirm.state.options.title).toBe('Remove BNI?')
    confirm.cancel()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="bank-row"]')).toHaveLength(2)
    await wrapper.findAll('[data-action="remove-bank-account"]')[0]!.trigger('click')
    confirm.confirm()
    await flushPromises()
    expect(store.liveDraft!.amplopDigital!.bankAccounts.map((b) => b.id)).toEqual(['a'])
    expect(wrapper.get('[data-testid="amplop-status"]').text()).toBe('BNI removed')

    const physical = wrapper.get('[data-testid="physical-panel"]')
    expect(physical.element.tagName).toBe('FIELDSET') // implicit group role
    expect(physical.attributes('disabled')).toBeDefined()
    // The explanation sits outside the disabled panel (not dimmed, not skipped) and is read with the switch.
    const offNoteId = wrapper.get('#f-physicalEnabled').attributes('aria-describedby')!.split(' ').find((id) => id.endsWith('-off'))!
    expect(wrapper.get(`[id="${offNoteId}"]`).text()).toContain('Turned off')
    expect(physical.text()).not.toContain('Turned off')
    expect((wrapper.get('#f-address').element as HTMLTextAreaElement).value).toBe('Jl. Mawar 1')
    expect(wrapper.get('#f-phone').attributes('type')).toBe('tel')
    await wrapper.get('#f-bankAccountsEnabled').setValue(false)
    expect(wrapper.find('[data-testid="amplop-privacy"]').exists()).toBe(false)
    expect(store.liveDraft!.amplopDigital!.bankAccounts).toHaveLength(1) // kept while off
  })

  it('caps bank accounts at 20', async () => {
    const bankAccounts = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, bankName: 'B', accountHolder: 'H', accountNumber: String(i) }))
    installFakeWeddingApi({ content: { amplopDigital: { enabled: true, bankAccountsEnabled: true, qrisEnabled: false, bankAccounts } } })
    const { wrapper } = await mountApp('/wedding/gifts')
    expect(wrapper.get('[data-action="add-bank-account"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="bank-limit"]').text()).toBe('You can add up to 20 accounts.')
  })

  it('validates the physical-gift phone', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({
      content: { amplopDigital: { enabled: true, bankAccountsEnabled: false, qrisEnabled: false, bankAccounts: [], physicalGifts: { enabled: true } } },
    })
    const { wrapper } = await mountApp('/wedding/gifts')
    await wrapper.get('#f-phone').setValue('+62 812--3')
    await autosave()
    expect(api.writes()).toHaveLength(0)
    await wrapper.get('#f-phone').setValue('+62 812-3456')
    await wrapper.get('#f-recipient').setValue('Ayu')
    await autosave()
    expect((api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')[0]!.body as Record<string, unknown>).physicalGifts).toEqual({
      enabled: true,
      recipient: 'Ayu',
      phone: '+62 812-3456',
    })
  })

  it('uploads a QRIS image (kind qris, uncropped) and stores the merchant name as alt', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({ content: { amplopDigital: { enabled: true, bankAccountsEnabled: false, qrisEnabled: true, bankAccounts: [] } } })
    const { wrapper } = await mountApp('/wedding/gifts')
    const panel = wrapper.get('[data-testid="qris-panel"]')
    expect(panel.find('[data-action="toggle-focal"]').exists()).toBe(false)
    await wrapper.get('#f-qrisName').setValue('Toko Ayu')
    const input = panel.get('[data-testid="image-file-input"]')
    const file = new File([new Uint8Array([1, 2, 3])], 'qris.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(api.state.assets).toHaveLength(1)
    expect(api.state.assets[0]!.kind).toBe('qris')
    expect(panel.get('[data-testid="image-thumb-img"]').classes()).toContain('object-contain')
    expect(panel.get('[data-action="upload-image"]').text()).toBe('Replace')
    await autosave()
    expect((api.callsTo('PUT', '/weddings/w1/sections/amplopDigital')[0]!.body as Record<string, unknown>).qrisImage).toEqual({
      src: api.state.assets[0]!.src,
      alt: 'QRIS Toko Ayu',
    })
  })
})

describe('image uploads', () => {
  function choose(wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'], file: File) {
    const input = wrapper.get('[data-testid="image-file-input"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    return input.trigger('change')
  }

  it('uploads a cover photo and sets src to the returned /media path', async () => {
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    await choose(wrapper, new File([new Uint8Array(10)], 'cover.jpg', { type: 'image/jpeg' }))
    await flushPromises()
    const call = api.callsTo('POST', '/weddings/w1/assets')[0]!
    expect((call.body as FormData).get('kind')).toBe('image')
    expect((wrapper.get('#f-coverImage-src').element as HTMLInputElement).value).toMatch(/^\/media\/[0-9a-f-]{36}\.jpg$/)
    expect(wrapper.get('[data-testid="upload-status"]').text()).toBe('Photo uploaded.')
    // Alt text is still required before the autosave can send it.
    expect(wrapper.find('#f-coverImage-alt').exists()).toBe(true)
  })

  it('rejects files that are too large or of the wrong type without uploading', async () => {
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/opening')
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })
    await choose(wrapper, big)
    expect(wrapper.get('[data-testid="upload-error"]').text()).toBe('This photo is larger than 5 MB. Choose a smaller one.')
    await choose(wrapper, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))
    expect(wrapper.get('[data-testid="upload-error"]').text()).toBe('Choose a JPEG, PNG or WebP image.')
    expect(api.callsTo('POST', '/weddings/w1/assets')).toHaveLength(0)
  })

  it('keeps the previous image and shows an error when the upload fails', async () => {
    const api = installFakeWeddingApi({ content: { closing: { image: { src: '/sample-wedding/closing.svg', alt: 'Us' } } } })
    const { wrapper } = await mountApp('/wedding/closing')
    api.failNext('POST /weddings/w1/assets', { status: 422, code: 'unsupported_image' })
    await choose(wrapper, new File([new Uint8Array(4)], 'x.png', { type: 'image/png' }))
    await flushPromises()
    expect(wrapper.get('[data-testid="upload-error"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="upload-error"]').text()).toContain('isn’t an image we can use')
    expect((wrapper.get('#f-image-src').element as HTMLInputElement).value).toBe('/sample-wedding/closing.svg')

    api.failNext('POST /weddings/w1/assets', { status: 0 })
    await choose(wrapper, new File([new Uint8Array(4)], 'x.png', { type: 'image/png' }))
    await flushPromises()
    expect(wrapper.get('[data-testid="upload-error"]').text()).toBe('Couldn’t upload the photo. Your previous image is kept.')
    expect((wrapper.get('#f-image-src').element as HTMLInputElement).value).toBe('/sample-wedding/closing.svg')
  })
})

describe('existing pages: v2 additions', () => {
  it('Opening: guest greeting toggle + label (kept when off)', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({ content: { opening: { weddingTitle: 'T' } } })
    const { wrapper } = await mountApp('/wedding/opening')
    expect(wrapper.get('[data-testid="guest-greeting"]').text()).toContain('?to=')
    await wrapper.get('#f-guestGreeting-enabled').setValue(true)
    await wrapper.get('#f-guestGreeting-label').setValue('Kepada Yth.')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening')[0]!.body).toEqual({ weddingTitle: 'T', guestGreeting: { enabled: true, label: 'Kepada Yth.' } })
    await wrapper.get('#f-guestGreeting-enabled').setValue(false)
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/opening').at(-1)!.body).toEqual({ weddingTitle: 'T', guestGreeting: { enabled: false, label: 'Kepada Yth.' } })
  })

  it('Closing: family acknowledgments keep line breaks', async () => {
    fakeTimers()
    const api = installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/closing')
    await wrapper.get('#f-familyAcknowledgments').setValue('Kel. Hadi\nKel. Sri')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/sections/closing')[0]!.body).toEqual({ familyAcknowledgments: 'Kel. Hadi\nKel. Sri' })
  })

  it('Events: dress code and livestream toggles (https only, data kept when off)', async () => {
    fakeTimers()
    const api = installFakeWeddingApi({
      content: { events: [{ id: 'e1', type: 'akad', title: 'Akad', livestream: { enabled: false, url: 'https://yt.example/live' } }] },
    })
    const { wrapper } = await mountApp('/wedding/events')
    await wrapper.get('[data-action="edit"]').trigger('click')
    await flushPromises()
    await wrapper.get('#ev-e1-dressCode-enabled').setValue(true)
    await wrapper.get('#ev-e1-dressCode-text').setValue('Batik')
    await wrapper.get('#ev-e1-livestream-enabled').setValue(true)
    await wrapper.get('#ev-e1-livestream-url').setValue('http://insecure.example')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/events/e1')).toHaveLength(0)
    expect(wrapper.text()).toContain('Enter a web address starting with https://')
    await wrapper.get('#ev-e1-livestream-url').setValue('https://yt.example/live')
    await autosave()
    expect(api.callsTo('PUT', '/weddings/w1/events/e1')[0]!.body).toMatchObject({
      dressCode: { enabled: true, text: 'Batik' },
      livestream: { enabled: true, url: 'https://yt.example/live' },
    })
  })

  it('RSVP shows the honest offline note', async () => {
    installFakeWeddingApi()
    const { wrapper } = await mountApp('/wedding/rsvp')
    expect(wrapper.get('[data-testid="rsvp-offline-note"]').text()).toContain('Guests can’t reply online yet')
  })
})
