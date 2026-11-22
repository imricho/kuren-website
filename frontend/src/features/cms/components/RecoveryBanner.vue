<script setup lang="ts">
/**
 * Unsaved changes from an interrupted session (closed tab, crash, offline, failed save),
 * kept on this device by draftRecovery.ts. Lists every affected section of the open
 * invitation; sections whose editor is open offer Restore / Discard right here, others
 * link to their page (where the same buttons appear). Nothing is applied automatically.
 */
import { computed, nextTick, ref } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import { useAppLocale } from '@/composables/useAppLocale'
import { useAuthStore } from '@/stores/auth'
import { useInvitationStore } from '@/stores/invitation'

import { listRecoveries } from '../draftRecovery'
import { EDITOR_ROUTES } from '../editorRoutes'
import { sectionByKey } from '../sections'
import type { SectionKey } from '@/features/wedding/completeness'

const store = useInvitationStore()
const auth = useAuthStore()
const { t, locale } = useAppLocale()
const announcement = ref('')
const root = ref<HTMLElement | null>(null)

/** Draft key → editor page key ("events:session-2" → "events", "countdown" → "weddingDate"). */
function pageOf(key: string): string {
  const prefix = key.split(':')[0]!
  return prefix === 'countdown' ? 'weddingDate' : prefix
}
function labelOf(key: string): string {
  const page = pageOf(key)
  try {
    return t(sectionByKey(page as SectionKey, store.variant).label)
  } catch {
    return page
  }
}

const items = computed(() => {
  void store.recoveryVersion // re-read storage whenever an entry changes
  const userId = auth.user?.id
  const invitationId = store.invitationId
  if (!userId || !invitationId) return []
  return listRecoveries(String(userId), invitationId).map((entry) => {
    const page = pageOf(entry.key)
    const route = EDITOR_ROUTES.find((r) => r.key === page)
    return {
      ...entry,
      label: labelOf(entry.key),
      item: entry.key.includes(':'),
      handle: store.recoveryHandles.get(entry.key) ?? null,
      to: route ? { name: route.name, params: { id: invitationId } } : null,
      when: new Intl.DateTimeFormat(locale.value === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.at)),
    }
  })
})

async function act(kind: 'restore' | 'discard', item: (typeof items.value)[number]) {
  const label = item.label
  if (kind === 'restore') item.handle?.restore()
  else item.handle?.discard()
  announcement.value = t(kind === 'restore' ? 'recoveryRestored' : 'recoveryDiscarded', { section: label })
  await nextTick()
  root.value?.focus()
}

const button = ['inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium sm:min-h-9', FOCUS_RING]
</script>

<template>
  <section v-if="items.length" ref="root" tabindex="-1" class="mb-5 rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="region" :aria-label="t('recoveryTitle')" data-testid="recovery-banner">
    <h2 class="font-semibold">{{ t('recoveryTitle') }}</h2>
    <p class="mt-1">{{ t('recoveryIntro') }}</p>
    <ul class="mt-3 space-y-2">
      <li v-for="item in items" :key="item.key" class="flex flex-wrap items-center gap-x-3 gap-y-1" :data-recovery="item.key">
        <span><strong>{{ item.label }}</strong> · {{ t('recoveryFrom', { when: item.when }) }}</span>
        <template v-if="item.handle">
          <span v-if="item.handle.stale" class="w-full text-xs">{{ t('recoveryStale') }}</span>
          <button type="button" :class="[...button, 'bg-[var(--tv-plum)] text-white hover:bg-[var(--tv-plum-soft)]']" data-action="restore-recovery" @click="act('restore', item)">{{ t('recoveryRestore') }}</button>
          <button type="button" :class="[...button, 'border border-amber-700/40 bg-white hover:bg-amber-100']" data-action="discard-recovery" @click="act('discard', item)">{{ t('recoveryDiscard') }}</button>
        </template>
        <RouterLink v-else-if="item.to" :to="item.to" :class="[...button, 'underline underline-offset-2']" data-action="open-recovery">
          {{ item.item ? t('recoveryOpenItem') : t('recoveryOpen') }}
        </RouterLink>
      </li>
    </ul>
    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </section>
</template>
