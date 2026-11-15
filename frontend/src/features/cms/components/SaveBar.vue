<script setup lang="ts">
/**
 * Save controls for a section. Sticky at the bottom of the screen on phones so
 * "Save changes" is always reachable; inline at the end of the form on desktop.
 * The save button stays focusable while saving (BaseButton uses aria-disabled).
 */
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ dirty: boolean; saving: boolean; saveLabel?: string }>()
const emit = defineEmits<{ discard: [] }>()
const { t } = useAppLocale()
</script>

<template>
  <div
    class="sticky bottom-0 z-20 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-[var(--radius-card)] lg:border lg:px-5"
    data-testid="save-bar"
    :data-state="saving ? 'saving' : dirty ? 'dirty' : 'clean'"
  >
    <div class="flex flex-wrap items-center gap-3">
      <!-- Not a live region: the save result is announced once, by the toast. -->
      <p class="mr-auto flex items-center gap-2 text-sm" :class="dirty ? 'text-amber-800' : 'text-ink-500'" data-testid="save-state">
        <span v-if="dirty" class="size-2 rounded-full bg-amber-500" aria-hidden="true" />
        <svg v-else class="size-3.5 text-success-600" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ saving ? t('saving') : dirty ? t('unsavedChanges') : t('saved') }}
      </p>
      <BaseButton v-if="dirty && !saving" variant="ghost" class="min-h-11 lg:min-h-0" @click="emit('discard')">
        {{ t('discard') }}
      </BaseButton>
      <BaseButton type="submit" class="min-h-11 lg:min-h-0" :loading="saving" :disabled="!dirty && !saving">
        {{ saving ? t('saving') : (saveLabel ?? t('saveChanges')) }}
      </BaseButton>
    </div>
  </div>
</template>
