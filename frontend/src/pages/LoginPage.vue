<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useForm } from '@/composables/useForm'
import { safeRedirect } from '@/router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { submitting, formError, fieldErrors, submit } = useForm()

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
    <h1 class="text-4xl font-semibold">Welcome back</h1>
    <p class="mt-2 text-sm text-ink-500">Sign in to continue planning your wedding website.</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="onSubmit">
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <TextField v-model="email" label="Email" type="email" autocomplete="email" required :error="fieldErrors.email" />
      <TextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
        :error="fieldErrors.password"
      />
      <BaseButton type="submit" block :loading="submitting">Sign in</BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-ink-500">
      New here?
      <RouterLink :to="{ name: 'register' }" class="font-medium text-rose-600 hover:text-rose-700">
        Create an account
      </RouterLink>
    </p>
  </div>
</template>
