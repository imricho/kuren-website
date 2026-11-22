<script setup lang="ts">
/**
 * Published invitation for guests (/i/:slug). No sign-in, no app chrome, no draft
 * or editor UI: it renders ONLY the published snapshot from
 * GET /api/v1/public/invitations/{slug}, in public mode (no placeholders, no
 * editor notes, Add to Calendar live). Works for every variant: the variant decides
 * which sections render and the renderer (an incompatible stored template falls back
 * to `temuvibe-elegant`); Temuvibe templates show the live RSVP form. `?to=<guest>`
 * personalises the opening greeting and prefills the RSVP name (sanitised text).
 * Title and description follow the variant. Asks search engines not to index the page.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ApiError } from '@/api/http'
import { publishingApi, type PublicInvitation } from '@/api/publishing'
import { useAppLocale } from '@/composables/useAppLocale'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import { sanitizeGuestName } from '@/features/themes/core/composables/useRenderMode'
import { isSectionOffered, isVariantId, variantLabel, type VariantId } from '@/features/invitation/registry'
import { normalizeDraft, toPreviewContent } from '@/features/wedding/draft'
import { formatDate } from '@/features/wedding/format'
import { templatesEn } from '@/locales/en/templates'
import { templatesId } from '@/locales/id/templates'

const props = defineProps<{ slug: string }>()
const route = useRoute()
const { t, locale: uiLocale } = useAppLocale()

type State = 'loading' | 'ready' | 'not_found' | 'error'
const state = ref<State>('loading')
const invitation = ref<PublicInvitation | null>(null)

/** Servers that predate the engine send no variant: those are weddings. */
const variant = computed<VariantId | undefined>(() => (isVariantId(invitation.value?.variant) ? invitation.value!.variant : undefined))
const content = computed(() => {
  const inv = invitation.value
  if (!inv) return null
  const locale = inv.locale === 'id' ? 'id' : 'en'
  const draft = normalizeDraft({ ...inv.content, locale })
  return toPreviewContent(draft, locale, undefined, { mode: 'public', ...(variant.value ? { variant: variant.value } : {}) }).content
})

/** Document title: the couple for couple variants, else the event title (or the variant's name). */
const pageTitle = computed(() => {
  const c = content.value
  if (!c) return ''
  const v = variant.value
  const coupleShown = (!v || isSectionOffered(v, 'couple')) && (!c.sections || c.sections.includes('couple'))
  if (coupleShown && c.opening.coupleNames.trim()) return c.opening.coupleNames.trim()
  return c.opening.weddingTitle.trim() || variantLabel(v, c.locale === 'id' ? 'id' : 'en')
})
const pageDescription = computed(() => {
  const c = content.value
  if (!c) return ''
  const dict = c.locale === 'id' ? templatesId : templatesEn
  return dict.tvPublicDescription
    .replace('{kind}', variantLabel(variant.value, c.locale === 'id' ? 'id' : 'en'))
    .replace('{date}', formatDate(c.opening.weddingDate, c.locale, 'long'))
})
const guestName = computed(() => sanitizeGuestName(route.query.to))

let loadSeq = 0
async function load() {
  const seq = ++loadSeq
  state.value = 'loading'
  try {
    const result = await publishingApi.getPublic(props.slug)
    if (seq !== loadSeq) return
    invitation.value = result
    state.value = 'ready'
  } catch (err) {
    if (seq !== loadSeq) return
    invitation.value = null
    state.value = err instanceof ApiError && err.status === 404 ? 'not_found' : 'error'
  }
}
watch(() => props.slug, () => void load(), { immediate: true })

// --- Document head: title = couple names; noindex ------------------------------------
function setTitle() {
  if (state.value === 'ready' && content.value) {
    document.title = pageTitle.value
    setMeta('description', pageDescription.value)
  } else if (state.value === 'not_found') document.title = t('publicNotFoundTitle')
}
// Runs after the router's own title update (also when the UI language changes).
watch([state, content, uiLocale], () => queueMicrotask(setTitle), { flush: 'post' })

/** Meta tags this page created or changed, restored on leave. */
const touchedMeta = new Map<HTMLMetaElement, string | null>()
function setMeta(name: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
    touchedMeta.set(el, null)
  } else if (!touchedMeta.has(el)) touchedMeta.set(el, el.content)
  el.content = value
}

let robots: HTMLMetaElement | null = null
onMounted(() => {
  robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (robots) {
    robots.dataset.previous = robots.content
    robots.content = 'noindex, nofollow'
  } else {
    robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    robots.dataset.publicInvitation = 'true'
    document.head.appendChild(robots)
  }
})
onBeforeUnmount(() => {
  for (const [el, previous] of touchedMeta) {
    if (previous === null) el.remove()
    else el.content = previous
  }
  touchedMeta.clear()
  if (!robots) return
  if (robots.dataset.publicInvitation) robots.remove()
  else if (robots.dataset.previous !== undefined) robots.content = robots.dataset.previous
})
</script>

<template>
  <main v-if="state === 'ready' && content && invitation" data-testid="public-invitation" :lang="content.locale" :data-variant="variant">
    <ThemeRenderer
      :content="content"
      :theme-id="invitation.themeId"
      mode="public"
      :guest-name="guestName"
      :variant="variant"
      :slug="slug"
      :timezone="invitation.timezone"
    />
  </main>

  <main v-else-if="state === 'not_found'" class="grid min-h-dvh place-items-center bg-canvas px-4 py-16" data-testid="public-not-found">
    <div class="max-w-md text-center">
      <h1 class="font-display text-3xl font-semibold text-ink-900">{{ t('publicNotFoundTitle') }}</h1>
      <p class="mt-3 text-ink-500">{{ t('publicNotFoundBody') }}</p>
    </div>
  </main>

  <main v-else-if="state === 'error'" class="grid min-h-dvh place-items-center bg-canvas px-4 py-16" data-testid="public-error">
    <div class="max-w-md text-center" role="alert">
      <h1 class="font-display text-2xl font-semibold text-ink-900">{{ t('publicInvitation') }}</h1>
      <p class="mt-3 text-ink-500">{{ t('publicLoadFailed') }}</p>
      <button
        type="button"
        class="mt-6 inline-flex min-h-11 items-center rounded-lg border border-ink-500/85 bg-surface px-4 font-medium text-ink-900 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        data-action="public-retry"
        @click="load"
      >
        {{ t('publicRetry') }}
      </button>
    </div>
  </main>

  <main v-else class="grid min-h-dvh place-items-center bg-canvas" data-testid="public-loading">
    <h1 class="sr-only">{{ t('publicInvitation') }}</h1>
    <span class="text-sm text-ink-500" role="status" aria-live="polite">{{ t('publicLoading') }}</span>
  </main>
</template>
