/**
 * Inline repeater rows inside one section form (the Amplop bank-account pattern):
 * add (≤ max, focus the new row's first field), move up/down (focus follows the
 * row, announced politely), remove (confirm when the row has content, announced,
 * focus moves to the next row or the Add button). Rows carry stable client ids.
 */
import { computed, nextTick, ref, type Ref } from 'vue'

import { useAppLocale } from '@/composables/useAppLocale'

import { fieldId } from '../validation'
import { useConfirm } from './useConfirm'

export interface RepeaterOptions<T extends { id: string }> {
  rows: () => T[]
  setRows: (rows: T[]) => void
  max: number
  create: () => T
  isEmpty: (row: T) => boolean
  /** Visible name of a row, e.g. "Speaker 2" or the person's name. */
  name: (row: T, index: number) => string
  /** Field path of a row's first input, focused after add/remove (e.g. `people.<i>.name`). */
  firstField: (index: number) => string
  /** `data-action` of the Add button (focus target when the last row is removed). */
  addAction: string
}

export function useRepeater<T extends { id: string }>(options: RepeaterOptions<T>) {
  const { t } = useAppLocale()
  const confirm = useConfirm()
  const announcement: Ref<string> = ref('')
  /** Clear first, so the same text twice in a row is announced again. */
  function announce(text: string) {
    announcement.value = ''
    nextTick(() => (announcement.value = text))
  }
  const atLimit = computed(() => options.rows().length >= options.max)

  function add() {
    if (atLimit.value) return
    options.setRows([...options.rows(), options.create()])
    const index = options.rows().length - 1
    nextTick(() => document.getElementById(fieldId(options.firstField(index)))?.focus())
  }

  function move(index: number, direction: -1 | 1) {
    const rows = [...options.rows()]
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    ;[rows[index], rows[target]] = [rows[target]!, rows[index]!]
    options.setRows(rows)
    const id = rows[target]!.id
    announce(t('rowMoved', { name: options.name(rows[target]!, target), position: target + 1, total: rows.length }))
    nextTick(() => {
      const preferred = document.querySelector<HTMLButtonElement>(`[data-reorder="${id}-${direction < 0 ? 'up' : 'down'}"]`)
      const other = document.querySelector<HTMLButtonElement>(`[data-reorder="${id}-${direction < 0 ? 'down' : 'up'}"]`)
      ;(preferred && !preferred.disabled ? preferred : other)?.focus()
    })
  }

  async function remove(index: number) {
    const row = options.rows()[index]
    if (!row) return
    const name = options.name(row, index)
    if (!options.isEmpty(row)) {
      const ok = await confirm.ask({
        title: t('removeRowTitle', { name }),
        message: t('removeRowBody'),
        confirmLabel: t('remove'),
        cancelLabel: t('cancel'),
        tone: 'danger',
      })
      if (!ok) return
    }
    options.setRows(options.rows().filter((r) => r.id !== row.id))
    announce(t('rowRemoved', { name }))
    nextTick(() => {
      const next = Math.min(index, options.rows().length - 1)
      const el = next >= 0 ? document.getElementById(fieldId(options.firstField(next))) : document.querySelector<HTMLElement>(`[data-action="${options.addAction}"]`)
      el?.focus()
    })
  }

  return { add, move, remove, atLimit, announcement }
}
