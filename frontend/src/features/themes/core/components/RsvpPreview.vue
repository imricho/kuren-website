<script setup lang="ts">
/**
 * RSVP section body shared by all themes: status line plus a preview of the
 * form. Submission is intentionally disabled — RSVP processing belongs to a
 * later workstream. Themes style the neutral `rsvp-*` classes.
 */
import { computed } from 'vue'

import { formatDate, labels, rsvpState } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

const props = defineProps<{ content: WeddingContent }>()

const t = computed(() => labels(props.content.locale))
const state = computed(() => rsvpState(props.content.rsvp))
const deadline = computed(() =>
  props.content.rsvp.deadline ? formatDate(props.content.rsvp.deadline, props.content.locale, 'long') : null,
)
</script>

<template>
  <div class="rsvp" :data-state="state">
    <p class="rsvp-status" role="status">{{ content.locale === 'id' ? 'Konfirmasi kehadiran online belum tersedia.' : 'Online RSVP is not available yet.' }}</p>
    <p v-if="state === 'open' && deadline" class="rsvp-status">{{ t.rsvpBy }} {{ deadline }}</p>
    <p v-else-if="state === 'closed'" class="rsvp-status">{{ t.rsvpClosed }}</p>
    <p v-else-if="state === 'disabled'" class="rsvp-status">{{ t.rsvpDisabled }}</p>

    <form v-if="state === 'open'" class="rsvp-form" aria-disabled="true" @submit.prevent>
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
