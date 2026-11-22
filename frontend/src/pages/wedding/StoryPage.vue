<script setup lang="ts">
import { computed } from 'vue'

import TextAreaField from '@/components/ui/TextAreaField.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import StoryEntryEditor from '@/features/cms/components/editors/StoryEntryEditor.vue'
import ErrorSummary from '@/features/cms/components/ErrorSummary.vue'
import ListEditor from '@/features/cms/components/ListEditor.vue'
import SectionHeader from '@/features/cms/components/SectionHeader.vue'
import SectionHiddenNote from '@/features/cms/components/SectionHiddenNote.vue'
import SectionToggle from '@/features/cms/components/SectionToggle.vue'
import { useSectionDraft } from '@/features/cms/composables/useSectionDraft'
import { useUnsavedChangesGuard } from '@/features/cms/composables/useUnsavedChangesGuard'
import { storyMetaForm, storyMetaPayload } from '@/features/cms/forms'
import { fieldId, validateStoryMeta } from '@/features/cms/validation'
import type { StoryEntryDraft } from '@/features/wedding/draft'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const { t } = useAppLocale()
useUnsavedChangesGuard()

const draft = useSectionDraft({
  key: 'story',
  source: () => storyMetaForm(store.content!.story),
  toPayload: storyMetaPayload,
  validate: validateStoryMeta,
  save: async (payload) => void (await store.saveSection('story', payload)),
  live: (value) => ({ kind: 'section', section: 'story', value }),
})
const { form, errors } = draft
const labels = computed<Record<string, string>>(() => ({
  enabled: t('showOnWebsite'),
  title: t('sectionTitleLabel'),
  introduction: t('introduction'),
}))

const entries = computed(() => store.items('stories'))
const name = (e: StoryEntryDraft, i: number) => e.title?.trim() || t('untitledItem', { kind: t('storyEntry'), n: i + 1 })
</script>

<template>
  <div class="space-y-8">
    <SectionHeader section="story" :description="t('storyIntro')">
      <template #toggle>
        <SectionToggle v-model="form.enabled" section="story" />
      </template>
    </SectionHeader>
    <SectionHiddenNote v-if="!form.enabled" />

    <form v-show="form.enabled" class="space-y-4" novalidate data-testid="story-meta-form" @submit.prevent="draft.save()">
      <ErrorSummary :errors="draft.errorList.value" :labels="labels" />
      <fieldset class="min-w-0 space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6">
        <legend class="px-1 font-display text-xl font-semibold">{{ t('sectionHeading') }}</legend>
        <TextField :id="fieldId('title')" v-model="form.title" :label="t('sectionTitleLabel')" :hint="t('storyTitleHint')" :error="errors.title" />
        <TextAreaField :id="fieldId('introduction')" v-model="form.introduction" :label="t('introduction')" :rows="3" :error="errors.introduction" />
      </fieldset>
    </form>

    <section v-show="form.enabled" aria-labelledby="story-entries" class="space-y-4">
      <h2 id="story-entries" class="text-2xl font-semibold">{{ t('storyEntries') }}</h2>
      <ListEditor
        :items="entries"
        :item-name="name"
        :add-label="t('addStoryEntry')"
        :empty-title="t('noStoryTitle')"
        :empty-body="t('noStoryBody')"
        :list-label="t('storyEntries')"
        :max="20"
        :reorder="(ids) => store.reorder('stories', ids)"
        :refresh="() => store.refreshCollection('stories')"
        :before-close="(item) => store.flushDraft(`story:${item.id}`)"
        :remove="(item) => store.deleteItem('stories', item.id)"
      >
        <template #summary="{ item, index }">
          <p v-if="item.date" class="text-xs font-medium tracking-wide text-rose-600 uppercase">{{ item.date }}</p>
          <h3 class="mt-0.5 font-display text-xl font-semibold">{{ name(item, index) }}</h3>
          <p v-if="item.description" class="mt-1 line-clamp-2 text-sm text-ink-500">{{ item.description }}</p>
          <p v-if="!item.title || !item.description" class="mt-2 text-xs text-amber-700">{{ t('storyEntryHidden') }}</p>
        </template>
        <template #editor="{ item, close }">
          <StoryEntryEditor :item="item" @done="close" />
        </template>
        <template #create="{ close }">
          <h3 class="mb-4 font-display text-xl font-semibold">{{ t('newStoryEntry') }}</h3>
          <StoryEntryEditor @done="close" />
        </template>
      </ListEditor>
    </section>
  </div>
</template>
