<script setup lang="ts" generic="T extends { id: string }">
/**
 * Generic editor for an ordered list of saved items (story entries, events,
 * gallery photos). The parent renders each item through slots and performs the
 * API calls through the `reorder` / `remove` props (both pessimistic, explicit).
 * Item editors autosave; before an open item editor is closed (or another one
 * opened), `beforeClose` lets the parent flush pending saves — it stays open if
 * that resolves false.
 *
 * Slots: `summary` (collapsed item), `editor` (item being edited), `create` (new item form).
 */
import { computed, nextTick, ref, useId, watch } from 'vue'

import { ApiError } from '@/api/http'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'

import { FOCUS_RING } from '@/components/ui/styles'

import { useIsPhone } from '../composables/useMediaQuery'
import ActionsMenu, { type MenuAction } from './ActionsMenu.vue'
import EmptyState from './EmptyState.vue'
import ReorderButtons from './ReorderButtons.vue'

const props = defineProps<{
  items: T[]
  itemName: (item: T, index: number) => string
  addLabel: string
  emptyTitle: string
  emptyBody?: string
  max?: number
  reorder?: (ids: string[]) => Promise<unknown>
  remove?: (item: T) => Promise<unknown>
  /** Re-fetch the list when the server says our order is stale (409/422 on reorder). */
  refresh?: () => Promise<unknown>
  /** Heading level text for the list (visually hidden). */
  listLabel: string
  /** Called before an open item editor closes; resolve false to keep it open (e.g. its changes couldn't be saved). */
  beforeClose?: (item: T) => Promise<boolean>
}>()

defineSlots<{
  summary(props: { item: T; index: number }): unknown
  editor(props: { item: T; index: number; close: () => void }): unknown
  create(props: { close: () => void }): unknown
}>()

const { t } = useAppLocale()
const toast = useToast()
const listId = useId()
const isPhone = useIsPhone()

const editingId = ref<string | null>(null)
const adding = ref(false)
const busy = ref(false)
/** Polite live region: used ONLY for reorder results and the limit message (results of saves/deletes are toasts). */
const announcement = ref('')
const limitError = ref(false)
const pendingDeleteId = ref<string | null>(null)
const pendingDelete = computed(() => props.items.find((i) => i.id === pendingDeleteId.value) ?? null)
const atLimit = computed(() => props.max !== undefined && props.items.length >= props.max)
const createBox = ref<HTMLElement | null>(null)
/** Ids present when the create form opened, to find the newly created item afterwards. */
let idsBeforeAdd = new Set<string>()

const addButtonId = `${listId}-add`
const editId = (item: T) => `${listId}-edit-${item.id}`
const moreId = (item: T) => `${listId}-more-${item.id}`
const focusById = (id: string) => document.getElementById(id)?.focus()

const FOCUSABLE = 'input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
function focusFirstIn(container: Element | null | undefined) {
  container?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
}

function announce(message: string) {
  // Clear first so repeating the same text is announced again.
  announcement.value = ''
  nextTick(() => (announcement.value = message))
}

watch(atLimit, (limit) => {
  if (!limit) limitError.value = false
})

/** Let the open item editor save before it goes away. */
async function releaseEditor(): Promise<boolean> {
  const open = props.items.find((i) => i.id === editingId.value)
  if (!open || !props.beforeClose) return true
  return props.beforeClose(open)
}

async function startAdd() {
  if (!(await releaseEditor())) return
  if (atLimit.value) {
    limitError.value = true
    announce(t('limitReached', { max: props.max ?? 0 }))
    return
  }
  limitError.value = false
  editingId.value = null
  idsBeforeAdd = new Set(props.items.map((i) => i.id))
  adding.value = true
  await nextTick()
  focusFirstIn(createBox.value)
}
async function closeAdd() {
  adding.value = false
  await nextTick()
  // Saved → focus the new item; cancelled → back to the add button.
  const created = props.items.find((i) => !idsBeforeAdd.has(i.id))
  if (created) focusById(editId(created))
  else focusById(addButtonId)
}
async function toggleEdit(item: T) {
  if (!(await releaseEditor())) return
  adding.value = false
  editingId.value = editingId.value === item.id ? null : item.id
  if (editingId.value === item.id) {
    await nextTick()
    const editor = [...document.querySelectorAll<HTMLElement>('[data-item-editor]')].find((el) => el.dataset.itemEditor === item.id)
    focusFirstIn(editor)
  }
}
function closeEdit(item: T) {
  editingId.value = null
  nextTick(() => focusById(editId(item)))
}

async function move(item: T, direction: -1 | 1, from: 'buttons' | 'menu' = 'buttons') {
  if (!props.reorder || busy.value) return
  const fromIndex = props.items.findIndex((i) => i.id === item.id)
  const to = fromIndex + direction
  if (fromIndex < 0 || to < 0 || to >= props.items.length) return
  const ids = props.items.map((i) => i.id)
  ids.splice(fromIndex, 1)
  ids.splice(to, 0, item.id)
  busy.value = true
  try {
    await props.reorder(ids)
    announce(t('movedTo', { position: to + 1, count: ids.length }))
  } catch (err) {
    toast.error(t('reorderFailed'))
    // Someone else changed the list (another tab): reload it so it isn't stuck.
    if (err instanceof ApiError && (err.status === 409 || err.status === 422) && props.refresh) {
      try {
        await props.refresh()
      } catch {
        // Keep showing the current list; the error toast already explains.
      }
    }
  } finally {
    busy.value = false
  }
  await nextTick()
  if (from === 'menu') {
    focusById(moreId(item))
    return
  }
  // Keep focus on the control the user pressed (or its sibling if it is now disabled).
  const index = props.items.findIndex((i) => i.id === item.id)
  const same = direction === -1 ? 'up' : 'down'
  const other = direction === -1 ? 'down' : 'up'
  const atEnd = direction === -1 ? index === 0 : index === props.items.length - 1
  const target = document.querySelector<HTMLButtonElement>(`[data-reorder="${item.id}-${atEnd ? other : same}"]`)
  target?.focus()
}

function menuItems(item: T, index: number): MenuAction[] {
  const name = props.itemName(item, index)
  const out: MenuAction[] = []
  if (props.reorder && props.items.length > 1) {
    if (index > 0) out.push({ key: 'up', label: t('moveUp', { name }) })
    if (index < props.items.length - 1) out.push({ key: 'down', label: t('moveDown', { name }) })
  }
  if (props.remove) out.push({ key: 'delete', label: t('delete'), tone: 'danger' })
  return out
}
function onMenu(item: T, key: string) {
  if (key === 'up') void move(item, -1, 'menu')
  else if (key === 'down') void move(item, 1, 'menu')
  else if (key === 'delete') askDelete(item)
}

function askDelete(item: T) {
  pendingDeleteId.value = item.id
}

async function confirmDelete() {
  const item = pendingDelete.value
  pendingDeleteId.value = null
  if (!item || !props.remove) return
  const index = props.items.findIndex((i) => i.id === item.id)
  const name = props.itemName(item, index)
  busy.value = true
  try {
    await props.remove(item)
    if (editingId.value === item.id) editingId.value = null
    toast.success(t('itemDeleted', { name }))
  } catch {
    toast.error(t('deleteFailed', { name }))
  } finally {
    busy.value = false
  }
  await nextTick()
  // Move focus somewhere sensible: the next item's edit button, else the add button.
  const next = props.items.find((i) => i.id === item.id) ?? props.items[Math.min(index, props.items.length - 1)]
  focusById(next ? editId(next) : addButtonId)
}
</script>

<template>
  <div class="space-y-4" data-testid="list-editor">
    <p class="sr-only" role="status" aria-live="polite" data-testid="list-live">{{ announcement }}</p>

    <EmptyState v-if="items.length === 0 && !adding" :title="emptyTitle" :body="emptyBody" />

    <ol v-if="items.length" class="space-y-3" :aria-label="listLabel">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5"
        :data-item="item.id"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <slot name="summary" :item="item" :index="index" />
          </div>
          <div class="flex shrink-0 items-center gap-2" :class="!isPhone && 'flex-wrap justify-end'">
            <ReorderButtons
              v-if="!isPhone && reorder && items.length > 1"
              :index="index"
              :count="items.length"
              :item-name="itemName(item, index)"
              :item-id="item.id"
              :busy="busy"
              @move="move(item, $event)"
            />
            <button
              :id="editId(item)"
              type="button"
              :class="[
                'min-h-11 rounded-md border border-ink-500/85 bg-surface px-3 text-sm font-medium text-ink-700 hover:bg-rose-50 sm:min-h-9',
                FOCUS_RING,
              ]"
              :aria-expanded="editingId === item.id"
              :aria-label="`${editingId === item.id ? t('closeEditor') : t('edit')}: ${itemName(item, index)}`"
              data-action="edit"
              @click="toggleEdit(item)"
            >
              {{ editingId === item.id ? t('close') : t('edit') }}
            </button>
            <ActionsMenu
              v-if="isPhone && menuItems(item, index).length"
              :trigger-id="moreId(item)"
              :label="t('moreActions', { name: itemName(item, index) })"
              :items="menuItems(item, index)"
              :busy="busy"
              @select="onMenu(item, $event)"
            />
            <button
              v-else-if="!isPhone && remove"
              type="button"
              :class="['min-h-11 rounded-md px-3 text-sm font-medium text-danger-600 hover:bg-danger-50 sm:min-h-9', FOCUS_RING]"
              :aria-label="`${t('delete')}: ${itemName(item, index)}`"
              data-action="delete"
              @click="askDelete(item)"
            >
              {{ t('delete') }}
            </button>
          </div>
        </div>
        <div v-if="editingId === item.id" class="mt-4 border-t border-line pt-4" :data-item-editor="item.id">
          <slot name="editor" :item="item" :index="index" :close="() => closeEdit(item)" />
        </div>
      </li>
    </ol>

    <div
      v-if="adding"
      ref="createBox"
      class="min-w-0 rounded-[var(--radius-card)] border border-rose-100 bg-surface p-4 shadow-[var(--shadow-soft)] sm:p-5"
      data-testid="list-create"
    >
      <slot name="create" :close="closeAdd" />
    </div>

    <div v-else class="flex flex-wrap items-center gap-3">
      <BaseButton
        :id="addButtonId"
        variant="secondary"
        class="min-h-11 sm:min-h-0"
        :aria-describedby="limitError ? `${listId}-limit` : undefined"
        data-action="add"
        @click="startAdd"
      >
        <span aria-hidden="true">+</span> {{ addLabel }}
      </BaseButton>
      <p v-if="limitError" :id="`${listId}-limit`" class="text-sm text-danger-600" data-testid="limit-error">
        {{ t('limitReached', { max: max ?? 0 }) }}
      </p>
    </div>

    <ConfirmDialog
      :open="pendingDelete !== null"
      :title="t('deleteTitle', { name: pendingDelete ? itemName(pendingDelete, items.indexOf(pendingDelete)) : '' })"
      :message="t('deleteBody')"
      :confirm-label="t('delete')"
      :cancel-label="t('cancel')"
      tone="danger"
      @confirm="confirmDelete"
      @cancel="pendingDeleteId = null"
    />
  </div>
</template>
