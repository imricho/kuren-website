<script setup lang="ts">
/**
 * RSVP section.
 *  - public + slug (published page): the real form (features/public/RsvpForm.vue).
 *  - draft (editor / preview): a NON-submitting sample of the configured form inside a
 *    disabled fieldset, marked `data-editor-only`.
 *  - public without a slug (e.g. a static preview): information only.
 */
import { computed } from 'vue'

import RsvpForm from '@/features/public/RsvpForm.vue'
import { formConfig } from '@/features/public/rsvpFormLogic'
import { formatDate, labels, rsvpState } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import { useRenderContext } from '../../core/composables/useRenderMode'
import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent }>()
const { t, locale, isDraft } = useTv()
const { slug, timezone, guestName } = useRenderContext()
const l = computed(() => labels(locale.value))
const state = computed(() => rsvpState(props.content.rsvp))
const deadline = computed(() => (props.content.rsvp.deadline ? formatDate(props.content.rsvp.deadline, locale.value, 'long') : ''))
const config = computed(() => formConfig(props.content.rsvp, props.content.events))
const live = computed(() => !isDraft.value && !!slug.value)
</script>

<template>
  <section data-section="rsvp" class="tv-section tv-rsvp">
    <div class="tv-inner tv-narrow">
      <header class="tv-center">
        <h2 class="tv-h2" dir="auto">{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="tv-lead tv-pre" dir="auto">{{ content.rsvp.introduction }}</p>
      </header>

      <div class="tv-card tv-rsvp__card">
        <RsvpForm v-if="live && slug" :content="content" :slug="slug" :timezone="timezone" :guest-name="guestName" />

        <template v-else-if="isDraft">
          <p class="rsvp-status tv-muted" role="note" data-editor-only>{{ t('tvRsvpSampleNote') }}</p>
          <p v-if="state === 'closed'" class="rsvp-status">{{ l.rsvpClosed }}</p>
          <template v-else>
            <p v-if="deadline" class="rsvp-status tv-muted">{{ t('tvRsvpBy', { date: deadline }) }}</p>
            <form class="rsvp-form tvf-form" data-editor-only aria-hidden="true" @submit.prevent>
              <fieldset disabled class="tvf-field tvf-group">
                <label class="tvf-field"><span class="tvf-label">{{ t('tvRsvpName') }}</span><input class="tvf-input" type="text" tabindex="-1" /></label>
                <div class="tvf-field">
                  <span class="tvf-label">{{ t('tvRsvpAttendance') }}</span>
                  <label class="tvf-choice"><input type="radio" name="tv-sample-attending" tabindex="-1" /> <span>{{ t('tvRsvpAttending') }}</span></label>
                  <label class="tvf-choice"><input type="radio" name="tv-sample-attending" tabindex="-1" /> <span>{{ t('tvRsvpNotAttending') }}</span></label>
                </div>
                <label v-if="config.partyLimit > 1" class="tvf-field"><span class="tvf-label">{{ t('tvRsvpPartySize') }}</span><select class="tvf-input" tabindex="-1"><option>1</option></select></label>
                <label v-if="config.collectContact === 'email' || config.collectContact === 'email_or_phone'" class="tvf-field"><span class="tvf-label">{{ t('tvRsvpEmail') }}</span><input class="tvf-input" type="email" tabindex="-1" /></label>
                <label v-if="config.collectContact === 'phone' || config.collectContact === 'email_or_phone'" class="tvf-field"><span class="tvf-label">{{ t('tvRsvpPhone') }}</span><input class="tvf-input" type="tel" tabindex="-1" /></label>
                <div v-if="config.optionalSessions.length" class="tvf-field">
                  <span class="tvf-label">{{ t('tvRsvpSessions') }}</span>
                  <label v-for="s in config.optionalSessions" :key="s.id" class="tvf-choice"><input type="checkbox" tabindex="-1" /> <span dir="auto">{{ s.title }}</span></label>
                </div>
                <label v-for="f in config.fields" :key="f.id" :class="f.type === 'checkbox' ? 'tvf-choice' : 'tvf-field'">
                  <input v-if="f.type === 'checkbox'" type="checkbox" tabindex="-1" />
                  <span :class="f.type === 'checkbox' ? '' : 'tvf-label'" dir="auto">{{ f.label }}<span v-if="f.required" class="tvf-req" aria-hidden="true"> *</span></span>
                  <select v-if="f.type === 'select'" class="tvf-input" tabindex="-1"><option>{{ t('tvRsvpSelectPlaceholder') }}</option></select>
                  <textarea v-else-if="f.type === 'textarea'" class="tvf-input" rows="2" tabindex="-1" />
                  <input v-else-if="f.type !== 'checkbox'" class="tvf-input" type="text" tabindex="-1" />
                </label>
                <button class="tvf-submit rsvp-button" type="submit" tabindex="-1">{{ t('tvRsvpSubmit') }}</button>
              </fieldset>
            </form>
          </template>
        </template>

        <template v-else>
          <p v-if="state === 'closed'" class="rsvp-status">{{ l.rsvpClosed }}</p>
          <p v-else-if="deadline" class="rsvp-status">{{ t('tvRsvpBy', { date: deadline }) }}</p>
          <p v-if="content.rsvp.confirmationMessage" class="rsvp-status tv-pre" dir="auto">{{ content.rsvp.confirmationMessage }}</p>
        </template>
      </div>
    </div>
  </section>
</template>
