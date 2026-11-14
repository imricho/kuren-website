<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// Placeholder outline of the customer journey. Each step is delivered by a
// later workstream; nothing here is interactive yet.
const steps = [
  { title: 'Choose a theme', body: 'Pick from International, Traditional, Ethnic, Conventional or Artistic styles.' },
  { title: 'Tell your story', body: 'Fill in your couple profile, story, and event details in simple forms.' },
  { title: 'Add your photos', body: 'Upload the pictures you’d love your guests to see.' },
  { title: 'Preview & publish', body: 'See your site exactly as guests will, then share your link.' },
]
</script>

<template>
  <div class="space-y-10">
    <section>
      <p class="text-sm font-medium tracking-wide text-rose-600 uppercase">Dashboard</p>
      <h1 class="mt-2 text-4xl font-semibold sm:text-5xl">Hello, {{ auth.firstName }}</h1>
      <p class="mt-3 max-w-xl text-ink-500">
        This is where you’ll create and manage your wedding website. Here’s what the journey will look like.
      </p>
    </section>

    <section aria-labelledby="steps-heading">
      <h2 id="steps-heading" class="sr-only">Steps to your wedding website</h2>
      <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-rose-50 font-display text-lg font-semibold text-rose-600"
          >
            {{ index + 1 }}
          </span>
          <h3 class="mt-4 text-2xl font-semibold">{{ step.title }}</h3>
          <p class="mt-2 flex-1 text-sm text-ink-500">{{ step.body }}</p>
          <span class="mt-5 w-fit rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-500">
            Coming soon
          </span>
        </li>
      </ol>
    </section>
  </div>
</template>
