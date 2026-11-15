<script setup lang="ts">
/**
 * Artistic — contemporary and expressive.
 * Asymmetric grids, oversized display type, collage-style images, one vivid
 * accent. Body text stays at comfortable sizes and contrast for readability.
 */
import UniversalSection from '../core/components/UniversalSection.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { vReveal } from '../core/directives/reveal'
import { useHeroHeading } from '../core/composables/useHeroHeading'
import type { ThemeProps } from '../core/types'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const heroHeading = useHeroHeading()
const view = useWeddingView(props)

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <article class="t-art" :data-variant="config?.variant ?? 'gallery-bold'">
    <!-- Opening -->
    <header data-section="opening" class="art-hero">
      <p class="art-hero__vertical" aria-hidden="true">{{ view.date.short }}</p>
      <h1 v-bind="heroHeading" class="art-hero__names">
        <span class="art-hero__first">{{ content.couple.groom.name.split(' ')[0] }}</span>
        <span class="art-hero__amp">&amp;</span>
        <span class="art-hero__second">{{ content.couple.bride.name.split(' ')[0] }}</span>
      </h1>
      <div v-if="content.opening.coverImage" class="art-hero__media">
        <span class="art-block" aria-hidden="true" />
        <div class="art-hero__photo"><ThemeImage :image="content.opening.coverImage" eager /></div>
      </div>
      <div class="art-hero__meta">
        <p class="art-mono">{{ view.t.weddingOf }}</p>
        <p class="art-hero__date">{{ view.date.full }}</p>
        <svg class="art-squiggle" viewBox="0 0 160 20" aria-hidden="true">
          <path d="M2 10 C20 0 30 20 48 10 S78 0 96 10 S126 20 158 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
    </header>

    <UniversalSection section="holyRecite1" :content="content" class="art-section" />

    <section v-if="view.greeting" data-section="greeting" class="art-section art-intro">
      <div class="art-intro__grid">
        <h2 v-if="view.greeting?.title" v-reveal class="art-statement">{{ view.greeting?.title }}</h2>
        <div v-reveal class="art-intro__aside">
          <p class="art-mono">{{ content.opening.weddingTitle }}</p>
          <p v-if="view.greeting?.message" class="art-body art-body--large">{{ view.greeting?.message }}</p>
        </div>
      </div>
    </section>

    <!-- Couple -->
    <section data-section="couple" class="art-section art-couple" aria-label="The couple">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <figure
        v-for="(person, i) in [content.couple.groom, content.couple.bride]"
        :key="i"
        v-reveal
        class="art-person"
        :class="`art-person--${i === 0 ? 'a' : 'b'}`"
      >
        <div v-if="person.image" class="art-person__photo"><ThemeImage :image="person.image" /></div>
        <figcaption class="art-person__caption">
          <p class="art-mono">{{ i === 0 ? view.t.groom : view.t.bride }}</p>
          <h3 class="art-person__name">{{ person.name }}</h3>
          <p v-if="person.parents" class="art-body" data-role="parents" style="font-style: italic">{{ person.parents }}</p>
          <p v-if="person.description" class="art-body">{{ person.description }}</p>
        </figcaption>
      </figure>
    </section>

    <!-- Events -->
    <UniversalSection section="date" :content="content" class="art-section" />

    <section data-section="events" class="art-section art-events">
      <header v-reveal class="art-heading">
        <p class="art-mono">{{ view.t.saveTheDate }}</p>
        <h2 class="art-title">{{ view.date.long }}</h2>
      </header>
      <div class="art-events__list">
        <div v-for="event in view.events" :key="event.id" v-reveal class="art-event">
          <p class="art-event__day" aria-hidden="true">{{ event.dateParts.dayPadded }}</p>
          <div class="art-event__body">
            <p class="art-mono art-accent">{{ event.typeLabel }}</p>
            <h3 class="art-event__title">{{ event.title }}</h3>
            <dl class="art-event__facts">
              <div>
                <dt class="art-mono">{{ view.t.when }}</dt>
                <dd>{{ event.dateText }}<br />{{ event.timeText }}</dd>
              </div>
              <div>
                <dt class="art-mono">{{ view.t.venue }}</dt>
                <dd>
                  <strong>{{ event.venueName }}</strong><br />{{ event.address }}
                </dd>
              </div>
            </dl>
            <p v-if="event.description" class="art-body">{{ event.description }}</p>
            <a class="art-link" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }} ↗</a>
          </div>
        </div>
      </div>
    </section>

    <section data-section="story" v-if="view.story" class="art-section art-story">
      <header v-reveal class="art-heading">
        <h2 class="art-title">{{ view.story.title }}</h2>
        <p v-if="view.story.introduction" class="art-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="art-chapters">
        <li v-for="(entry, i) in view.story.timeline" :key="entry.id" v-reveal class="art-chapter">
          <span class="art-chapter__num" aria-hidden="true">{{ pad(i + 1) }}</span>
          <div v-if="entry.image" class="art-chapter__photo"><ThemeImage :image="entry.image" /></div>
          <div class="art-chapter__text">
            <p v-if="entry.date" class="art-mono art-accent">{{ entry.date }}</p>
            <h3 class="art-chapter__title">{{ entry.title }}</h3>
            <p class="art-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- Gallery -->
    <section data-section="gallery" v-if="view.gallery" class="art-section art-gallery">
      <header v-reveal class="art-heading">
        <h2 class="art-title">{{ view.gallery.title }}</h2>
        <p v-if="view.gallery.description" class="art-body">{{ view.gallery.description }}</p>
      </header>
      <div class="art-gallery__grid">
        <figure v-for="(image, i) in view.gallery.images" :key="image.id" v-reveal class="art-fig">
          <div class="art-fig__img"><ThemeImage :image="image" /></div>
          <figcaption class="art-mono">
            <span class="art-accent">fig. {{ pad(i + 1) }}</span>
            <template v-if="image.caption"> — {{ image.caption }}</template>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- RSVP -->
    <section v-if="content.rsvp.enabled" data-section="rsvp" class="art-section art-rsvp">
      <div class="art-rsvp__grid">
        <h2 v-reveal class="art-rsvp__big">{{ content.rsvp.title }}</h2>
        <div v-reveal class="art-rsvp__form">
          <p v-if="content.rsvp.introduction" class="art-body art-body--large">{{ content.rsvp.introduction }}</p>
          <RsvpPreview :content="content" />
        </div>
      </div>
    </section>

    <!-- Closing -->
    <UniversalSection section="wishes" :content="content" class="art-section" />
    <UniversalSection section="amplopDigital" :content="content" class="art-section" />
    <UniversalSection section="holyRecite2" :content="content" class="art-section" />

    <footer data-section="closing" class="art-section art-closing">
      <div v-if="content.closing.image" class="art-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="art-closing__text">
        <p class="art-statement art-statement--small">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="art-mono art-accent">{{ content.closing.thankYou }}</p>
        <p class="art-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
