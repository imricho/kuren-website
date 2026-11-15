<script setup lang="ts">
/**
 * Footer of an item editor.
 * - New item: Cancel + Add (explicit; the only way a new record is created).
 * - Saved item: changes autosave, so just "Done" (saves anything pending, then closes).
 */
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ saving: boolean; isNew: boolean }>()
const emit = defineEmits<{ cancel: []; done: [] }>()
const { t } = useAppLocale()
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
    <template v-if="isNew">
      <BaseButton variant="ghost" class="min-h-11 sm:min-h-0" data-action="cancel-item" @click="emit('cancel')">
        {{ t('cancel') }}
      </BaseButton>
      <BaseButton type="submit" class="min-h-11 sm:min-h-0" :loading="saving" data-action="save-item">
        {{ saving ? t('saving') : t('addItem') }}
      </BaseButton>
    </template>
    <BaseButton v-else variant="secondary" class="min-h-11 sm:min-h-0" data-action="done-item" @click="emit('done')">
      {{ t('itemDone') }}
    </BaseButton>
  </div>
</template>
