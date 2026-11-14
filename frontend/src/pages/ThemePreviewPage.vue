<script setup lang="ts">
/** Full-screen preview: the theme exactly as guests will see it, plus a small control bar. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { DEFAULT_THEME_ID, THEMES, getTheme } from '@/features/themes/core/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import { sampleWedding } from '@/features/wedding/sampleWedding'
import { useThemeSelectionStore } from '@/stores/themeSelection'

const props = defineProps<{ themeId: string }>()
const router = useRouter()
const selection = useThemeSelectionStore()

const fellBack = ref(false)
watch(
  () => props.themeId,
  () => (fellBack.value = false),
)
const activeId = computed(() => getTheme(props.themeId)?.id ?? DEFAULT_THEME_ID)
const activeName = computed(() => getTheme(activeId.value)!.name)

function switchTo(id: string) {
  router.replace({ name: 'theme-preview', params: { themeId: id } })
}
</script>

<template>
  <div class="min-h-dvh">
    <ThemeRenderer :content="sampleWedding" :theme-id="themeId" @fallback="fellBack = true" />

    <div
      class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      role="region"
      aria-label="Preview controls"
    >
      <div
        class="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 text-sm shadow-[var(--shadow-soft)] backdrop-blur"
      >
        <RouterLink :to="{ name: 'themes' }" class="rounded-lg px-3 py-2 font-medium text-ink-700 hover:bg-rose-50">
          ← Themes
        </RouterLink>
        <label class="sr-only" for="fs-theme">Theme</label>
        <select
          id="fs-theme"
          :value="activeId"
          class="rounded-lg border border-line bg-surface px-2.5 py-2"
          @change="switchTo(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="theme in THEMES" :key="theme.id" :value="theme.id">{{ theme.name }}</option>
        </select>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-3 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-60"
          :disabled="selection.selectedThemeId === activeId"
          @click="selection.select(activeId)"
        >
          {{ selection.selectedThemeId === activeId ? 'Selected' : 'Use this theme' }}
        </button>
        <p v-if="fellBack" class="w-full px-2 pb-1 text-xs text-danger-600" role="status">
          Theme "{{ themeId }}" doesn't exist — showing {{ activeName }} instead.
        </p>
      </div>
    </div>
  </div>
</template>
