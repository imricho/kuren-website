<script setup lang="ts">
/**
 * Avatar button + disclosure panel for the app header.
 *
 * Disclosure pattern (not an ARIA menu, since it holds links and a button group):
 * the button has aria-expanded/aria-controls; opening moves focus to the first
 * item; Escape closes and returns focus to the button; clicking outside or
 * tabbing out closes it. On phones it also carries the main navigation and the
 * language switch, so the header stays one compact row.
 */
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppLanguageSwitch from '@/components/AppLanguageSwitch.vue'
import { useAppLocale } from '@/composables/useAppLocale'

import type { MenuNavItem } from './types'

const props = defineProps<{
  name: string
  email: string
  initials: string
  /** Links shown inside the panel (phones); empty on desktop where nav is inline. */
  items: MenuNavItem[]
  /** Show the language switch inside the panel (phones). */
  showLanguage: boolean
  signingOut: boolean
}>()
const emit = defineEmits<{ signOut: [] }>()
const { t } = useAppLocale()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelId = `account-menu-${useId()}`

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

async function show() {
  open.value = true
  await nextTick()
  panel.value?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

function close(returnFocus = false) {
  if (!open.value) return
  open.value = false
  if (returnFocus) button.value?.focus()
}

function toggle() {
  if (open.value) close(true)
  else void show()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    e.stopPropagation()
    close(true)
  }
}

function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null
  // Only close when focus clearly moved elsewhere on the page (not to "nothing", e.g. a click on blank space).
  if (next && root.value && !root.value.contains(next)) close()
}

function onPointerDown(e: PointerEvent | MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onPointerDown, true)
  else document.removeEventListener('pointerdown', onPointerDown, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
// Any navigation (a menu link, browser back) closes the panel.
const route = useRoute()
watch(() => route.fullPath, () => close())

function signOut() {
  // Return focus to a stable element before a confirmation dialog may open.
  close(true)
  emit('signOut')
}

defineExpose({ close, isOpen: open })

const label = () => (props.name ? t('menuButtonLabel', { name: props.name }) : t('menuButtonLabelAnon'))
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown" @focusout="onFocusOut">
    <button
      ref="button"
      type="button"
      class="flex min-h-11 items-center gap-1.5 rounded-full p-1.5 text-ink-700 transition-colors hover:bg-rose-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="label()"
      data-testid="account-menu-button"
      @click="toggle"
    >
      <span
        class="flex size-8 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700"
        aria-hidden="true"
      >
        {{ initials || '·' }}
      </span>
      <svg class="size-4 transition-transform motion-reduce:transition-none" :class="open && 'rotate-180'" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd" />
      </svg>
    </button>

    <div
      v-show="open"
      :id="panelId"
      ref="panel"
      class="absolute top-full right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--shadow-soft)]"
      data-testid="account-menu"
    >
      <div class="px-3 py-2">
        <p class="text-xs text-ink-500">{{ t('menuSignedInAs') }}</p>
        <p class="truncate text-sm font-medium text-ink-900">{{ name }}</p>
        <p class="truncate text-xs text-ink-500">{{ email }}</p>
      </div>

      <nav v-if="items.length" class="mt-1 border-t border-line pt-1" :aria-label="t('mainNav')">
        <ul>
          <li v-for="item in items" :key="item.key">
            <RouterLink
              :to="item.to"
              class="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-rose-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-500"
              :class="item.active ? 'bg-rose-50 text-ink-900' : 'text-ink-700'"
              :aria-current="item.active ? 'page' : undefined"
              @click="close()"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div v-if="showLanguage" class="mt-1 flex items-center justify-between gap-3 border-t border-line px-3 pt-3 pb-2">
        <span class="text-xs font-medium text-ink-700" aria-hidden="true">{{ t('language') }}</span>
        <AppLanguageSwitch />
      </div>

      <div class="mt-1 border-t border-line pt-1">
        <button
          type="button"
          class="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-rose-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-60"
          :disabled="signingOut"
          @click="signOut"
        >
          {{ t('signOut') }}
        </button>
      </div>
    </div>
  </div>
</template>
