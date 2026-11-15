<script setup lang="ts">
/**
 * Website editor shell: section nav (left column on desktop, a compact chip
 * scroller on phones so the form starts right below it) and
 * the current section's page. Loads the wedding first; /wedding redirects to
 * the first incomplete section.
 */
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import SectionNav from '@/features/cms/components/SectionNav.vue'
import { sectionByKey } from '@/features/cms/sections'
import { SECTION_KEYS } from '@/features/wedding/completeness'
import { useWeddingStore } from '@/stores/wedding'

const store = useWeddingStore()
const route = useRoute()
const router = useRouter()
const { t } = useAppLocale()

onMounted(() => void store.ensureLoaded())

/** First incomplete required section edited here (theme lives in the studio), else Opening. */
function firstSectionRoute() {
  const key =
    SECTION_KEYS.find((k) => k !== 'theme' && store.completeness.sections[k].required && store.completeness.sections[k].status !== 'complete') ??
    'opening'
  return { name: sectionByKey(key).routeName }
}

watch(
  () => [store.loadState, route.name] as const,
  ([state, name]) => {
    if (state === 'ready' && name === 'wedding') void router.replace(firstSectionRoute())
  },
  { immediate: true },
)
</script>

<template>
  <div class="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
    <template v-if="store.loadState === 'ready'">
      <aside class="mb-4 min-w-0 lg:mb-0">
        <SectionNav />
      </aside>
      <div class="min-w-0">
        <RouterView />
      </div>
    </template>

    <div v-else-if="store.loadState === 'error' || store.loadState === 'none'" class="lg:col-span-2">
      <h1 class="text-3xl font-semibold">{{ t('myWebsite') }}</h1>
      <div role="alert" class="mt-6 max-w-xl rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
        <p class="font-medium">{{ t('loadFailed') }}</p>
        <p v-if="store.loadError" class="mt-1">{{ store.loadError }}</p>
        <BaseButton class="mt-4 min-h-11 sm:min-h-0" variant="secondary" data-action="retry" @click="store.reload()">
          {{ t('tryAgain') }}
        </BaseButton>
      </div>
    </div>

    <template v-else>
      <div class="mb-4 flex gap-2 overflow-hidden lg:mb-0 lg:block lg:space-y-2" aria-hidden="true">
        <div v-for="n in 8" :key="n" class="h-11 w-24 shrink-0 animate-pulse rounded-full bg-rose-50 motion-reduce:animate-none lg:w-auto lg:rounded-md" />
      </div>
      <div class="space-y-4" role="status" aria-live="polite" data-testid="editor-loading">
        <span class="sr-only">{{ t('loadingWebsite') }}</span>
        <div class="h-10 w-2/3 animate-pulse rounded-md bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
        <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
        <div class="h-40 animate-pulse rounded-[var(--radius-card)] bg-rose-50 motion-reduce:animate-none" aria-hidden="true" />
      </div>
    </template>
  </div>
</template>
