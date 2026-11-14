<script setup lang="ts">
/**
 * Woven Indigo — an original abstract geometric design direction.
 * Patterns and palette come from the active motif set (motifs/), so alternate
 * original pattern systems can be added without touching this layout.
 */
import CountdownTimer from '../core/components/CountdownTimer.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { vReveal } from '../core/directives/reveal'
import type { ThemeProps } from '../core/types'
import { activeMotifSet } from './motifs'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const view = useWeddingView(props)
</script>

<template>
  <article class="t-eth" :style="activeMotifSet.cssVars" :data-motif="activeMotifSet.id" :data-variant="config?.variant ?? 'woven-indigo'">
    <!-- Opening -->
    <header class="eth-hero">
      <div v-if="content.opening.coverImage" class="eth-hero__media">
        <ThemeImage :image="content.opening.coverImage" eager />
      </div>
      <div class="eth-hero__panel">
        <p class="eth-label">{{ view.t.weddingOf }}</p>
        <h1 class="eth-hero__names">
          {{ content.couple.groom.name.split(' ')[0] }}
          <span class="eth-hero__amp">&amp;</span>
          {{ content.couple.bride.name.split(' ')[0] }}
        </h1>
        <div class="eth-band eth-band--short" aria-hidden="true" />
        <p class="eth-hero__date">
          <span class="eth-hero__day">{{ view.date.parts.dayPadded }}</span>
          <span>{{ view.date.parts.month }}<br />{{ view.date.parts.year }}</span>
        </p>
      </div>
    </header>

    <section class="eth-section eth-intro">
      <div v-reveal class="eth-col">
        <p class="eth-label eth-label--dark">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="content.opening.headline" class="eth-title">{{ content.opening.headline }}</h2>
        <p v-if="content.opening.introduction" class="eth-lead">{{ content.opening.introduction }}</p>
        <CountdownTimer :content="content" />
      </div>
    </section>

    <div class="eth-band" aria-hidden="true" />

    <!-- Couple -->
    <section class="eth-section eth-couple" aria-label="The couple">
      <div class="eth-couple__grid">
        <figure
          v-for="(person, i) in [content.couple.groom, content.couple.bride]"
          :key="i"
          v-reveal
          class="eth-person"
        >
          <div v-if="person.image" class="eth-person__frame"><ThemeImage :image="person.image" /></div>
          <figcaption>
            <p class="eth-label">{{ i === 0 ? view.t.groom : view.t.bride }}</p>
            <h3 class="eth-person__name">{{ person.name }}</h3>
            <p v-if="person.description" class="eth-person__bio">{{ person.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <div class="eth-edge eth-edge--cream" aria-hidden="true" />

    <!-- Story -->
    <section v-if="view.story" class="eth-section eth-story">
      <header v-reveal class="eth-col">
        <h2 class="eth-title">{{ view.story.title }}</h2>
        <p v-if="view.story.introduction" class="eth-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="eth-story__track" aria-label="Timeline">
        <li v-for="(entry, i) in view.story.timeline" :key="entry.id" class="eth-chapter">
          <div v-if="entry.image" class="eth-chapter__photo"><ThemeImage :image="entry.image" /></div>
          <div class="eth-chapter__text">
            <p class="eth-chapter__meta">
              <span class="eth-chapter__num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span v-if="entry.date">{{ entry.date }}</span>
            </p>
            <h3 class="eth-chapter__title">{{ entry.title }}</h3>
            <p class="eth-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- Events -->
    <section class="eth-section eth-events">
      <header v-reveal class="eth-col">
        <p class="eth-label eth-label--dark">{{ view.t.saveTheDate }}</p>
        <h2 class="eth-title">{{ view.date.long }}</h2>
      </header>
      <div class="eth-events__list">
        <div v-for="event in view.events" :key="event.id" v-reveal class="eth-event">
          <div class="eth-event__date" aria-hidden="true">
            <span class="eth-event__day">{{ event.dateParts.dayPadded }}</span>
            <span class="eth-event__month">{{ event.dateParts.monthShort }}</span>
          </div>
          <div class="eth-event__body">
            <p class="eth-label eth-label--accent">{{ event.typeLabel }}</p>
            <h3 class="eth-event__title">{{ event.title }}</h3>
            <p class="eth-event__when">{{ event.dateText }}</p>
            <p class="eth-event__when">{{ event.timeText }}</p>
            <p class="eth-event__venue">{{ event.venueName }}</p>
            <p class="eth-body">{{ event.address }}</p>
            <p v-if="event.description" class="eth-body eth-event__note">{{ event.description }}</p>
            <a class="eth-button" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }}</a>
          </div>
        </div>
      </div>
    </section>

    <div class="eth-edge eth-edge--indigo" aria-hidden="true" />

    <!-- Gallery -->
    <section v-if="view.gallery" class="eth-section eth-gallery">
      <header v-reveal class="eth-col">
        <h2 class="eth-title eth-title--light">{{ view.gallery.title }}</h2>
        <p v-if="view.gallery.description" class="eth-body eth-body--light">{{ view.gallery.description }}</p>
      </header>
      <div class="eth-gallery__grid">
        <figure v-for="image in view.gallery.images" :key="image.id" v-reveal class="eth-tile">
          <ThemeImage :image="image" />
          <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <div class="eth-band" aria-hidden="true" />

    <!-- RSVP -->
    <section class="eth-section eth-rsvp">
      <div v-reveal class="eth-col">
        <h2 class="eth-title">{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="eth-lead">{{ content.rsvp.introduction }}</p>
        <RsvpPreview :content="content" />
      </div>
    </section>

    <!-- Closing -->
    <div class="eth-edge eth-edge--indigo" aria-hidden="true" />
    <footer class="eth-closing">
      <div v-if="content.closing.image" class="eth-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="eth-col">
        <p class="eth-lead eth-lead--light">{{ content.closing.message }}</p>
        <div class="eth-band eth-band--short" aria-hidden="true" />
        <p v-if="content.closing.thankYou" class="eth-closing__thanks">{{ content.closing.thankYou }}</p>
        <p class="eth-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
