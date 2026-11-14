<template>
  <div class="grid min-h-dvh lg:grid-cols-2">
    <!-- Left: quiet brand panel (hidden on small screens) -->
    <aside class="relative hidden overflow-hidden bg-rose-50 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <RouterLink to="/" class="w-fit"><BrandMark size="lg" /></RouterLink>
      <div class="max-w-md">
        <p class="font-display text-4xl leading-tight text-ink-900">
          A wedding website as thoughtful as your invitations.
        </p>
        <p class="mt-4 text-ink-500">
          Choose a theme, add your story and details, and share one beautiful link with every guest.
        </p>
      </div>
      <p class="text-xs text-ink-500">&copy; {{ new Date().getFullYear() }} Kuren</p>
      <div
        class="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border border-rose-100"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute -right-8 -bottom-40 size-96 rounded-full border border-rose-100"
        aria-hidden="true"
      />
    </aside>

    <!-- Right: form -->
    <main class="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
      <RouterLink to="/" class="mb-10 lg:hidden"><BrandMark /></RouterLink>
      <div class="w-full max-w-sm">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
</script>
