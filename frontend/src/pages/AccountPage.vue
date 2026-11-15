<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useForm } from '@/composables/useForm'
import { translateApiError } from '@/features/shell/apiErrors'
import { useAuthStore } from '@/stores/auth'
import { useAppLocale } from '@/composables/useAppLocale'

const auth = useAuthStore()
const { t } = useAppLocale()
// Server messages are English-only; show localized ones instead (features/shell/apiErrors).
const { submitting, formError, fieldErrors, submit } = useForm({ translateError: (err) => translateApiError(err, 'profile', t) })

const fullName = ref(auth.user?.full_name ?? '')
const saved = ref(false)
watch(fullName, () => (saved.value = false))

function onSubmit() {
  saved.value = false
  return submit(async () => {
    await auth.updateProfile({ full_name: fullName.value })
    fullName.value = auth.user?.full_name ?? fullName.value
    saved.value = true
  })
}
</script>

<template>
  <div class="max-w-xl">
    <p class="text-sm font-medium tracking-wide text-rose-700 uppercase">{{ t('account') }}</p>
    <h1 class="mt-2 text-3xl font-semibold break-words sm:text-4xl">{{ t('accountTitle') }}</h1>

    <form
      class="mt-8 space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6"
      novalidate
      @submit.prevent="onSubmit"
    >
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <FormAlert v-else-if="saved" tone="success">{{ t('profileUpdated') }}</FormAlert>

      <TextField v-model="fullName" :label="t('yourName')" autocomplete="name" required :error="fieldErrors.full_name" />

      <div class="space-y-1.5">
        <p class="text-sm font-medium text-ink-700">{{ t('email') }}</p>
        <p class="text-sm break-all text-ink-700">{{ auth.user?.email }}</p>
      </div>

      <div class="flex justify-end">
        <BaseButton type="submit" :loading="submitting">{{ submitting ? t('saving') : t('saveChanges') }}</BaseButton>
      </div>
    </form>
  </div>
</template>
