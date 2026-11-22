<script setup lang="ts">
/**
 * The couple's own website, full screen, with their LIVE content (the same
 * `store.livePreviewContent` the editor's preview renders: saved content plus
 * in-progress edits) and selected theme. Missing required values show as
 * labelled placeholders (see toPreviewContent), and the notices explain what
 * is being shown. Opened from the editor's "Full screen" button (?from=).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppLanguageSwitch from '@/components/AppLanguageSwitch.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { sectionByKey } from '@/features/cms/sections'
import { DEFAULT_THEME_ID, getTheme } from '@/features/themes/core/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import DeviceSizeControl from '@/features/themes/picker/DeviceSizeControl.vue'
import { formatTemplatePath } from '@/features/themes/picker/format'
import DevicePreview, { type Device } from '@/features/themes/preview/DevicePreview.vue'
import type { SectionKey } from '@/features/wedding/completeness'
import { safeRedirect } from '@/router/redirect'
import { useInvitationStore } from '@/stores/invitation'

const store = useInvitationStore()
const route = useRoute()
const { t } = useAppLocale()

const invitationId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))
onMounted(() => invitationId.value && void store.ensureLoaded(invitationId.value))
watch(invitationId, (id) => id && void store.ensureLoaded(id))

const editorPath = computed(() => (invitationId.value ? `/invitations/${encodeURIComponent(invitationId.value)}/edit` : '/invitations'))
const backTo = computed(() => safeRedirect(route.query.from, editorPath.value))
const hasTheme = computed(() => getTheme(store.themeId) !== undefined)
const themeId = computed(() => (hasTheme.value ? store.themeId! : DEFAULT_THEME_ID))
const theme = computed(() => getTheme(themeId.value)!)
const themePath = computed(() => formatTemplatePath(themeId.value))

/** Sections that currently show placeholders, in editor order. */
const placeholderSections = computed(() => {
  const keys = new Set<SectionKey>(store.previewMissing.map((m) => m.section))
  return [...keys].map((k) => sectionByKey(k, store.variant))
})

const device = ref<Device>('desktop')
// Phones get the real full-screen site instead of a framed preview.
const isPhone = ref(false)
let media: MediaQueryList | null = null
const onMedia = () => (isPhone.value = !!media?.matches)
onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  media = window.matchMedia('(max-width: 639px)')
  onMedia()
  media.addEventListener?.('change', onMedia)
})
onBeforeUnmount(() => media?.removeEventListener?.('change', onMedia))
</script>

<template>
  <div class="min-h-dvh bg-canvas" style="--toolbar-h: 3.5rem">
    <header class="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur" :aria-label="t('websitePreview')">
      <div class="mx-auto flex h-[var(--toolbar-h)] max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <RouterLink
          :to="backTo"
          class="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-rose-50"
          data-testid="back-to-editing"
        >
          <span aria-hidden="true">←</span><span class="max-sm:sr-only">{{ t('backToEditing') }}</span>
        </RouterLink>
        <div class="min-w-0 flex-1 truncate text-sm">
          <span class="font-medium text-ink-900" data-testid="preview-theme-name">{{ theme.name }}</span>
          <RouterLink :to="{ name: 'themes' }" class="ml-2 text-rose-700 underline underline-offset-2">
            {{ t('changeTheme') }}
          </RouterLink>
        </div>
        <DeviceSizeControl v-if="!isPhone" v-model="device" class="hidden md:inline-flex" />
        <!-- Hidden on phones so the bar fits; the language switch stays in the main app header. -->
        <span class="hidden sm:inline-flex"><AppLanguageSwitch /></span>
      </div>
    </header>

    <!-- On phones the full-page theme's hero heading is this page's h1; the framed (embedded)
         preview on larger screens announces it as level 2, so the page keeps its own h1. -->
    <h1 v-if="!(store.loadState === 'ready' && store.livePreviewContent)" class="sr-only">{{ t('websitePreview') }}</h1>

    <div v-if="store.loadState === 'ready' && store.livePreviewContent">
      <section class="mx-auto max-w-6xl space-y-2 px-3 py-3 text-sm sm:px-4" :aria-label="t('previewNotices')" data-testid="preview-notices">
        <p class="text-ink-700" data-testid="notice-saved">{{ t('previewShowsLatest') }}</p>
        <p v-if="!hasTheme" class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800" role="note" data-testid="notice-no-theme">
          {{ t('noThemeNotice', { name: theme.name }) }}
          <RouterLink :to="{ name: 'themes' }" class="font-medium underline">{{ t('chooseTheme') }}</RouterLink>
        </p>
        <div
          v-if="placeholderSections.length"
          class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800"
          role="note"
          data-testid="notice-placeholders"
        >
          {{ t('placeholdersNotice') }}
          <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <li v-for="s in placeholderSections" :key="s.key">
              <RouterLink :to="s.to" class="font-medium underline">{{ t(s.label) }}</RouterLink>
            </li>
          </ul>
        </div>
        <p v-if="themePath" class="sr-only">{{ themePath }}</p>
      </section>

      <main v-if="isPhone" :aria-label="t('websitePreview')">
        <ThemeRenderer :content="store.livePreviewContent" :theme-id="themeId" :variant="store.variant ?? undefined" :timezone="store.timezone ?? undefined" viewport-height="calc(100svh - var(--toolbar-h))" />
      </main>
      <main v-else class="h-[calc(100dvh-var(--toolbar-h)-6rem)] min-h-[32rem] px-3 pb-4 sm:px-4" :aria-label="t('websitePreview')">
        <h1 class="sr-only">{{ t('websitePreview') }}</h1>
        <DevicePreview :content="store.livePreviewContent" :theme-id="themeId" :variant="store.variant ?? undefined" :timezone="store.timezone ?? undefined" :device="device" :label="t('websitePreview')" />
      </main>
    </div>

    <div v-else-if="store.loadState === 'error' || store.loadState === 'none'" class="mx-auto max-w-xl px-4 py-10" role="alert">
      <p class="font-medium text-danger-600">{{ t('loadFailed') }}</p>
      <BaseButton class="mt-4" variant="secondary" @click="store.reload()">{{ t('tryAgain') }}</BaseButton>
    </div>
    <p v-else class="px-4 py-10 text-center text-sm text-ink-500" role="status">{{ t('loadingWebsite') }}</p>
  </div>
</template>
