/**
 * Live split-screen editor layout (docs/ux/live-editor.md). The store is seeded
 * directly, so these tests cover the layout regardless of the API transport.
 */
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { RouterView } from 'vue-router'

import ConfirmHost from '@/features/cms/components/ConfirmHost.vue'
import { EDITOR_WIDTH_STORAGE_KEY } from '@/features/cms/preview/editorWidth'
import { emptyDraft, normalizeDraft, type WeddingDraft } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'
import { installFakeInvitationApi } from '@/test/fakeInvitationApi'
import { mockMatchMedia } from '@/test/matchMedia'
import { createTestRouter } from '@/test/mountApp'

enableAutoUnmount(afterEach)

const restores: (() => void)[] = []
beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn() as never
  installFakeInvitationApi()
})
afterEach(() => {
  while (restores.length) restores.pop()!()
  vi.restoreAllMocks()
})

function draft(content: Partial<WeddingDraft> = {}): WeddingDraft {
  return normalizeDraft({ ...emptyDraft(), ...structuredClone(content) })
}

async function mountEditor(path: string, opts: { desktop?: boolean; themeId?: string | null; content?: Partial<WeddingDraft> } = {}) {
  if (opts.desktop) restores.push(mockMatchMedia({ '(min-width: 1024px)': true }))
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useInvitationStore()
  store.$patch({
    record: {
      id: 'w1',
      themeId: opts.themeId === undefined ? 'international' : opts.themeId,
      locale: 'en',
      status: 'draft',
      publishedAt: null,
      revision: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as never,
    content: draft(opts.content) as never,
    loadState: 'ready',
  })
  const router = createTestRouter()
  await router.push(path)
  await router.isReady()
  const Root = defineComponent({ render: () => [h(RouterView), h(ConfirmHost)] })
  const wrapper = mount(Root, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.find('.wedding-site article, .wedding-site > *:not(.wedding-site__loading)').exists()).toBe(true))
  return { wrapper, router, store }
}

describe('live editor: desktop split', () => {
  it('renders the editor panel, divider and preview with the selected theme', async () => {
    const { wrapper } = await mountEditor('/wedding/opening', { desktop: true, themeId: 'ethnic' })
    const layout = wrapper.get('[data-testid="editor-layout"]')
    expect(layout.attributes('data-mode')).toBe('split')
    expect((layout.element as HTMLElement).style.getPropertyValue('--editor-w')).toBe('40%')
    const editor = wrapper.get('#editor-panel')
    expect(editor.attributes('aria-label')).toBe('Editor')
    expect(editor.find('[data-testid="save-status"]').exists()).toBe(true)
    expect(editor.get('[data-testid="sections-done"]').text()).toMatch(/^\d+ of \d+ done$/)
    expect(editor.find('[data-testid="opening-form"]').exists()).toBe(true)
    // No 16rem column, completion meter card or "Preview website" chip any more.
    const nav = editor.get('[data-testid="section-nav"]')
    // Chips show the active group only (Our Wedding on the Opening page).
    expect(nav.findAll('a[data-section]').map((a) => a.attributes('data-section'))).toEqual(['opening', 'holyRecite1', 'greeting', 'couple', 'weddingDate'])
    expect(nav.find('a[data-section="preview"]').exists()).toBe(false)
    expect(nav.find('progress').exists()).toBe(false)
    // No mobile Edit/Preview tabs on desktop (the nav's own group tabs are separate).
    expect(wrapper.find('[data-testid="editor-tabs"]').exists()).toBe(false)
    // Compact publish status + action in the header row.
    expect(editor.get('[data-testid="publish-chip"]').attributes('data-state')).toBe('draft')
    expect(editor.get('[data-testid="publish-chip"] a[data-action="open-publish"]').attributes('href')).toBe('/invitations/w1/edit/publish')

    const preview = wrapper.get('#preview-panel')
    expect(preview.attributes('aria-label')).toBe('Live preview')
    expect(preview.get('.wedding-site').attributes('data-theme')).toBe('ethnic')
    expect(preview.get('[data-testid="preview-theme-name"]').text()).toBe('Woven Indigo')
    expect(preview.get('[data-testid="preview-fullscreen"]').attributes('href')).toBe('/invitations/w1/preview?from=/invitations/w1/edit/opening')
    expect(preview.findAll('[data-testid="preview-device"] input[type="radio"]')).toHaveLength(2)
    expect(preview.get('[data-testid="preview-device"]').attributes('role')).toBe('radiogroup')
    expect(preview.find('[data-testid="preview-no-theme"]').exists()).toBe(false)
    // The editor keeps the only level-1 heading.
    const level1 = wrapper.findAll('h1').filter((el) => el.attributes('aria-level') === undefined)
    expect(level1).toHaveLength(1)
    expect(level1[0]!.element.closest('#editor-panel')).not.toBeNull()
  })

  it('updates the preview from store.livePreviewContent without remounting the theme', async () => {
    const { wrapper, store } = await mountEditor('/wedding/closing', { desktop: true, content: { closing: { message: 'First words' } } })
    const site = wrapper.get('#preview-panel .wedding-site').element
    const article = site.firstElementChild
    expect(site.textContent).toContain('First words')
    store.content = draft({ closing: { message: 'Second words' } }) as never
    await nextTick()
    await flushPromises()
    expect(store.livePreviewContent?.closing.message).toBe('Second words')
    const after = wrapper.get('#preview-panel .wedding-site').element
    expect(after).toBe(site)
    expect(after.firstElementChild).toBe(article)
    expect(after.textContent).toContain('Second words')
  })

  it('keeps the theme mounted and scrolls the frame to the section on route change, without moving focus', async () => {
    const { wrapper, router } = await mountEditor('/wedding/opening', { desktop: true })
    const site = wrapper.get('#preview-panel .wedding-site').element
    const scroller = wrapper.get('[data-testid="preview-frame"]').element as HTMLElement
    const scrollTo = vi.fn()
    scroller.scrollTo = scrollTo as never
    const focusedBefore = document.activeElement
    await router.push('/wedding/couple')
    await flushPromises()
    expect(wrapper.get('#preview-panel .wedding-site').element).toBe(site)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.calls[0]![0]).toMatchObject({ top: expect.any(Number) })
    expect(scroller.querySelector('[data-section="couple"]')).not.toBeNull()
    expect(document.activeElement).toBe(focusedBefore)
    expect(scroller.contains(document.activeElement)).toBe(false)
  })

  it('resizes the editor with the keyboard and remembers the width', async () => {
    const { wrapper } = await mountEditor('/wedding/opening', { desktop: true })
    const sep = wrapper.get('[role="separator"]')
    expect(sep.attributes('aria-controls')).toBe('editor-panel')
    await sep.trigger('keydown', { key: 'ArrowRight' })
    expect(sep.attributes('aria-valuenow')).toBe('42')
    expect((wrapper.get('[data-testid="editor-layout"]').element as HTMLElement).style.getPropertyValue('--editor-w')).toBe('42%')
    expect(localStorage.getItem(EDITOR_WIDTH_STORAGE_KEY)).toBe('42')
  })

  it('starts at the remembered width and survives broken storage', async () => {
    localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, '50')
    const { wrapper } = await mountEditor('/wedding/opening', { desktop: true })
    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('50')
    wrapper.unmount()
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied')
    })
    const second = await mountEditor('/wedding/opening', { desktop: true })
    const sep = second.wrapper.get('[role="separator"]')
    expect(sep.attributes('aria-valuenow')).toBe('40')
    await sep.trigger('keydown', { key: 'End' })
    expect(sep.attributes('aria-valuenow')).toBe('55')
  })

  it('renders the default theme with a note when no theme is chosen', async () => {
    const { wrapper } = await mountEditor('/wedding/opening', { desktop: true, themeId: null })
    expect(wrapper.get('#preview-panel .wedding-site').attributes('data-theme')).toBe('international')
    const note = wrapper.get('[data-testid="preview-no-theme"]')
    expect(note.attributes('role')).toBe('note')
    expect(note.text()).toContain('No theme chosen yet — showing Editorial Ivory.')
    expect(note.get('a').attributes('href')).toBe('/themes')
  })
})

describe('live editor: mobile tabs', () => {
  it('switches Edit/Preview with arrow keys, keeps both panes mounted and focus on the tab', async () => {
    const { wrapper } = await mountEditor('/wedding/opening')
    expect(wrapper.get('[data-testid="editor-layout"]').attributes('data-mode')).toBe('tabs')
    expect(wrapper.find('[role="separator"]').exists()).toBe(false)
    const tablist = wrapper.get('[data-testid="editor-tabs"] [role="tablist"]')
    expect(tablist.attributes('aria-label')).toBe('Editor view')
    // Save status sits in the tab bar, visible on both tabs.
    expect(wrapper.get('[data-testid="editor-tabs"]').find('[data-testid="save-status"]').exists()).toBe(true)
    // So does the compact publish chip/button.
    expect(wrapper.get('[data-testid="editor-tabs"] [data-testid="publish-chip"] a').attributes('href')).toBe('/invitations/w1/edit/publish')
    const edit = () => wrapper.get('#editor-tab-edit')
    const prev = () => wrapper.get('#editor-tab-preview')
    const editPanel = () => wrapper.get('#editor-panel')
    const previewPanel = () => wrapper.get('#preview-panel')
    expect(edit().attributes()).toMatchObject({ role: 'tab', 'aria-selected': 'true', tabindex: '0', 'aria-controls': 'editor-panel' })
    expect(prev().attributes()).toMatchObject({ 'aria-selected': 'false', tabindex: '-1' })
    expect(editPanel().attributes()).toMatchObject({ role: 'tabpanel', 'aria-labelledby': 'editor-tab-edit' })
    expect(previewPanel().isVisible()).toBe(false)

    ;(edit().element as HTMLElement).focus()
    await edit().trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(prev().attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(prev().element)
    expect(previewPanel().isVisible()).toBe(true)
    expect(editPanel().isVisible()).toBe(false)
    // Both stay mounted.
    expect(wrapper.find('[data-testid="opening-form"]').exists()).toBe(true)
    expect(wrapper.find('#preview-panel .wedding-site').exists()).toBe(true)
    // Mobile preview: phone only, no device toggle, icon-only Full screen with a name.
    expect(previewPanel().find('[data-testid="preview-device"]').exists()).toBe(false)
    expect(previewPanel().get('[data-testid="preview-fullscreen"]').attributes('aria-label')).toBe('Full screen')
    expect(previewPanel().get('[data-testid="preview-frame"]').attributes('data-device')).toBe('phone')

    await prev().trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(edit().attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(edit().element)
    await edit().trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(prev().attributes('aria-selected')).toBe('true')
    await prev().trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(edit().attributes('aria-selected')).toBe('true')
  })

  it('applies a section chosen while the preview is hidden once it is shown', async () => {
    const { wrapper, router } = await mountEditor('/wedding/opening')
    const scroller = wrapper.get('[data-testid="preview-frame"]').element as HTMLElement
    const scrollTo = vi.fn()
    scroller.scrollTo = scrollTo as never
    await router.push('/wedding/closing')
    await flushPromises()
    expect(scrollTo).not.toHaveBeenCalled()
    await wrapper.get('#editor-tab-preview').trigger('click')
    await flushPromises()
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })
})
