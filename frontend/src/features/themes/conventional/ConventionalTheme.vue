<script setup lang="ts">
/**
 * Conventional — romantic, familiar invitation aesthetic.
 * Blush & sage pastels, original SVG florals, arched photo frames, script names.
 */
import UniversalSection from '../core/components/UniversalSection.vue'
import GuestGreeting from '../core/components/GuestGreeting.vue'
import GreetingPrayer from '../core/components/GreetingPrayer.vue'
import EventExtras from '../core/components/EventExtras.vue'
import FamilyAcknowledgments from '../core/components/FamilyAcknowledgments.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { vReveal } from '../core/directives/reveal'
import { useHeroHeading } from '../core/composables/useHeroHeading'
import type { ThemeProps } from '../core/types'
import ConvBouquet from './components/ConvBouquet.vue'
import ConvSprig from './components/ConvSprig.vue'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const heroHeading = useHeroHeading()
const view = useWeddingView(props)
</script>

<template>
  <article class="t-conv" :data-variant="config?.variant ?? 'blush-garden'" data-ornament-density="balanced">
    <!-- Opening -->
    <header data-section="opening" class="conv-hero">
      <ConvBouquet class="conv-bouquet--tl" />
      <ConvBouquet class="conv-bouquet--br" />
      <div class="conv-hero__content">
        <GuestGreeting :content="content" />
        <p class="conv-caps">{{ view.t.weddingOf }}</p>
        <div v-if="content.opening.coverImage" class="conv-arch conv-arch--hero">
          <ThemeImage :image="content.opening.coverImage" eager />
        </div>
        <h1 v-bind="heroHeading" class="conv-script conv-hero__names">{{ content.opening.coupleNames }}</h1>
        <p class="conv-hero__date">{{ view.date.full }}</p>
      </div>
    </header>

    <UniversalSection section="holyRecite1" :content="content" class="conv-section" />

    <section v-if="view.greeting" data-section="greeting" class="conv-section conv-intro">
      <div v-reveal class="conv-col">
        <ConvSprig class="conv-sprig--small" />
        <h2 v-if="view.greeting?.title" class="conv-title">{{ view.greeting?.title }}</h2>
        <p v-if="view.greeting?.message" class="conv-lead">{{ view.greeting?.message }}</p>
        <GreetingPrayer :prayer="view.greeting?.prayer" />
      </div>
    </section>

    <!-- Couple -->
    <section data-section="couple" class="conv-section conv-couple" aria-label="The couple">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <div class="conv-couple__grid">
        <figure v-reveal class="conv-person">
          <div v-if="content.couple.groom.image" class="conv-arch"><ThemeImage :image="content.couple.groom.image" /></div>
          <figcaption>
            <p class="conv-caps">{{ view.t.groom }}</p>
            <h3 class="conv-script conv-person__name">{{ content.couple.groom.name }}</h3>
            <p v-if="content.couple.groom.parents" class="conv-body" data-role="parents" style="font-style: italic">{{ content.couple.groom.parents }}</p>
            <p v-if="content.couple.groom.description" class="conv-body">{{ content.couple.groom.description }}</p>
          </figcaption>
        </figure>
        <p class="conv-script conv-amp" aria-hidden="true">&amp;</p>
        <figure v-reveal class="conv-person">
          <div v-if="content.couple.bride.image" class="conv-arch"><ThemeImage :image="content.couple.bride.image" /></div>
          <figcaption>
            <p class="conv-caps">{{ view.t.bride }}</p>
            <h3 class="conv-script conv-person__name">{{ content.couple.bride.name }}</h3>
            <p v-if="content.couple.bride.parents" class="conv-body" data-role="parents" style="font-style: italic">{{ content.couple.bride.parents }}</p>
            <p v-if="content.couple.bride.description" class="conv-body">{{ content.couple.bride.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Events -->
    <UniversalSection section="date" :content="content" class="conv-section" />

    <section data-section="events" class="conv-section conv-events">
      <header v-reveal class="conv-col">
        <p class="conv-caps">{{ view.t.saveTheDate }}</p>
        <h2 class="conv-title">{{ view.date.long }}</h2>
      </header>
      <div class="conv-events__list">
        <div v-for="event in view.events" :key="event.id" v-reveal class="conv-event">
          <ConvSprig class="conv-event__sprig" />
          <p class="conv-caps">{{ event.typeLabel }}</p>
          <h3 class="conv-event__title">{{ event.title }}</h3>
          <p class="conv-event__when">{{ event.dateText }}</p>
          <p class="conv-event__when">{{ event.timeText }}</p>
          <span class="conv-rule" aria-hidden="true" />
          <p class="conv-event__venue">{{ event.venueName }}</p>
          <p class="conv-body">{{ event.address }}</p>
          <p v-if="event.description" class="conv-body conv-event__note">{{ event.description }}</p><EventExtras :event="event" :locale="view.locale" />
          <a class="conv-pill" v-if="event.mapHref" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }}</a>
        </div>
      </div>
    </section>

    <section data-section="story" v-if="view.story" class="conv-section conv-story">
      <header v-reveal class="conv-col">
        <h2 class="conv-title">{{ view.story.title }}</h2>
        <p v-if="view.story.introduction" class="conv-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="conv-timeline">
        <li v-for="entry in view.story.timeline" :key="entry.id" v-reveal class="conv-moment">
          <div v-if="entry.image" class="conv-moment__photo"><ThemeImage :image="entry.image" /></div>
          <div class="conv-moment__text">
            <p v-if="entry.date" class="conv-moment__date">{{ entry.date }}</p>
            <h3 class="conv-moment__title">{{ entry.title }}</h3>
            <p class="conv-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- Gallery -->
    <section data-section="gallery" v-if="view.gallery" class="conv-section conv-gallery">
      <header v-reveal class="conv-col">
        <h2 class="conv-title">{{ view.gallery.title }}</h2>
        <p v-if="view.gallery.description" class="conv-body">{{ view.gallery.description }}</p>
      </header>
      <div class="conv-gallery__grid">
        <figure v-for="image in view.gallery.images" :key="image.id" v-reveal class="conv-photo">
          <div class="conv-photo__img"><ThemeImage :image="image" /></div>
          <figcaption v-if="image.caption" class="conv-gallery__caption">{{ image.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- RSVP -->
    <section v-if="content.rsvp.enabled" data-section="rsvp" class="conv-section conv-rsvp">
      <div v-reveal class="conv-card">
        <div class="conv-col">
          <h2 class="conv-title">{{ content.rsvp.title }}</h2>
          <p v-if="content.rsvp.introduction" class="conv-body">{{ content.rsvp.introduction }}</p>
          <RsvpPreview :content="content" />
        </div>
      </div>
    </section>

    <!-- Closing -->
    <UniversalSection section="wishes" :content="content" class="conv-section" />
    <UniversalSection section="amplopDigital" :content="content" class="conv-section" />
    <UniversalSection section="holyRecite2" :content="content" class="conv-section" />

    <footer data-section="closing" class="conv-closing">
      <ConvBouquet class="conv-bouquet--tl" />
      <ConvBouquet class="conv-bouquet--br" />
      <div v-reveal class="conv-col conv-closing__inner">
        <div v-if="content.closing.image" class="conv-arch conv-arch--small"><ThemeImage :image="content.closing.image" /></div>
        <p class="conv-lead">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="conv-script conv-closing__thanks">{{ content.closing.thankYou }}</p>
        <FamilyAcknowledgments :content="content" />
        <p class="conv-caps">{{ view.date.long }}</p>
      </div>
    </footer>
  </article>
</template>
