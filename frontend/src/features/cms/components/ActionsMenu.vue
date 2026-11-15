<script setup lang="ts">
/**
 * Overflow ("More actions") menu button, following the WAI-ARIA menu button
 * pattern: aria-haspopup/aria-expanded on the trigger, role="menu" items,
 * ArrowUp/ArrowDown/Home/End to move, Escape to close (focus returns to the
 * trigger), Tab or a click outside closes it. Choosing an item closes the menu,
 * returns focus to the trigger, then emits `select`.
 */
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'

export interface MenuAction {
  key: string
  label: string
  tone?: 'danger'
}

const props = defineProps<{
  /** Accessible name of the trigger, e.g. "More actions: Resepsi". */
  label: string
  items: readonly MenuAction[]
  triggerId?: string
  busy?: boolean
}>()
const emit = defineEmits<{ select: [key: string] }>()

const uid = useId()
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

const menuItems = () => [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

function focusItem(index: number) {
  const items = menuItems()
  if (!items.length) return
  items[(index + items.length) % items.length]!.focus()
}

async function show(focusIndex = 0) {
  open.value = true
  document.addEventListener('pointerdown', onOutside, true)
  await nextTick()
  focusItem(focusIndex)
}

function hide(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onOutside, true)
  if (returnFocus) trigger.value?.focus()
}

function onOutside(event: Event) {
  const target = event.target as Node | null
  if (target && (menu.value?.contains(target) || trigger.value?.contains(target))) return
  hide(false)
}

function toggle() {
  if (open.value) hide()
  else void show()
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void show(event.key === 'ArrowUp' ? -1 : 0)
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const items = menuItems()
  const current = items.indexOf(document.activeElement as HTMLElement)
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusItem(current + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusItem(current - 1)
      break
    case 'Home':
      event.preventDefault()
      focusItem(0)
      break
    case 'End':
      event.preventDefault()
      focusItem(-1)
      break
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      hide()
      break
    case 'Tab':
      hide(false)
      break
  }
}

function choose(key: string) {
  if (props.busy) return
  hide()
  emit('select', key)
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
defineExpose({ focus: () => trigger.value?.focus() })
</script>

<template>
  <div class="relative inline-flex">
    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      :class="[
        'inline-flex size-11 items-center justify-center rounded-md border border-ink-500/85 bg-surface text-ink-700 hover:bg-rose-50',
        FOCUS_RING,
      ]"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? `${uid}-menu` : undefined"
      :aria-label="label"
      data-action="more"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <svg class="size-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <circle cx="4" cy="10" r="1.6" />
        <circle cx="10" cy="10" r="1.6" />
        <circle cx="16" cy="10" r="1.6" />
      </svg>
    </button>
    <ul
      v-if="open"
      :id="`${uid}-menu`"
      ref="menu"
      role="menu"
      :aria-label="label"
      class="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-lg border border-ink-500/85 bg-surface p-1 shadow-[var(--shadow-soft)]"
      data-testid="actions-menu"
      @keydown="onMenuKeydown"
    >
      <li v-for="item in items" :key="item.key" role="none">
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          :class="[
            'flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-600',
            item.tone === 'danger' ? 'text-danger-600 hover:bg-danger-50 focus:bg-danger-50' : 'text-ink-900 hover:bg-rose-50 focus:bg-rose-50',
          ]"
          :data-menu-action="item.key"
          @click="choose(item.key)"
        >
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
