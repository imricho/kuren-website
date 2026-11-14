<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import FormAlert from '@/components/ui/FormAlert.vue'
import TextField from '@/components/ui/TextField.vue'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth'

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
    <h1 class="text-4xl font-semibold">Create your account</h1>
    <p class="mt-2 text-sm text-ink-500">Start building your wedding website. It only takes a minute.</p>

    <form class="mt-8 space-y-5" novalidate @submit.prevent="onSubmit">
      <FormAlert v-if="formError">{{ formError }}</FormAlert>
      <TextField
        v-model="fullName"
        label="Your name"
        autocomplete="name"
        required
        :error="fieldErrors.full_name"
      />
      <TextField v-model="email" label="Email" type="email" autocomplete="email" required :error="fieldErrors.email" />
      <TextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="new-password"
        hint="At least 8 characters."
        required
        :error="fieldErrors.password"
      />
      <BaseButton type="submit" block :loading="submitting">Create account</BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-ink-500">
      Already have an account?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-rose-600 hover:text-rose-700">Sign in</RouterLink>
    </p>
  </div>
</template>
