<script setup lang="ts">
/**
 * Makes a personal invitation link for one guest: the name goes in the URL fragment
 * (`#to=…`), so it personalises the greeting and prefills the RSVP name without being
 * sent to the server or written to access logs. No guest list is kept.
 */
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { GUEST_NAME_MAX, sanitizeGuestName } from '@/features/themes/core/composables/useRenderMode'

const props = defineProps<{ publicUrl: string | null }>()
const { t } = useAppLocale()
const name = ref('')
const status = ref<'idle' | 'copied' | 'failed'>('idle')
const cleaned = computed(() => sanitizeGuestName(name.value))
const link = computed(() => (props.publicUrl && cleaned.value ? `${props.publicUrl}#to=${encodeURIComponent(cleaned.value)}` : ''))
const linkInput = ref<HTMLInputElement | null>(null)

async function copy() {
  if (!link.value) return
  try {
    await navigator.clipboard.writeText(link.value)
    status.value = 'copied'
  } catch {
    status.value = 'failed'
    linkInput.value?.select()
  }
}
</script>

<template>
  <section class="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-6" aria-labelledby="personal-link-title" data-testid="personal-link">
    <h2 id="personal-link-title" class="text-lg font-semibold">{{ t('personalLinkTitle') }}</h2>
    <p class="text-sm text-ink-700">{{ t('personalLinkIntro') }}</p>
    <template v-if="publicUrl">
      <TextField id="personal-link-name" v-model="name" :label="t('personalLinkName')" :hint="t('personalLinkNameHint', { max: GUEST_NAME_MAX })" autocomplete="off" :maxlength="GUEST_NAME_MAX" @update:model-value="status = 'idle'" />
      <div v-if="link" class="flex flex-wrap items-center gap-2">
        <label for="personal-link-url" class="sr-only">{{ t('personalLinkResult') }}</label>
        <input id="personal-link-url" ref="linkInput" :value="link" readonly class="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm sm:min-h-9" data-testid="personal-link-url" @focus="($event.target as HTMLInputElement).select()" />
        <BaseButton variant="secondary" class="min-h-11 sm:min-h-0" data-action="copy-personal-link" @click="copy">{{ t('copyLink') }}</BaseButton>
      </div>
      <p class="text-sm text-ink-500" role="status">
        <template v-if="status === 'copied'">{{ t('linkCopied') }}</template>
        <template v-else-if="status === 'failed'">{{ t('copyFailed') }}</template>
      </p>
      <p class="text-xs text-ink-500">{{ t('personalLinkPrivacy') }}</p>
    </template>
    <p v-else class="text-sm text-ink-500" data-testid="personal-link-pending">{{ t('personalLinkPending') }}</p>
  </section>
</template>
