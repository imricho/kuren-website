<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'

const { t } = useAppLocale()

const auth = useAuthStore()
const router = useRouter()
const { submitting, formError, fieldErrors, submit } = useForm()

const fullName = ref('')
const email = ref('')
const password = ref('')

function onSubmit() {
  return submit(async () => {
    await auth.register({ full_name: fullName.value, email: email.value, password: password.value })
    await router.replace({ name: 'dashboard' })
  })
}
</script>

<template>
  <div>
    <h1 class="text-4xl font-semibold">{{ t('createAccount') }}</h1>
    <p class="mt-2 text-sm text-ink-500">{{ t('createAccountBody') }}</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="onSubmit">
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <TextField
        v-model="fullName"
        :label="t('yourName')"
        autocomplete="name"
        required
        :error="fieldErrors.full_name"
      />
      <TextField v-model="email" :label="t('email')" type="email" autocomplete="email" required :error="fieldErrors.email" />
      <TextField
        v-model="password"
        :label="t('password')"
        type="password"
        autocomplete="new-password"
        :hint="t('passwordHint')"
        required
        :error="fieldErrors.password"
      />
      <BaseButton type="submit" block :loading="submitting">{{ submitting ? t('saving') : t('createAccountAction') }}</BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-ink-500">
      {{ t('alreadyAccount') }}
      <RouterLink :to="{ name: 'login' }" class="font-medium text-rose-600 hover:text-rose-700">{{ t('signIn') }}</RouterLink>
    </p>
  </div>
</template>
