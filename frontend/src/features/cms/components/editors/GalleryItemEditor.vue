<script setup lang="ts">
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { galleryItemForm, galleryItemPayload } from '@/features/cms/forms'
import { fieldId, validateGalleryItem } from '@/features/cms/validation'
import type { GalleryItemDraft } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'

import { useSectionDraft } from '../../composables/useSectionDraft'
import ErrorSummary from '../ErrorSummary.vue'
import ImageField from '../ImageField.vue'
import ItemEditorActions from './ItemEditorActions.vue'

const props = defineProps<{ item?: GalleryItemDraft }>()
const emit = defineEmits<{ done: [] }>()
const store = useInvitationStore()
const { t } = useAppLocale()
const scope = `ga-${props.item?.id ?? 'new'}`

const saved = () => (props.item ? (store.items('gallery').find((e) => e.id === props.item!.id) ?? props.item) : undefined)
const draft = useSectionDraft({
  key: `gallery:${props.item?.id ?? 'new'}`,
  source: () => galleryItemForm(saved()),
  toPayload: galleryItemPayload,
  validate: validateGalleryItem,
  idScope: scope,
  async save(payload) {
    if (props.item) await store.updateItem('gallery', props.item.id, payload)
    else await store.createItem('gallery', payload)
  },
  // Saved items autosave; a new item is only created by an explicit Add.
  autosave: !!props.item,
  live: (payload) => ({ kind: 'item', collection: 'gallery', itemId: props.item?.id ?? null, value: payload }),
  successMessage: (): string => t('itemAdded', { name: draft.form.value.caption || t('photo') }),
  failureMessage: () => t('itemSaveFailed'),
})
const { form, errors } = draft
const id = (field: string) => fieldId(field, scope)

async function submit() {
  if (await draft.save()) {
    if (!props.item) emit('done') // added: close the new-item form
  }
}
/** Saved item: save anything pending, then close (stays open if it couldn't be saved). */
async function done() {
  if (await draft.flush()) emit('done')
}
function cancel() {
  draft.discard()
  emit('done')
}
</script>

<template>
  <form class="space-y-4" novalidate data-testid="gallery-editor" @submit.prevent="submit">
    <ErrorSummary :errors="draft.errorList.value" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>
    <ImageField
      v-model="form.image"
      path="image"
      src-path="src"
      alt-path="alt"
      focal-path="focalPoint"
      :id-scope="scope"
      :label="t('photo')"
      :errors="errors"
      src-required
    />
    <TextField :id="id('caption')" v-model="form.caption" :label="t('caption')" :hint="t('optional')" :error="errors.caption" />
    <ItemEditorActions :saving="draft.submitting.value" :is-new="!item" @cancel="cancel" @done="done" />
  </form>
</template>
