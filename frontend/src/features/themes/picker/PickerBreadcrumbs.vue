<script setup lang="ts">
import type { ThemeCollection, ThemeFamily } from '../core/types'

defineProps<{ family?: ThemeFamily; collection?: ThemeCollection }>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="text-sm">
    <ol class="flex flex-wrap items-center gap-1.5 text-ink-500">
      <li>
        <RouterLink :to="{ name: 'themes' }" class="hover:text-ink-900">Themes</RouterLink>
      </li>
      <template v-if="family">
        <li aria-hidden="true">/</li>
        <li>
          <RouterLink
            v-if="collection"
            :to="{ name: 'theme-family', params: { familyId: family.id } }"
            class="hover:text-ink-900"
          >
            {{ family.name }}
          </RouterLink>
          <span v-else aria-current="page" class="font-medium text-ink-900">{{ family.name }}</span>
        </li>
      </template>
      <template v-if="collection">
        <li aria-hidden="true">/</li>
        <li aria-current="page" class="font-medium text-ink-900">{{ collection.name }}</li>
      </template>
    </ol>
  </nav>
</template>
