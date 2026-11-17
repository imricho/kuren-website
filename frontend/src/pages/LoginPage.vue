<script setup lang="ts">
import { useAppLocale } from '@/composables/useAppLocale'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useForm } from '@/composables/useForm'
import { translateApiError } from '@/features/shell/apiErrors'
import { safeRedirect } from '@/router'
import { useAuthStore } from '@/stores/auth'

const { t } = useAppLocale()

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
// Server messages are English-only; show localized ones instead (features/shell/apiErrors).
const { submitting, formError, fieldErrors, submit } = useForm({ translateError: (err) => translateApiError(err, 'login', t) })

const email = ref('')
const password = ref('')

function onSubmit() {
  return submit(async () => {
    await auth.login({ email: email.value, password: password.value })
    await router.replace(safeRedirect(route.query.redirect))
  })
}
</script>

<template>
  <div>
    <h1 class="text-3xl font-semibold break-words sm:text-4xl">{{ t('welcomeBack') }}</h1>
    <p class="mt-2 text-sm text-ink-700">{{ t('signInBody') }}</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="onSubmit">
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <TextField v-model="email" :label="t('email')" type="email" autocomplete="email" required :error="fieldErrors.email" />
      <TextField
        v-model="password"
        :label="t('password')"
        type="password"
        autocomplete="current-password"
        required
        :error="fieldErrors.password"
      />
      <BaseButton type="submit" block :loading="submitting">{{ submitting ? t('saving') : t('signIn') }}</BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-ink-700">
      {{ t('newHere') }}
      <RouterLink :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : undefined }" class="inline-flex min-h-11 items-center font-medium text-rose-700 underline-offset-2 hover:underline">
        {{ t('createAnAccount') }}
      </RouterLink>
    </p>
  </div>
</template>
