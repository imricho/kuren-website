<script setup lang="ts">
/**
 * Invitation list — the signed-in home. One card per invitation (newest-updated
 * first): name, variant, template, publish status, event date, the public link
 * with a copy button, and Edit / Preview / Responses / Delete. Deleting asks first,
 * naming the invitation and saying its RSVP replies go too. No invitations yet →
 * an empty state that starts the wizard.
 */
import { computed, onMounted } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import { FOCUS_RING } from '@/components/ui/styles'
import { localizedCatalogText, useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/features/cms/composables/useConfirm'
import { invitationName, publicUrlOf, publishStateOf, type InvitationPublishState } from '@/features/invitation/catalog'
import { variantOf } from '@/features/invitation/registry'
import { getTheme } from '@/features/themes/core/registry'
import { isIsoDate } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { useInvitationsStore } from '@/stores/invitations'
import type { InvitationSummary } from '@/api/invitations'

const list = useInvitationsStore()
const { t, locale } = useAppLocale()
const toast = useToast()
const confirm = useConfirm()

onMounted(() => void list.load())

const STATUS: Record<InvitationPublishState, { label: AppMessageKey; tone: string }> = {
  draft: { label: 'statusDraft', tone: 'bg-canvas text-ink-700 ring-line' },
  published: { label: 'statusPublished', tone: 'bg-success-50 text-success-600 ring-success-600/30' },
  unpublished_changes: { label: 'statusUnpublishedChanges', tone: 'bg-[var(--tv-gold-soft)] text-[#6b4a12] ring-[var(--tv-gold)]/60' },
}

const cards = computed(() =>
  list.items.map((inv) => {
    const theme = getTheme(inv.themeId)
    return {
      inv,
      name: invitationName(inv, locale.value),
      variant: variantOf(inv.variant).label[locale.value],
      template: theme ? localizedCatalogText(theme.id, 'name', theme.name) : t('noTemplateYet'),
      thumbnail: theme?.previewImage,
      state: publishStateOf(inv),
      date: isIsoDate(inv.eventDate ?? undefined) ? formatDate(inv.eventDate!, locale.value, 'long') : null,
      url: inv.status === 'published' ? publicUrlOf(inv.slug) : null,
    }
  }),
)

async function copy(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success(t('linkCopied'))
  } catch {
    toast.error(t('linkCopyFailed'))
  }
}

async function remove(inv: InvitationSummary, name: string) {
  const ok = await confirm.ask({
    title: t('deleteInvitationTitle', { name }),
    message: t('deleteInvitationBody'),
    confirmLabel: t('deleteInvitation'),
    cancelLabel: t('cancel'),
    tone: 'danger',
  })
  if (!ok) return
  try {
    await list.remove(inv.id)
    toast.success(t('invitationDeleted', { name }))
  } catch {
    toast.error(t('invitationDeleteFailed', { name }))
  }
}

const action = ['inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium sm:min-h-9', FOCUS_RING]
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6" data-testid="invitations-page">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">{{ t('invitations') }}</h1>
        <p class="mt-1 text-sm text-ink-700">{{ t('invitationsIntro') }}</p>
      </div>
      <RouterLink
        v-if="list.items.length"
        :to="{ name: 'invitation-new' }"
        :class="['inline-flex min-h-11 items-center rounded-full bg-[var(--tv-plum)] px-5 text-sm font-semibold text-white hover:bg-[var(--tv-plum-soft)]', FOCUS_RING]"
        data-action="create-invitation"
      >
        {{ t('createInvitation') }}
      </RouterLink>
    </header>

    <div v-if="list.loadState === 'error'" role="alert" class="rounded-[var(--radius-card)] border border-danger-600/30 bg-danger-50 p-6 text-sm text-danger-600">
      <p class="font-medium">{{ t('invitationsLoadFailed') }}</p>
      <BaseButton class="mt-3" variant="secondary" data-action="retry" @click="list.load()">{{ t('tryAgain') }}</BaseButton>
    </div>
    <p v-else-if="list.loadState !== 'ready'" role="status" class="text-sm text-ink-500" data-testid="invitations-loading">{{ t('loadingInvitations') }}</p>

    <section
      v-else-if="list.items.length === 0"
      class="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-soft)]"
      data-testid="invitations-empty"
    >
      <h2 class="font-display text-2xl font-semibold">{{ t('invitationsEmptyTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-ink-700">{{ t('invitationsEmptyBody') }}</p>
      <RouterLink
        :to="{ name: 'invitation-new' }"
        :class="['mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--tv-plum)] px-6 text-sm font-semibold text-white hover:bg-[var(--tv-plum-soft)]', FOCUS_RING]"
        data-action="create-invitation"
      >
        {{ t('createInvitation') }}
      </RouterLink>
    </section>

    <ul v-else class="grid gap-4 md:grid-cols-2" data-testid="invitation-cards">
      <li
        v-for="c in cards"
        :key="c.inv.id"
        class="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]"
        :data-invitation="c.inv.id"
      >
        <div class="flex min-w-0 gap-4 p-4">
          <img v-if="c.thumbnail" :src="c.thumbnail" alt="" class="h-20 w-16 shrink-0 rounded-md border border-line object-cover" />
          <div v-else class="h-20 w-16 shrink-0 rounded-md bg-[var(--tv-plum)]" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium tracking-wide text-[var(--tv-plum-soft)] uppercase" data-testid="card-variant">{{ c.variant }}</p>
            <h2 class="truncate font-display text-xl font-semibold" data-testid="card-name">{{ c.name }}</h2>
            <p class="truncate text-sm text-ink-700" data-testid="card-template">{{ c.template }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span :class="['rounded-full px-2 py-0.5 font-medium ring-1', STATUS[c.state].tone]" :data-state="c.state" data-testid="card-status">
                {{ t(STATUS[c.state].label) }}
              </span>
              <span v-if="c.date" class="text-ink-500" data-testid="card-date">{{ c.date }}</span>
            </div>
          </div>
        </div>
        <div v-if="c.url" class="flex min-w-0 items-center gap-2 border-t border-line px-4 py-2 text-sm">
          <a :href="c.url" target="_blank" rel="noopener noreferrer" class="min-w-0 flex-1 truncate text-rose-700 underline underline-offset-2" data-testid="card-url">{{ c.url }}</a>
          <button type="button" :class="[action, 'text-ink-700 hover:bg-rose-50']" :aria-label="t('copyLinkFor', { name: c.name })" data-action="copy-link" @click="copy(c.url)">
            {{ t('copyLink') }}
          </button>
        </div>
        <nav class="mt-auto flex flex-wrap gap-1 border-t border-line bg-canvas/60 px-2 py-2" :aria-label="t('invitationActions', { name: c.name })">
          <RouterLink :to="{ name: 'editor', params: { id: c.inv.id } }" :class="[action, 'text-[var(--tv-plum)] hover:bg-rose-50']" data-action="edit">{{ t('edit') }}</RouterLink>
          <RouterLink :to="{ name: 'invitation-preview', params: { id: c.inv.id }, query: { from: '/invitations' } }" :class="[action, 'text-ink-700 hover:bg-rose-50']" data-action="preview">{{ t('preview') }}</RouterLink>
          <RouterLink :to="{ name: 'invitation-responses', params: { id: c.inv.id } }" :class="[action, 'text-ink-700 hover:bg-rose-50']" data-action="responses">{{ t('responses') }}</RouterLink>
          <button type="button" :class="[action, 'ml-auto text-danger-600 hover:bg-danger-50']" :aria-label="t('deleteNamed', { name: c.name })" data-action="delete" @click="remove(c.inv, c.name)">
            {{ t('delete') }}
          </button>
        </nav>
      </li>
    </ul>
  </div>
</template>
