<script setup lang="ts">
/**
 * Temuvibe: ONE schema-driven renderer for every invitation variant (contract §5).
 * It renders, in canonical order, only the sections the variant offers
 * (`content.sections`) that are enabled and have content — no gaps, no orphan
 * headings, no fields a variant does not use. The four presets differ only by design
 * tokens (presets.ts), applied as `--tv-*` custom properties on the root.
 */
import { computed } from 'vue'

import type { SectionId } from '@/features/invitation/registry'

import UniversalSection from '../core/components/UniversalSection.vue'
import { useIsDraftRender, useRenderContext } from '../core/composables/useRenderMode'
import type { ThemeProps } from '../core/types'
import { provideTv } from './context'
import { temuvibePreset, tokenStyle } from './presets'
import TvAgenda from './sections/TvAgenda.vue'
import TvClosing from './sections/TvClosing.vue'
import TvCouple from './sections/TvCouple.vue'
import TvDate from './sections/TvDate.vue'
import TvGallery from './sections/TvGallery.vue'
import TvGreeting from './sections/TvGreeting.vue'
import TvHero from './sections/TvHero.vue'
import TvMilestone from './sections/TvMilestone.vue'
import TvOrganization from './sections/TvOrganization.vue'
import TvProfiles from './sections/TvProfiles.vue'
import TvRsvp from './sections/TvRsvp.vue'
import TvSessions from './sections/TvSessions.vue'
import TvSpeakers from './sections/TvSpeakers.vue'
import TvStory from './sections/TvStory.vue'
import { visibleSections } from './visibleSections'
import { isCorporate, joinNames, kickerKey, resolveVariant, tvTranslator } from './wording'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const isDraft = useIsDraftRender()
const render = useRenderContext()

const preset = computed(() => temuvibePreset(props.config?.variant))
const locale = computed(() => (props.content.locale === 'id' ? 'id' : 'en') as 'en' | 'id')
const variant = computed(() => resolveVariant(render.variant.value, props.content))
const t = computed(() => tvTranslator(locale.value))
provideTv({ t, locale, variant, preset, isDraft })

const sections = computed(() => visibleSections(props.content))
const shows = (id: SectionId) => sections.value.includes(id)
const UNIVERSAL = new Set<SectionId>(['holyRecite1', 'holyRecite2', 'wishes', 'amplopDigital'])

const couple = computed(() => shows('couple'))
const profileNames = computed(() => (shows('profiles') ? (props.content.profiles?.people ?? []).map((p) => p.nickname || p.name) : []))
const orgName = computed(() => (shows('organization') ? props.content.organization?.name?.trim() : undefined))

/** h1: the couple for couple variants; otherwise the event title, then the people, the organisation, the kind. */
const title = computed(() => {
  const o = props.content.opening
  if (couple.value && o.coupleNames.trim()) return o.coupleNames.trim()
  return o.weddingTitle.trim() || joinNames(profileNames.value, locale.value) || orgName.value || t.value(kickerKey(variant.value))
})
const kicker = computed(() => {
  const o = props.content.opening
  if (couple.value && o.weddingTitle.trim() && o.weddingTitle.trim() !== title.value) return o.weddingTitle.trim()
  return t.value(kickerKey(variant.value))
})
/** Under a generic event title, name the people being celebrated. */
const subtitle = computed(() => {
  if (couple.value || !profileNames.value.length) return undefined
  const names = joinNames(profileNames.value, locale.value)
  return title.value.includes(names) ? undefined : names
})
const signature = computed(() => {
  if (couple.value) return props.content.opening.coupleNames.trim() || undefined
  return orgName.value || (profileNames.value.length ? joinNames(profileNames.value, locale.value) : undefined)
})
const showLogo = computed(() => isCorporate(variant.value) && shows('organization'))
const style = computed(() => tokenStyle(preset.value.tokens))
</script>

<template>
  <article class="t-tv" :data-variant="preset.id" :data-hero="preset.hero" :data-variant-kind="variant" :style="style" :lang="locale">
    <template v-for="(id, index) in sections" :key="id">
      <TvHero v-if="id === 'opening'" :content="content" :title="title" :kicker="kicker" :subtitle="subtitle" :show-logo="showLogo" />
      <UniversalSection v-else-if="UNIVERSAL.has(id)" :section="id as 'holyRecite1' | 'holyRecite2' | 'wishes' | 'amplopDigital'" :content="content" class="tv-section tv-universal" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvGreeting v-else-if="id === 'greeting'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvCouple v-else-if="id === 'couple'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvProfiles v-else-if="id === 'profiles'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvOrganization v-else-if="id === 'organization'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvMilestone v-else-if="id === 'milestone'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvDate v-else-if="id === 'countdown'" :content="content" :calendar-title="title" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvSessions v-else-if="id === 'events'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvAgenda v-else-if="id === 'agenda'" :content="content" :speakers-shown="shows('speakers')" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvSpeakers v-else-if="id === 'speakers'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvStory v-else-if="id === 'story'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvGallery v-else-if="id === 'gallery'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvRsvp v-else-if="id === 'rsvp'" :content="content" :class="{ 'tv-band': index % 2 === 0 }" />
      <TvClosing v-else-if="id === 'closing'" :content="content" :signature="signature" />
    </template>
  </article>
</template>
