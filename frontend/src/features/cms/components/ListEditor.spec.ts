import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { useToast } from '@/composables/useToast'
import { mockMatchMedia } from '@/test/matchMedia'

import ListEditor from './ListEditor.vue'

enableAutoUnmount(afterEach)

interface Item {
  id: string
  title: string
}

function setup(
  initial: Item[] = [{ id: 'a', title: 'Akad' }, { id: 'b', title: 'Resepsi' }, { id: 'c', title: 'Ngunduh' }],
  max?: number,
) {
  const items = ref<Item[]>(initial)
  const reorder = vi.fn(async (ids: string[]) => {
    items.value = ids.map((id) => items.value.find((i) => i.id === id)!)
  })
  const remove = vi.fn(async (item: Item) => {
    items.value = items.value.filter((i) => i.id !== item.id)
  })
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(
          ListEditor<Item>,
          {
            items: items.value,
            itemName: (i: Item) => i.title,
            addLabel: 'Add an event',
            emptyTitle: 'No events yet',
            listLabel: 'Events',
            reorder,
            remove,
            max,
          },
          {
            summary: ({ item }: { item: Item }) => h('h3', item.title),
            editor: ({ item, close }: { item: Item; close: () => void }) => h('button', { 'data-close': item.id, onClick: close }, 'done'),
            create: ({ close }: { close: () => void }) =>
              h('form', [
                h('input', { id: 'create-first', 'aria-label': 'Title' }),
                h('button', { type: 'button', 'data-create-save': '', onClick: () => (items.value = [...items.value, { id: 'new', title: 'Baru' }], close()) }, 'save'),
                h('button', { type: 'button', 'data-create-close': '', onClick: close }, 'cancel'),
              ]),
          },
        ),
    }),
    { attachTo: document.body },
  )
  return { wrapper, items, reorder, remove }
}

const titles = (w: ReturnType<typeof mount>) => w.findAll('li[data-item] h3').map((x) => x.text())

describe('ListEditor + ReorderButtons', () => {
  afterEach(() => useToast().clear())

  it('labels move buttons with the item name and disables them at the ends', () => {
    const { wrapper } = setup()
    const up = wrapper.get('[data-reorder="a-up"]')
    expect(up.attributes('aria-label')).toBe('Move Akad up')
    expect(up.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-reorder="c-down"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-reorder="b-up"]').attributes('disabled')).toBeUndefined()
  })

  it('moves an item, announces the new position and keeps focus on the control', async () => {
    const { wrapper, reorder } = setup()
    const down = wrapper.get('[data-reorder="a-down"]')
    ;(down.element as HTMLButtonElement).focus()
    await down.trigger('click')
    await flushPromises()
    expect(reorder).toHaveBeenCalledWith(['b', 'a', 'c'])
    expect(titles(wrapper)).toEqual(['Resepsi', 'Akad', 'Ngunduh'])
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('Moved to position 2 of 3')
    expect(wrapper.get('[data-testid="list-live"]').attributes('aria-live')).toBe('polite')
    expect(document.activeElement).toBe(wrapper.get('[data-reorder="a-down"]').element)

    // Moving to the end disables "down", so focus moves to "up" on the same item.
    await wrapper.get('[data-reorder="a-down"]').trigger('click')
    await flushPromises()
    expect(titles(wrapper)).toEqual(['Resepsi', 'Ngunduh', 'Akad'])
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('Moved to position 3 of 3')
    expect(document.activeElement).toBe(wrapper.get('[data-reorder="a-up"]').element)
  })

  it('deletes only after confirmation', async () => {
    const { wrapper, remove } = setup()
    const del = wrapper.findAll('[data-action="delete"]')[1]!
    expect(del.attributes('aria-label')).toBe('Delete: Resepsi')
    await del.trigger('click')
    await flushPromises()
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('open')).toBeDefined()
    expect(dialog.text()).toContain('Delete “Resepsi”?')

    await dialog.get('[data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()

    await del.trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(remove).toHaveBeenCalledWith({ id: 'b', title: 'Resepsi' })
    expect(titles(wrapper)).toEqual(['Akad', 'Ngunduh'])
    // Exactly one announcement: the toast. The list's live region stays quiet.
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('')
    expect(useToast().toasts.value.map((x) => x.message)).toEqual(['“Resepsi” deleted'])
    // Focus moves to the next item.
    expect(document.activeElement).toBe(wrapper.findAll('[data-action="edit"]')[1]!.element)
  })

  it('after deleting the last item, focus goes to the add button', async () => {
    const { wrapper } = setup([{ id: 'a', title: 'Akad' }])
    await wrapper.get('[data-action="delete"]').trigger('click')
    await flushPromises()
    await wrapper.get('dialog [data-action="confirm"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-action="add"]').element)
  })

  it('a move is announced once, in the list live region only (no toast)', async () => {
    const { wrapper } = setup()
    await wrapper.get('[data-reorder="a-down"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('Moved to position 2 of 3')
    expect(useToast().toasts.value).toHaveLength(0)
  })

  it('shows the empty state and the add form; focus goes into the form and back to Add on cancel', async () => {
    const { wrapper } = setup([])
    expect(wrapper.text()).toContain('No events yet')
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-create-close]').exists()).toBe(true)
    expect(document.activeElement?.id).toBe('create-first')
    await wrapper.get('[data-create-close]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-create-close]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-action="add"]').element)
  })

  it('after creating, focus goes to the new item', async () => {
    const { wrapper } = setup([{ id: 'a', title: 'Akad' }])
    await wrapper.get('[data-action="add"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-create-save]').trigger('click')
    await flushPromises()
    const edit = wrapper.get('li[data-item="new"] [data-action="edit"]')
    expect(document.activeElement).toBe(edit.element)
  })

  it('never disables Add: at the limit it explains instead of opening the form', async () => {
    const { wrapper } = setup([{ id: 'a', title: 'Akad' }], 1)
    const add = wrapper.get('[data-action="add"]')
    expect(add.attributes('disabled')).toBeUndefined()
    expect(add.attributes('aria-disabled')).toBeUndefined()
    ;(add.element as HTMLButtonElement).focus()
    await add.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-create-close]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="limit-error"]').text()).toBe('You’ve reached the limit of 1.')
    expect(add.attributes('aria-describedby')).toBe(wrapper.get('[data-testid="limit-error"]').attributes('id'))
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('You’ve reached the limit of 1.')
    expect(document.activeElement).toBe(add.element)
  })

  it('opens one inline editor at a time', async () => {
    const { wrapper } = setup()
    const edits = wrapper.findAll('[data-action="edit"]')
    await edits[0]!.trigger('click')
    await flushPromises()
    expect(edits[0]!.attributes('aria-expanded')).toBe('true')
    // Focus moves into the opened editor.
    expect(document.activeElement).toBe(wrapper.get('[data-close="a"]').element)
    await edits[1]!.trigger('click')
    expect(wrapper.find('[data-close="a"]').exists()).toBe(false)
    expect(wrapper.find('[data-close="b"]').exists()).toBe(true)
  })
})

describe('ListEditor on phones (overflow menu)', () => {
  let restore: () => void
  beforeEach(() => (restore = mockMatchMedia({ '(max-width: 639px)': true })))
  afterEach(() => {
    restore()
    useToast().clear()
  })

  const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

  it('keeps Edit visible and moves the other actions into an accessible menu', async () => {
    const { wrapper } = setup()
    await flushPromises()
    expect(wrapper.find('[data-reorder]').exists()).toBe(false)
    expect(wrapper.find('[data-action="delete"]').exists()).toBe(false)
    const item = wrapper.get('li[data-item="b"]')
    expect(item.get('[data-action="edit"]').text()).toBe('Edit')
    const more = item.get('[data-action="more"]')
    expect(more.attributes('aria-label')).toBe('More actions: Resepsi')
    expect(more.attributes('aria-haspopup')).toBe('menu')
    expect(more.attributes('aria-expanded')).toBe('false')

    await more.trigger('click')
    await flushPromises()
    const menu = item.get('[role="menu"]')
    expect(more.attributes('aria-expanded')).toBe('true')
    expect(more.attributes('aria-controls')).toBe(menu.attributes('id'))
    const entries = menu.findAll('[role="menuitem"]')
    expect(entries.map((e) => e.text())).toEqual(['Move Resepsi up', 'Move Resepsi down', 'Delete'])
    expect(document.activeElement).toBe(entries[0]!.element)

    key(document.activeElement!, 'ArrowDown')
    expect(document.activeElement).toBe(entries[1]!.element)
    key(document.activeElement!, 'End')
    expect(document.activeElement).toBe(entries[2]!.element)
    key(document.activeElement!, 'ArrowDown') // wraps
    expect(document.activeElement).toBe(entries[0]!.element)
    key(document.activeElement!, 'ArrowUp')
    expect(document.activeElement).toBe(entries[2]!.element)

    key(document.activeElement!, 'Escape')
    await flushPromises()
    expect(item.find('[role="menu"]').exists()).toBe(false)
    expect(more.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(more.element)
  })

  it('omits impossible moves and keeps focus on the menu button after a move', async () => {
    const { wrapper, reorder } = setup()
    await flushPromises()
    const first = wrapper.get('li[data-item="a"] [data-action="more"]')
    // ArrowDown on the button opens the menu.
    key(first.element, 'ArrowDown')
    await flushPromises()
    const entries = wrapper.findAll('li[data-item="a"] [role="menuitem"]')
    expect(entries.map((e) => e.text())).toEqual(['Move Akad down', 'Delete'])
    await entries[0]!.trigger('click')
    await flushPromises()
    expect(reorder).toHaveBeenCalledWith(['b', 'a', 'c'])
    expect(wrapper.get('[data-testid="list-live"]').text()).toBe('Moved to position 2 of 3')
    expect(document.activeElement).toBe(wrapper.get('li[data-item="a"] [data-action="more"]').element)
  })

  it('deletes from the menu with confirmation; cancel returns focus to the menu button', async () => {
    const { wrapper, remove } = setup()
    await flushPromises()
    const more = wrapper.get('li[data-item="b"] [data-action="more"]')
    await more.trigger('click')
    await flushPromises()
    await wrapper.get('li[data-item="b"] [data-menu-action="delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').text()).toContain('Delete “Resepsi”?')
    await wrapper.get('dialog [data-action="cancel"]').trigger('click')
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(more.element)
  })
})
