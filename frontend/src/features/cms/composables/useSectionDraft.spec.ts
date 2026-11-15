import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useToast } from '@/composables/useToast'
import { useWeddingStore } from '@/stores/wedding'
import { installFakeWeddingApi } from '@/test/fakeWeddingApi'

import { closingForm, closingPayload } from '../forms'
import { validateClosing } from '../validation'
import { useSectionDraft } from './useSectionDraft'

enableAutoUnmount(afterEach)

async function setup(message = 'Saved message') {
  const api = installFakeWeddingApi({ content: { closing: { message } } })
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useWeddingStore()
  await store.ensureLoaded()
  let draft!: ReturnType<typeof make>
  const make = () =>
    useSectionDraft({
      key: 'closing',
      source: () => closingForm(store.content!.closing),
      toPayload: closingPayload,
      validate: validateClosing,
      save: async (payload) => void (await store.saveSection('closing', payload)),
      successMessage: () => 'Closing saved',
      failureMessage: () => 'Closing couldn’t be saved.',
    })
  const wrapper = mount(
    defineComponent({
      setup() {
        draft = make()
        return () => h('input', { id: 'f-message' })
      },
    }),
    { global: { plugins: [pinia] }, attachTo: document.body },
  )
  return { api, store, draft: () => draft, wrapper }
}

describe('useSectionDraft', () => {
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

  it('saves, toasts and adopts the server copy', async () => {
    const { store, draft, api } = await setup()
    const d = draft()
    d.form.value.message = '  Thank you  '
    await expect(d.save()).resolves.toBe(true)
    expect(api.callsTo('PUT', '/weddings/w1/sections/closing')[0]!.body).toEqual({ message: 'Thank you' })
    expect(store.content!.closing).toEqual({ message: 'Thank you' })
    expect(d.isDirty.value).toBe(false)
    expect(useToast().toasts.value.map((t) => t.message)).toContain('Closing saved')
  })

  it('blocks saving on format errors and maps server field errors inline', async () => {
    const { draft, api } = await setup()
    const d = draft()
    d.form.value.image.src = 'javascript:alert(1)'
    await expect(d.save()).resolves.toBe(false)
    expect(api.callsTo('PUT', '/weddings/w1/sections/closing')).toHaveLength(0)
    expect(d.errors.value['image.src']).toMatch(/image address/i)
    expect(d.errors.value['image.alt']).toMatch(/describe/i)

    d.form.value.image = { src: '', alt: '', focalPoint: null }
    d.form.value.message = 'Fine locally'
    api.failNext('PUT /weddings/w1/sections/closing', {
      status: 422,
      code: 'validation_error',
      details: [{ field: 'message', message: 'contains a forbidden word' }],
    })
    await expect(d.save()).resolves.toBe(false)
    expect(d.errors.value.message).toBe('Contains a forbidden word')
    expect(d.errorList.value[0]).toMatchObject({ field: 'message', id: 'f-message' })
    expect(d.isDirty.value).toBe(true) // edits are kept
    await flushPromises()
    expect(document.activeElement?.id).toBe('f-message')
    // One announcement only: field errors are explained inline, so no error toast.
    expect(useToast().toasts.value.filter((t) => t.tone === 'error')).toEqual([])
  })

  it('toasts non-field failures', async () => {
    const { draft, api } = await setup()
    const d = draft()
    d.form.value.message = 'New'
    api.failNext('PUT /weddings/w1/sections/closing', { status: 500, message: 'Server error.' })
    await expect(d.save()).resolves.toBe(false)
    expect(useToast().toasts.value.find((t) => t.tone === 'error')?.message).toBe('Closing couldn’t be saved. Server error.')
  })

  it('keeps edits and explains how to recover when the session expired (401)', async () => {
    const { draft, api, store } = await setup()
    const d = draft()
    d.form.value.message = 'Precious words'
    api.failNext('PUT /weddings/w1/sections/closing', { status: 401, code: 'not_authenticated', message: 'Not signed in' })
    await expect(d.save()).resolves.toBe(false)
    const msg = 'Your session has expired. Sign in again in another tab, then press Save again — your changes are still here.'
    expect(d.formError.value).toBe(msg)
    expect(useToast().toasts.value.find((t) => t.tone === 'error')?.message).toBe(msg)
    expect(d.form.value.message).toBe('Precious words')
    expect(d.isDirty.value).toBe(true)
    expect(store.content!.closing.message).toBe('Saved message')
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
  })
})
