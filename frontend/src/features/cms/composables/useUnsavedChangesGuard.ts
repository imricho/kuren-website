/**
 * Protects unsaved work. On in-app navigation it first flushes pending
 * autosaves (so a quick edit followed by a click on another section is simply
 * saved), and only asks if something is still unsaved: edits that are invalid,
 * failed, waiting for the connection, in conflict, or a new item not yet added.
 * The browser also warns on reload/close while anything is unsaved.
 *
 * The question is shown by the <ConfirmHost> mounted in the editor layout.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useAppLocale } from '@/composables/useAppLocale'
import { useInvitationStore } from '@/stores/invitation'

import { useConfirm } from './useConfirm'

export function useUnsavedChangesGuard(isDirty?: () => boolean) {
  const store = useInvitationStore()
  const confirm = useConfirm()
  const { t } = useAppLocale()
  const dirty = isDirty ?? (() => store.hasUnsavedWork)

  onBeforeRouteLeave(async () => {
    if (!dirty()) return true
    await store.saveNow()
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
