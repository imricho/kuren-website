<script setup lang="ts">
import { computed, ref } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { storyEntryForm, storyEntryPayload } from '@/features/cms/forms'
import { fieldId, validateStoryEntry } from '@/features/cms/validation'
import type { StoryEntryDraft } from '@/features/wedding/draft'
import { useWeddingStore } from '@/stores/wedding'

import { useSectionDraft } from '../../composables/useSectionDraft'
import ErrorSummary from '../ErrorSummary.vue'
import ImageField from '../ImageField.vue'
import ItemEditorActions from './ItemEditorActions.vue'

const props = defineProps<{ item?: StoryEntryDraft }>()
const emit = defineEmits<{ done: [] }>()
const store = useWeddingStore()
const { t } = useAppLocale()
const scope = `st-${props.item?.id ?? 'new'}`

const saved = () => (props.item ? (store.items('stories').find((e) => e.id === props.item!.id) ?? props.item) : undefined)
const draft = useSectionDraft({
  key: `story:${props.item?.id ?? 'new'}`,
  source: () => storyEntryForm(saved()),
  toPayload: storyEntryPayload,
  validate: validateStoryEntry,
  idScope: scope,
  async save(payload) {
    if (props.item) await store.updateItem('stories', props.item.id, payload)
    else await store.createItem('stories', payload)
  },
  successMessage: (): string => t(props.item ? 'itemSaved' : 'itemAdded', { name: draft.form.value.title || t('storyEntry') }),
  failureMessage: () => t('itemSaveFailed'),
})
const { form, errors } = draft
const needed = t('neededToShow')
const id = (field: string) => fieldId(field, scope)

/** A new entry needs at least one detail before it can be added. */
const emptyError = ref(false)
const titleError = computed(() => errors.value.title ?? (emptyError.value ? t('errEmptyItem') : undefined))

async function submit() {
  if (!props.item && !draft.isDirty.value) {
    emptyError.value = true
    document.getElementById(id('title'))?.focus()
    return
  }
  emptyError.value = false
  if (await draft.save()) emit('done')
}
function cancel() {
  draft.discard()
  emit('done')
}
</script>

<template>
  <form class="space-y-4" novalidate data-testid="story-editor" @submit.prevent="submit">
    <ErrorSummary :errors="draft.errorList.value" />
    <p v-if="draft.formError.value" class="text-sm text-danger-600" data-testid="form-error">{{ draft.formError.value }}</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <TextField
        :id="id('title')"
        v-model="form.title"
        :label="t('entryTitle')"
        :error="titleError"
        :needed-hint="needed"
        @update:model-value="emptyError = false"
      />
      <TextField :id="id('date')" v-model="form.date" :label="t('dateLabel')" :hint="t('dateLabelHint')" :error="errors.date" />
    </div>
    <TextAreaField :id="id('description')" v-model="form.description" :label="t('description')" :error="errors.description" :needed-hint="needed" />
    <ImageField v-model="form.image" path="image" :id-scope="scope" :label="t('photo')" :errors="errors" />
    <ItemEditorActions :dirty="draft.isDirty.value" :saving="draft.submitting.value" :is-new="!item" @cancel="cancel" />
  </form>
</template>
