<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'

defineProps<{ dirty: boolean; saving: boolean; isNew: boolean }>()
const emit = defineEmits<{ cancel: [] }>()
const { t } = useAppLocale()
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
    <p v-if="dirty" class="mr-auto text-sm text-amber-800">{{ t('unsavedChanges') }}</p>
    <BaseButton variant="ghost" class="min-h-11 sm:min-h-0" data-action="cancel-item" @click="emit('cancel')">
      {{ dirty ? t('discard') : t('cancel') }}
    </BaseButton>
    <BaseButton type="submit" class="min-h-11 sm:min-h-0" :loading="saving" :disabled="!isNew && !dirty && !saving" data-action="save-item">
      {{ saving ? t('saving') : isNew ? t('addItem') : t('saveChanges') }}
    </BaseButton>
  </div>
</template>
