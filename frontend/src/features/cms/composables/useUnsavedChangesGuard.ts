/**
 * Protects unsaved edits: asks before leaving the route (in-app navigation) and
 * lets the browser warn on reload/close while anything is dirty.
 *
 * The question is shown by the <ConfirmHost> mounted in the editor layout.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import { useWeddingStore } from '@/stores/wedding'

import { useConfirm } from './useConfirm'

export function useUnsavedChangesGuard(isDirty?: () => boolean) {
  const store = useWeddingStore()
  const confirm = useConfirm()
  const { t } = useAppLocale()
  const dirty = isDirty ?? (() => store.anyDirty)

  onBeforeRouteLeave(async () => {
    if (!dirty()) return true
    return confirm.ask({
      title: t('unsavedTitle'),
      message: t('unsavedBody'),
      confirmLabel: t('discardChanges'),
      cancelLabel: t('keepEditing'),
      tone: 'danger',
    })
  })

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty()) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
