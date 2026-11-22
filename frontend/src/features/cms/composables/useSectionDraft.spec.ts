import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useToast } from '@/composables/useToast'
import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi, type FakeApiOptions } from '@/test/fakeInvitationApi'

import { closingForm, closingPayload } from '../forms'
import { validateClosing } from '../validation'
import { useSectionDraft } from './useSectionDraft'

enableAutoUnmount(afterEach)

const PUT = 'PUT /invitations/w1/sections/closing'

async function setup(message = 'Saved message', apiOptions: FakeApiOptions = {}) {
  const api = installFakeInvitationApi({ content: { closing: { message } }, ...apiOptions })
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useInvitationStore()
  await store.ensureLoaded('w1')
  let draft!: ReturnType<typeof make>
  const make = () =>
    useSectionDraft({
      key: 'closing',
      source: () => closingForm(store.content!.closing),
      toPayload: closingPayload,
      validate: validateClosing,
      save: async (payload) => void (await store.saveSection('closing', payload)),
      live: (value) => ({ kind: 'section', section: 'closing', value }),
    })
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = make()
        return () => h('div', [h('input', { id: 'f-message' }), h('input', { id: 'f-image-src' }), h('input', { id: 'f-image-alt' })])
      },
    }),
    { global: { plugins: [pinia] }, attachTo: document.body },
  )
  const puts = () => api.callsTo('PUT', '/invitations/w1/sections/closing')
  return { api, store, draft: () => draft, wrapper, puts }
}

/** Let pending requests and Vue updates finish without moving the fake clock. */
const settle = () => flushPromises().then(flushPromises)

describe('useSectionDraft — working copy', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    useToast().clear()
    vi.restoreAllMocks()
  })

  it('edits a deep copy and tracks dirtiness in the store', async () => {
    const { store, draft } = await setup()
    const d = draft()
    expect(d.isDirty.value).toBe(false)
    d.form.value.message = 'New message'
    await flushPromises()
    expect(store.content!.closing.message).toBe('Saved message') // store untouched
    expect(d.isDirty.value).toBe(true)
    expect(store.isSectionDirty('closing')).toBe(true)

    // Whitespace-only differences normalise away.
    d.form.value.message = 'Saved message  '
    await flushPromises()
    expect(d.isDirty.value).toBe(false)

    d.form.value.image.src = '/sample-wedding/closing.svg'
    await flushPromises()
    expect(d.isDirty.value).toBe(true)
  })

  it('publishes the working copy to the live preview synchronously (and only while dirty)', async () => {
    const { store, draft } = await setup()
    const d = draft()
    const savedContent = store.content
    d.form.value.message = 'Typed, not saved'
    // No await: the preview follows the keystroke immediately.
    expect(store.livePreviewContent!.closing.message).toBe('Typed, not saved')
    expect(store.previewContent!.closing.message).toBe('Saved message')
    expect(store.content).toBe(savedContent) // the saved copy is never touched

    // Image URLs reflect live; unsafe ones never reach the preview.
    d.form.value.image = { src: 'https://example.com/a.jpg', alt: 'Us', focalPoint: null }
    expect(store.livePreviewContent!.closing.image).toEqual({ src: 'https://example.com/a.jpg', alt: 'Us' })
    d.form.value.image.src = 'javascript:alert(1)'
    expect(store.livePreviewContent!.closing.image).toBeUndefined()

    d.form.value = closingForm(store.content!.closing)
    expect(store.livePreviewContent!.closing.message).toBe('Saved message')
    expect(store.livePreviewMissing).toEqual(store.previewMissing)
  })

  it('discard returns to the saved state and clears the dirty flag', async () => {
    const { store, draft } = await setup()
    const d = draft()
    d.form.value.thankYou = 'Love'
    await flushPromises()
    d.discard()
    await flushPromises()
    expect(d.form.value.thankYou).toBe('')
    expect(d.isDirty.value).toBe(false)
    expect(store.anyDirty).toBe(false)
  })

  it('does not throw when the wedding is cleared (sign-out)', async () => {
    const { store, draft } = await setup()
    const d = draft()
    d.form.value.message = 'x'
    await flushPromises()
    store.reset()
    await flushPromises()
    expect(store.content).toBeNull()
    expect(store.anyDirty).toBe(false)
    expect(store.livePreviewContent).toBeNull()
    d.discard()
    expect(d.form.value.message).toBe('Saved message')
  })

  it('unregisters from the store when unmounted', async () => {
    const { store, draft, wrapper } = await setup()
    draft().form.value.message = 'x'
    await flushPromises()
    expect(store.anyDirty).toBe(true)
    wrapper.unmount()
    expect(store.anyDirty).toBe(false)
    expect(store.livePreviewContent!.closing.message).toBe('Saved message')
  })
})

describe('useSectionDraft — autosave', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    useToast().clear()
    vi.restoreAllMocks()
  })

  it('saves once, 1000 ms after the last change, without a toast', async () => {
    const { draft, puts, store, api } = await setup()
    const d = draft()
    d.form.value.message = 'T'
    await vi.advanceTimersByTimeAsync(600)
    d.form.value.message = 'Thank you  '
    expect(store.saveState).toBe('unsaved')
    await vi.advanceTimersByTimeAsync(999)
    expect(puts()).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(puts()).toHaveLength(1)
    expect(puts()[0]!.body).toEqual({ message: 'Thank you' })
    expect(api.state.content.closing).toEqual({ message: 'Thank you' })
    expect(store.content!.closing).toEqual({ message: 'Thank you' })
    expect(d.isDirty.value).toBe(false)
    expect(d.form.value.message).toBe('Thank you') // adopted the normalised copy
    expect(store.saveState).toBe('saved')
    expect(useToast().toasts.value).toEqual([])
    await vi.advanceTimersByTimeAsync(10_000)
    expect(puts()).toHaveLength(1)
  })

  it('sends If-Match with the current revision and adopts each new ETag', async () => {
    const { draft, puts, store } = await setup('Saved', { revision: 7 })
    expect(store.revision).toBe(7)
    draft().form.value.message = 'One'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    draft().form.value.message = 'Two'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts().map((c) => c.ifMatch)).toEqual(['"7"', '"8"'])
    expect(store.revision).toBe(9)
  })

  it('does not save invalid edits; shows the errors instead', async () => {
    const { draft, puts, store } = await setup()
    const d = draft()
    d.form.value.image.src = 'javascript:alert(1)'
    await vi.advanceTimersByTimeAsync(5000)
    await settle()
    expect(puts()).toHaveLength(0)
    expect(d.errors.value['image.src']).toMatch(/image address/i)
    expect(d.errors.value['image.alt']).toMatch(/describe/i)
    // Not a reassuring "Unsaved": the status says the fields need attention (announced once).
    expect(store.saveState).toBe('invalid')
    expect(store.announcement?.kind).toBe('invalid')
    expect(document.activeElement?.id).not.toBe('f-image-src') // autosave never moves focus

    d.form.value.image = { src: '', alt: '', focalPoint: null }
    d.form.value.message = 'Fixed'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.saveState).toBe('saved')
  })

  it('maps server 422 field errors inline and keeps the edits', async () => {
    const { draft, api, store } = await setup()
    const d = draft()
    api.failNext(PUT, { status: 422, code: 'validation_error', details: [{ field: 'message', message: 'contains a forbidden word' }] })
    d.form.value.message = 'Fine locally'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(d.errors.value.message).toBe('Contains a forbidden word')
    expect(d.errorList.value[0]).toMatchObject({ field: 'message', id: 'f-message' })
    expect(d.isDirty.value).toBe(true)
    expect(store.saveState).toBe('failed')
    expect(useToast().toasts.value).toEqual([])
  })

  it('keeps local edits on failure, retries after 2 s, 5 s, 10 s, then is Failed until Retry', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    api.failNext(PUT, { status: 500, message: 'Server error.' }, 4)
    d.form.value.message = 'Precious words'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.saveState).toBe('saving') // retrying
    await vi.advanceTimersByTimeAsync(1999)
    expect(puts()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await settle()
    expect(puts()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(5000)
    await settle()
    expect(puts()).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(10_000)
    await settle()
    expect(puts()).toHaveLength(4)
    expect(store.saveState).toBe('failed')
    expect(store.announcement?.kind).toBe('failed')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(puts()).toHaveLength(4) // no more automatic attempts
    expect(d.form.value.message).toBe('Precious words')
    expect(d.isDirty.value).toBe(true)
    expect(store.content!.closing.message).toBe('Saved message')
    expect(store.livePreviewContent!.closing.message).toBe('Precious words')

    await expect(store.retry()).resolves.toBe(true)
    expect(puts()).toHaveLength(5)
    expect(store.saveState).toBe('saved')
    expect(store.announcement?.kind).toBe('saved')
  })

  it('coalesces edits made during a save into exactly one follow-up save of the newest form', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    d.form.value.message = 'A'
    api.holdResponses()
    await vi.advanceTimersByTimeAsync(1000)
    expect(puts()).toHaveLength(1) // in flight
    d.form.value.message = 'AB'
    await vi.advanceTimersByTimeAsync(1000) // debounce fires while the first save is still in flight
    d.form.value.message = 'ABC'
    await vi.advanceTimersByTimeAsync(1000)
    expect(puts()).toHaveLength(1) // one request in flight per key
    expect(store.saveState).toBe('saving')

    api.release()
    await settle()
    // Exactly one follow-up, with the newest form; the older response never overwrote the edits.
    expect(puts().map((c) => c.body)).toEqual([{ message: 'A' }, { message: 'ABC' }])
    await settle()
    expect(d.form.value.message).toBe('ABC')
    expect(store.content!.closing.message).toBe('ABC')
    expect(store.saveState).toBe('saved')
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(2)
  })

  it('a finished save for an older payload does not overwrite newer edits (sequence check)', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    d.form.value.message = 'Old'
    api.holdResponses()
    await vi.advanceTimersByTimeAsync(1000)
    d.form.value.message = 'Newer' // typed while saving; debounce still pending
    api.release()
    await settle()
    expect(d.form.value.message).toBe('Newer')
    expect(store.livePreviewContent!.closing.message).toBe('Newer')
    expect(d.isDirty.value).toBe(true)
    expect(puts()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts().map((c) => (c.body as { message: string }).message)).toEqual(['Old', 'Newer'])
    expect(store.saveState).toBe('saved')
  })

  it('Save now flushes immediately, without waiting for the debounce', async () => {
    const { draft, puts, store } = await setup()
    draft().form.value.message = 'Now'
    await expect(store.saveNow({ announce: true })).resolves.toBe(true)
    expect(puts()).toHaveLength(1)
    expect(store.announcement?.kind).toBe('saved')
    await vi.advanceTimersByTimeAsync(2000)
    expect(puts()).toHaveLength(1)
  })

  it('manual save focuses the first invalid field', async () => {
    const { draft, puts } = await setup()
    const d = draft()
    d.form.value.image.src = 'javascript:alert(1)'
    await expect(d.save()).resolves.toBe(false)
    await flushPromises()
    expect(puts()).toHaveLength(0)
    expect(document.activeElement?.id).toBe('f-image-src')
  })

  it('409 edit_conflict → Conflict: autosave pauses and local edits are kept', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    api.editElsewhere((c) => (c.closing = { message: 'From the other phone' }))
    d.form.value.message = 'Mine'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.saveState).toBe('conflict')
    expect(store.conflict).toEqual({ currentRevision: 2 })
    expect(store.announcement?.kind).toBe('conflict')
    expect(api.state.content.closing.message).toBe('From the other phone') // nothing written
    d.form.value.message = 'Mine, edited more'
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(1)
    expect(d.form.value.message).toBe('Mine, edited more')
  })

  it('Keep mine adopts the current revision and re-saves the local working copy', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    api.editElsewhere((c) => (c.closing = { message: 'Theirs' }))
    d.form.value.message = 'Mine'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(store.saveState).toBe('conflict')
    await expect(store.keepMine({ confirm: false })).resolves.toBe(true)
    expect(puts()).toHaveLength(2)
    expect(puts()[1]!.ifMatch).toBe('"2"')
    expect(api.state.content.closing.message).toBe('Mine')
    expect(store.saveState).toBe('saved')
    expect(d.isDirty.value).toBe(false)
  })

  it('Reload latest re-fetches content and revision and drops the local working copy', async () => {
    const { draft, api, puts, store } = await setup()
    const d = draft()
    api.editElsewhere((c) => (c.closing = { message: 'Theirs' }))
    d.form.value.message = 'Mine'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    await expect(store.reloadLatest({ confirm: false })).resolves.toBe(true)
    expect(store.content!.closing.message).toBe('Theirs')
    expect(store.revision).toBe(2)
    expect(d.form.value.message).toBe('Theirs')
    expect(d.isDirty.value).toBe(false)
    expect(store.saveState).toBe('saved')
    expect(store.livePreviewContent!.closing.message).toBe('Theirs')
    // Autosave works again, with the new revision.
    d.form.value.message = 'After reload'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts().at(-1)).toMatchObject({ ifMatch: '"2"', body: { message: 'After reload' } })
    expect(store.saveState).toBe('saved')
  })

  it('offline → Offline (no request), then saves as soon as the connection is back', async () => {
    const { draft, puts, store } = await setup()
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    draft().form.value.message = 'Written on the train'
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts()).toHaveLength(0)
    expect(store.saveState).toBe('offline')
    expect(store.announcement?.kind).toBe('offline')

    onLine.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.saveState).toBe('saved')
  })

  it('a network error while "online" shows Offline and keeps retrying', async () => {
    const { draft, api, puts, store } = await setup()
    api.setOffline(true)
    draft().form.value.message = 'Flaky wifi'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.saveState).toBe('offline')
    api.setOffline(false)
    await vi.advanceTimersByTimeAsync(2000)
    await settle()
    expect(puts()).toHaveLength(2)
    expect(store.saveState).toBe('saved')
    expect(api.state.content.closing.message).toBe('Flaky wifi')
  })

  it('keeps edits and explains how to recover when the session expired (401)', async () => {
    const { draft, api, store } = await setup()
    const d = draft()
    api.failNext(PUT, { status: 401, code: 'not_authenticated', message: 'Not signed in' })
    d.form.value.message = 'Precious words'
    await vi.advanceTimersByTimeAsync(1000)
    await settle()
    expect(d.formError.value).toBe(
      'Your session has expired. Sign in again in another tab, then press Retry — your changes are still here.',
    )
    expect(store.saveState).toBe('failed')
    expect(d.form.value.message).toBe('Precious words')
    expect(store.content!.closing.message).toBe('Saved message')
  })

  it('saves pending edits when the editor goes away mid-debounce', async () => {
    const { draft, wrapper, puts, store } = await setup()
    draft().form.value.message = 'Closed quickly'
    wrapper.unmount()
    await settle()
    expect(puts()).toHaveLength(1)
    expect(store.content!.closing.message).toBe('Closed quickly')
  })
})
