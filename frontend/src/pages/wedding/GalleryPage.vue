<script setup lang="ts">
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import GalleryItemEditor from '@/features/cms/components/editors/GalleryItemEditor.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ListEditor from '@/features/cms/components/ListEditor.vue'
import SaveBar from '@/features/cms/components/SaveBar.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { galleryMetaForm, galleryMetaPayload } from '@/features/cms/forms'
import { fieldId, validateGalleryMeta } from '@/features/cms/validation'
import type { GalleryItemDraft } from '@/features/wedding/draft'
import { focalPosition, isSafeImageSrc } from '@/features/wedding/format'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'gallery',
  source: () => galleryMetaForm(store.content!.gallery),
  toPayload: galleryMetaPayload,
  validate: validateGalleryMeta,
  save: async (payload) => void (await store.saveSection('gallery', payload)),
  successMessage: () => t('sectionSaved', { section: t('sectionGallery') }),
  failureMessage: () => t('sectionSaveFailed', { section: t('sectionGallery') }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  title: t('sectionTitleLabel'),
  description: t('description'),
}))

const images = computed(() => store.items('gallery'))
const name = (g: GalleryItemDraft, i: number) => g.caption?.trim() || t('photoN', { n: i + 1 })
</script>

<template>
  <div class="space-y-8">
    <SectionHeader section="gallery" :description="t('galleryIntro')" />

    <form class="space-y-4" novalidate data-testid="gallery-meta-form" @submit.prevent="draft.save()">
      <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
        <TextField :id="fieldId('title')" v-model="form.title" :label="t('sectionTitleLabel')" :hint="t('galleryTitleHint')" :error="errors.title" />
        <TextAreaField :id="fieldId('description')" v-model="form.description" :label="t('description')" :rows="3" :error="errors.description" />
      </fieldset>
      <SaveBar :dirty="draft.isDirty.value" :saving="draft.submitting.value" @discard="draft.discard()" />
    </form>

    <section aria-labelledby="gallery-photos" class="space-y-4">
      <h2 id="gallery-photos" class="text-2xl font-semibold">{{ t('galleryPhotos') }}</h2>
      <ListEditor
        :items="images"
        :item-name="name"
        :add-label="t('addPhoto')"
        :empty-title="t('noPhotosTitle')"
        :empty-body="t('noPhotosBody')"
        :list-label="t('galleryPhotos')"
        :max="60"
        :reorder="(ids) => store.reorder('gallery', ids)"
        :refresh="() => store.refreshCollection('gallery')"
        :remove="(item) => store.deleteItem('gallery', item.id)"
      >
        <template #summary="{ item, index }">
          <div class="flex items-center gap-4">
            <img
              v-if="isSafeImageSrc(item.src)"
              :src="item.src"
              :alt="item.alt"
              class="size-16 shrink-0 rounded-md object-cover ring-1 ring-line"
              :style="{ objectPosition: focalPosition(item) }"
              loading="lazy"
            />
            <div class="min-w-0">
              <h3 class="truncate font-medium">{{ name(item, index) }}</h3>
              <p class="line-clamp-2 text-xs text-ink-500">{{ item.alt }}</p>
            </div>
          </div>
        </template>
        <template #editor="{ item, close }">
          <GalleryItemEditor :item="item" @done="close" />
        </template>
        <template #create="{ close }">
          <h3 class="mb-4 font-display text-xl font-semibold">{{ t('newPhoto') }}</h3>
          <GalleryItemEditor @done="close" />
        </template>
      </ListEditor>
    </section>
  </div>
</template>
