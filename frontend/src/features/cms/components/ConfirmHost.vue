<script setup lang="ts">
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

import { useConfirm } from '../composables/useConfirm'

const { state, confirm, cancel } = useConfirm()
</script>

<template>
  <ConfirmDialog
    :open="state.open"
    :title="state.options.title"
    :message="state.options.message"
    :confirm-label="state.options.confirmLabel"
    :cancel-label="state.options.cancelLabel"
    :tone="state.options.tone"
    @confirm="confirm"
    @cancel="cancel"
  />
</template>
