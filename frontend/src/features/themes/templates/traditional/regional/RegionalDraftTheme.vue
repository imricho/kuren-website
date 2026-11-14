<script setup lang="ts">
/**
 * Regional draft renderer — powers the 12 regional Traditional draft templates.
 *
 * Each template passes a RegionalDraftConfig (palette, type, composition,
 * material texture, section layouts). Designs deliberately use only safer cues:
 * composition, generic material texture, typography and a provisional palette.
 * No cultural motifs, sacred symbols or named textile patterns are drawn here;
 * those are added only after cultural review (see the collection's brief).
 *
 * Every render shows a "Draft — cultural review pending" notice in normal flow
 * (never overlaid on content).
 */
import { computed } from 'vue'

import CountdownTimer from '../../../core/components/CountdownTimer.vue'
import RsvpPreview from '../../../core/components/RsvpPreview.vue'
import ThemeImage from '../../../core/components/ThemeImage.vue'
import { useWeddingView } from '../../../core/composables/useWeddingView'
import { vReveal } from '../../../core/directives/reveal'
import type { ThemeProps } from '../../../core/types'
import { isRegionalDraftConfig, type RegionalDraftConfig } from './config'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const view = useWeddingView(props)

const FALLBACK: RegionalDraftConfig = {
  draft: true,
  directionLabel: 'Regional draft',
  palette: {
    bg: '#F4F1EA',
    surface: '#FFFFFF',
    ink: '#2B2825',
    muted: '#6E675F',
    accent: '#7A6A55',
    accentSoft: '#E6DFD3',
    line: '#D8D1C5',
    heroBg: '#E9E3D8',
    heroInk: '#2B2825',
    texture: 'rgb(0 0 0 / 0.06)',
  },
  fonts: { display: 'Georgia, serif', body: 'system-ui, sans-serif', displayWeight: 400, displayCase: 'none', tracking: '0' },
  hero: 'framed',
  couple: 'pair',
  events: 'ledger',
  gallery: 'grid',
  texture: 'linen',
  divider: 'rule',
  corner: 'square',
}

const cfg = computed<RegionalDraftConfig>(() => (isRegionalDraftConfig(props.config) ? props.config : FALLBACK))

const vars = computed(() => {
  const { palette: p, fonts: f, corner } = cfg.value
  return {
    '--rd-bg': p.bg,
    '--rd-surface': p.surface,
    '--rd-ink': p.ink,
    '--rd-muted': p.muted,
    '--rd-accent': p.accent,
    '--rd-accent-soft': p.accentSoft,
    '--rd-line': p.line,
    '--rd-hero-bg': p.heroBg,
    '--rd-hero-ink': p.heroInk,
    '--rd-tx': p.texture,
    '--rd-display': f.display,
    '--rd-body': f.body,
    '--rd-display-weight': String(f.displayWeight),
    '--rd-display-case': f.displayCase,
    '--rd-tracking': f.tracking,
    '--rd-radius': corner === 'round' ? '1.5rem' : corner === 'soft' ? '0.5rem' : '0',
    '--placeholder-bg': p.accentSoft,
  }
})

const first = (name: string) => name.split(' ')[0]
const people = computed(() => [
  { role: view.value.t.groom, person: props.content.couple.groom },
  { role: view.value.t.bride, person: props.content.couple.bride },
])
</script>

<template>
  <article
    class="t-rd"
    :style="vars"
    :data-hero="cfg.hero"
    :data-couple="cfg.couple"
    :data-events="cfg.events"
    :data-gallery="cfg.gallery"
    :data-texture="cfg.texture"
  >
    <!-- Draft notice: in normal flow, never covering content -->
    <p class="rd-draft" role="note" data-testid="draft-notice">
      <strong>Draft — cultural review pending.</strong>
      {{ cfg.directionLabel }}. Not culturally verified or approved for use.
    </p>

    <!-- ===== Opening ===== -->
    <header class="rd-hero" :class="`rd-hero--${cfg.hero}`">
      <div v-if="cfg.hero === 'bands'" class="rd-band rd-tex" aria-hidden="true" />

      <div class="rd-hero__inner">
        <div v-if="content.opening.coverImage" class="rd-hero__media">
          <ThemeImage :image="content.opening.coverImage" eager />
        </div>
        <div v-if="cfg.hero === 'split'" class="rd-hero__spine rd-tex" aria-hidden="true" />
        <div class="rd-hero__text">
          <p class="rd-eyebrow">{{ view.t.weddingOf }}</p>
          <h1 class="rd-hero__names">
            <span>{{ cfg.hero === 'type' ? first(content.couple.groom.name) : content.couple.groom.name }}</span>
            <span class="rd-amp" aria-hidden="true">&amp;</span>
            <span class="sr-only">and</span>
            <span>{{ cfg.hero === 'type' ? first(content.couple.bride.name) : content.couple.bride.name }}</span>
          </h1>
          <span class="rd-divider" :class="`rd-divider--${cfg.divider}`" aria-hidden="true">
            <svg v-if="cfg.divider === 'sprig'" viewBox="0 0 120 16"><path d="M2 8h116M60 8c-8-7-18-7-24-4M60 8c8-7 18-7 24-4M60 8c-8 7-18 7-24 4M60 8c8 7 18 7 24 4" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
          </span>
          <p class="rd-hero__date">{{ view.date.full }}</p>
        </div>
      </div>

      <div v-if="cfg.hero === 'bands'" class="rd-band rd-tex" aria-hidden="true" />
    </header>

    <section class="rd-section rd-intro">
      <div v-reveal class="rd-narrow">
        <p class="rd-eyebrow">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="content.opening.headline" class="rd-title">{{ content.opening.headline }}</h2>
        <p v-if="content.opening.introduction" class="rd-lead">{{ content.opening.introduction }}</p>
        <CountdownTimer :content="content" />
      </div>
    </section>

    <!-- ===== Couple ===== -->
    <section class="rd-section rd-couple rd-tex-soft" :class="`rd-couple--${cfg.couple}`" aria-label="The couple">
      <div class="rd-wide rd-couple__grid">
        <figure v-for="(p, i) in people" :key="i" v-reveal class="rd-person">
          <div v-if="p.person.image" class="rd-person__photo"><ThemeImage :image="p.person.image" /></div>
          <figcaption class="rd-person__text">
            <p class="rd-eyebrow">{{ p.role }}</p>
            <h3 class="rd-person__name">{{ p.person.name }}</h3>
            <p v-if="p.person.description" class="rd-body">{{ p.person.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- ===== Story ===== -->
    <section v-if="view.story" class="rd-section rd-story">
      <div class="rd-wide">
        <header v-reveal class="rd-heading">
          <h2 class="rd-title">{{ view.story.title }}</h2>
          <p v-if="view.story.introduction" class="rd-body">{{ view.story.introduction }}</p>
        </header>
        <ol class="rd-story__list">
          <li v-for="entry in view.story.timeline" :key="entry.id" v-reveal class="rd-story__item">
            <div v-if="entry.image" class="rd-story__photo"><ThemeImage :image="entry.image" /></div>
            <div class="rd-story__text">
              <p v-if="entry.date" class="rd-eyebrow rd-accent">{{ entry.date }}</p>
              <h3 class="rd-story__title">{{ entry.title }}</h3>
              <p class="rd-body">{{ entry.description }}</p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- ===== Events ===== -->
    <section class="rd-section rd-events" :class="`rd-events--${cfg.events}`">
      <div class="rd-wide">
        <header v-reveal class="rd-heading rd-heading--center">
          <p class="rd-eyebrow">{{ view.t.saveTheDate }}</p>
          <h2 class="rd-title">{{ view.date.long }}</h2>
        </header>
        <div class="rd-events__list">
          <div v-for="event in view.events" :key="event.id" v-reveal class="rd-event">
            <div class="rd-event__head">
              <p class="rd-eyebrow rd-accent">{{ event.typeLabel }}</p>
              <h3 class="rd-event__title">{{ event.title }}</h3>
            </div>
            <div class="rd-event__body">
              <p class="rd-event__when">{{ event.dateText }}<br />{{ event.timeText }}</p>
              <p class="rd-event__venue">{{ event.venueName }}</p>
              <p class="rd-body">{{ event.address }}</p>
              <p v-if="event.description" class="rd-body rd-event__note">{{ event.description }}</p>
              <a class="rd-button" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }}</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Gallery ===== -->
    <section v-if="view.gallery" class="rd-section rd-gallery" :class="`rd-gallery--${cfg.gallery}`">
      <div class="rd-wide">
        <header v-reveal class="rd-heading">
          <h2 class="rd-title">{{ view.gallery.title }}</h2>
          <p v-if="view.gallery.description" class="rd-body">{{ view.gallery.description }}</p>
        </header>
        <div class="rd-gallery__items">
          <figure v-for="image in view.gallery.images" :key="image.id" class="rd-gallery__item">
            <div class="rd-gallery__frame"><ThemeImage :image="image" /></div>
            <figcaption v-if="image.caption" class="rd-caption">{{ image.caption }}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- ===== RSVP (disabled sample) ===== -->
    <section class="rd-section rd-rsvp rd-tex-soft">
      <div v-reveal class="rd-narrow rd-panel">
        <h2 class="rd-title">{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="rd-lead">{{ content.rsvp.introduction }}</p>
        <RsvpPreview :content="content" />
      </div>
    </section>

    <!-- ===== Closing ===== -->
    <footer class="rd-closing">
      <div class="rd-band rd-tex" aria-hidden="true" />
      <div v-if="content.closing.image" class="rd-closing__media"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="rd-narrow rd-closing__text">
        <p class="rd-lead">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="rd-closing__thanks">{{ content.closing.thankYou }}</p>
        <p class="rd-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
