<script setup lang="ts">
/**
 * RSVP section body shared by all themes. Themes style the neutral `rsvp-*` classes.
 *  - draft (editor/preview): status line plus an inert preview of the form.
 *  - public with a slug (the published page /i/:slug): the live guest RSVP form
 *    (features/public/RsvpForm.vue) on a card coloured from the theme's manifest tokens.
 *  - public without a slug (e.g. a static preview): information only — deadline/closed
 *    line and the couple's message; no form fields.
 */
import { computed } from 'vue'

import RsvpForm from '@/features/public/RsvpForm.vue'

import { formatDate, labels, rsvpState } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import { useIsDraftRender, useRenderContext } from '../composables/useRenderMode'
import { legacyFormStyle } from '../formTokens'

const isDraft = useIsDraftRender()
const { slug, timezone, guestName, themeId } = useRenderContext()
const live = computed(() => !isDraft.value && !!slug.value)
const formStyle = computed(() => legacyFormStyle(themeId.value))
const props = defineProps<{ content: WeddingContent }>()

const t = computed(() => labels(props.content.locale))
const state = computed(() => rsvpState(props.content.rsvp))
const deadline = computed(() =>
  props.content.rsvp.deadline ? formatDate(props.content.rsvp.deadline, props.content.locale, 'long') : null,
)
</script>

<template>
  <div v-if="live && slug" class="rsvp rsvp--live" :style="formStyle" data-state="live">
    <RsvpForm :content="content" :slug="slug" :timezone="timezone" :guest-name="guestName" />
  </div>
  <div v-else class="rsvp" :data-state="state">
    <p v-if="isDraft" class="rsvp-status" role="note" data-editor-only>{{ content.locale === 'id' ? 'Konfirmasi kehadiran online belum tersedia.' : 'Online RSVP is not available yet.' }}</p>
    <p v-if="state === 'open' && deadline" class="rsvp-status">{{ t.rsvpBy }} {{ deadline }}</p>
    <p v-else-if="state === 'closed'" class="rsvp-status">{{ t.rsvpClosed }}</p>
    <p v-else-if="state === 'disabled'" class="rsvp-status">{{ t.rsvpDisabled }}</p>

    <p v-if="!isDraft && content.rsvp.confirmationMessage" class="rsvp-status rsvp-message" dir="auto">{{ content.rsvp.confirmationMessage }}</p>

    <form v-if="isDraft && state === 'open'" class="rsvp-form" @submit.prevent>
      <fieldset disabled class="rsvp-fieldset">
        <label class="rsvp-field">
          <span class="rsvp-label">{{ t.yourName }}</span>
          <input class="rsvp-input" type="text" autocomplete="name" />
        </label>
        <div class="rsvp-field" role="radiogroup" :aria-label="t.attending">
          <span class="rsvp-label">{{ t.attending }}</span>
          <div class="rsvp-choices">
            <label class="rsvp-choice"><input type="radio" name="attending" value="yes" /> {{ t.accept }}</label>
            <label class="rsvp-choice"><input type="radio" name="attending" value="no" /> {{ t.decline }}</label>
          </div>
        </div>
        <button class="rsvp-button" type="submit">{{ t.rsvpSoon }}</button>
      </fieldset>
    </form>
  </div>
</template>

<style>
/* Live form card inside the pre-engine themes: colours from the theme tokens (core/formTokens.ts). */
.rsvp--live {
  width: min(100%, 34rem);
  margin-inline: auto;
  padding: clamp(1.25rem, 5cqi, 2rem);
  background: var(--tv-surface);
  color: var(--tv-ink);
  border: 1px solid var(--tv-line);
  border-radius: var(--tv-radius);
  text-align: start;
  box-sizing: border-box;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: normal;
  text-transform: none;
}
.rsvp--live .tvf-label { color: var(--tv-ink); }
</style>
