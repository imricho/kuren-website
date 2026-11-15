import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import ConfirmDialog from './ConfirmDialog.vue'

enableAutoUnmount(afterEach)

const Harness = defineComponent({
  setup() {
    const open = ref(false)
    const result = ref('')
    return () => [
      h('button', { id: 'opener', onClick: () => (open.value = true) }, 'Delete'),
      h('p', { id: 'result' }, result.value),
      h(ConfirmDialog, {
        open: open.value,
        title: 'Delete “Akad”?',
        message: 'This can’t be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
        onConfirm: () => ((open.value = false), (result.value = 'confirmed')),
        onCancel: () => ((open.value = false), (result.value = 'cancelled')),
      }),
    ]
  },
})

describe('ConfirmDialog', () => {
  it('opens as a labelled dialog, focuses Cancel, and returns focus on close', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    const opener = wrapper.find('#opener')
    ;(opener.element as HTMLButtonElement).focus()
    await opener.trigger('click')
    await nextTick()
    await nextTick()
    const dialog = wrapper.find('dialog')
    expect(dialog.attributes('open')).toBeDefined()
    expect(dialog.attributes('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(dialog.attributes('aria-labelledby')!)?.textContent).toBe('Delete “Akad”?')
    expect(document.activeElement).toBe(wrapper.find('[data-action="cancel"]').element)

    await wrapper.find('[data-action="confirm"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(wrapper.find('#result').text()).toBe('confirmed')
    expect(dialog.attributes('open')).toBeUndefined()
    expect(document.activeElement).toBe(opener.element)
  })

  it('Escape (cancel event) cancels', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.find('#opener').trigger('click')
    await nextTick()
    await wrapper.find('dialog').trigger('cancel')
    expect(wrapper.find('#result').text()).toBe('cancelled')
  })
})
