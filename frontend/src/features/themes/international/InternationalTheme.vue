<script setup lang="ts">
/**
 * International — modern editorial minimalism.
 * Neutral palette, large refined serif, generous whitespace, full-bleed photos.
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
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const heroHeading = useHeroHeading()
const view = useWeddingView(props)
</script>

<template>
  <article class="t-intl" :data-variant="config?.variant ?? 'editorial-ivory'">
    <!-- Opening -->
    <header data-section="opening" class="intl-hero" :class="{ 'intl-hero--image': content.opening.coverImage }">
      <div v-if="content.opening.coverImage" class="intl-hero__media">
        <ThemeImage :image="content.opening.coverImage" eager />
      </div>
      <div class="intl-hero__text">
        <GuestGreeting :content="content" />
        <p class="intl-eyebrow">{{ view.t.weddingOf }}</p>
        <h1 v-bind="heroHeading" class="intl-hero__names">
          <span>{{ content.couple.groom.name.split(' ')[0] }}</span>
          <span class="intl-amp">&amp;</span>
          <span>{{ content.couple.bride.name.split(' ')[0] }}</span>
        </h1>
        <p class="intl-hero__date">{{ view.date.full }}</p>
      </div>
    </header>

    <UniversalSection section="holyRecite1" :content="content" class="intl-section" />

    <section v-if="view.greeting" data-section="greeting" class="intl-section intl-intro">
      <div v-reveal class="intl-narrow">
        <p class="intl-eyebrow">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="view.greeting?.title" class="intl-display">{{ view.greeting?.title }}</h2>
        <!-- Keeps the heading order (h1 → h2 → h3) when there is no headline. -->
        <h2 v-else class="sr-only">{{ view.t.couple }}</h2>
        <p v-if="view.greeting?.message" class="intl-lead">{{ view.greeting?.message }}</p>
        <GreetingPrayer :prayer="view.greeting?.prayer" />
      </div>
    </section>

    <!-- Couple -->
    <section data-section="couple" class="intl-section intl-couple" aria-label="The couple">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <div class="intl-couple__grid">
        <figure v-for="(person, i) in [content.couple.groom, content.couple.bride]" :key="i" v-reveal class="intl-person">
          <div v-if="person.image" class="intl-person__photo"><ThemeImage :image="person.image" /></div>
          <figcaption>
            <p class="intl-eyebrow">{{ i === 0 ? view.t.groom : view.t.bride }}</p>
            <h3 class="intl-person__name">{{ person.name }}</h3>
            <p v-if="person.parents" class="intl-body" data-role="parents" style="font-style: italic">{{ person.parents }}</p>
            <p v-if="person.description" class="intl-body">{{ person.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Events -->
    <UniversalSection section="date" :content="content" class="intl-section" />

    <section data-section="events" class="intl-section intl-events">
      <div class="intl-wide">
        <header v-reveal class="intl-heading">
          <p class="intl-eyebrow">{{ view.t.saveTheDate }}</p>
          <h2 class="intl-display">{{ view.date.long }}</h2>
        </header>
        <ul class="intl-itinerary">
          <li v-for="event in view.events" :key="event.id" v-reveal class="intl-event">
            <p class="intl-event__type">{{ event.typeLabel }}</p>
            <div class="intl-event__main">
              <h3 class="intl-event__title">{{ event.title }}</h3>
              <p class="intl-event__when">{{ event.dateText }} · {{ event.timeText }}</p>
              <p v-if="event.description" class="intl-body">{{ event.description }}</p><EventExtras :event="event" :locale="view.locale" />
            </div>
            <div class="intl-event__where">
              <p class="intl-event__venue">{{ event.venueName }}</p>
              <p class="intl-body">{{ event.address }}</p>
              <a class="intl-link" v-if="event.mapHref" :href="event.mapHref" target="_blank" rel="noopener noreferrer">
                {{ view.t.viewMap }} <span aria-hidden="true">→</span>
              </a>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section data-section="story" v-if="view.story" class="intl-section intl-story">
      <div class="intl-wide">
        <header v-reveal class="intl-heading">
          <h2 class="intl-display">{{ view.story.title }}</h2>
          <p v-if="view.story.introduction" class="intl-body">{{ view.story.introduction }}</p>
        </header>
        <ol class="intl-timeline">
          <li v-for="entry in view.story.timeline" :key="entry.id" v-reveal class="intl-chapter">
            <p class="intl-chapter__date">{{ entry.date }}</p>
            <div class="intl-chapter__body">
              <h3 class="intl-chapter__title">{{ entry.title }}</h3>
              <p class="intl-body">{{ entry.description }}</p>
            </div>
            <div v-if="entry.image" class="intl-chapter__photo"><ThemeImage :image="entry.image" /></div>
          </li>
        </ol>
      </div>
    </section>

    <!-- Gallery -->
    <section data-section="gallery" v-if="view.gallery" class="intl-section intl-gallery">
      <div class="intl-wide">
        <header v-reveal class="intl-heading">
          <h2 class="intl-display">{{ view.gallery.title }}</h2>
          <p v-if="view.gallery.description" class="intl-body">{{ view.gallery.description }}</p>
        </header>
        <div class="intl-gallery__grid">
          <figure v-for="image in view.gallery.images" :key="image.id" v-reveal class="intl-gallery__item">
            <div class="intl-gallery__frame"><ThemeImage :image="image" /></div>
            <figcaption v-if="image.caption" class="intl-caption">{{ image.caption }}</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- RSVP -->
    <section v-if="content.rsvp.enabled" data-section="rsvp" class="intl-section intl-rsvp">
      <div v-reveal class="intl-narrow">
        <h2 class="intl-display">{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="intl-lead">{{ content.rsvp.introduction }}</p>
        <RsvpPreview :content="content" />
      </div>
    </section>

    <!-- Closing -->
    <UniversalSection section="wishes" :content="content" class="intl-section" />
    <UniversalSection section="amplopDigital" :content="content" class="intl-section" />
    <UniversalSection section="holyRecite2" :content="content" class="intl-section" />

    <footer data-section="closing" class="intl-closing">
      <div v-if="content.closing.image" class="intl-closing__media"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="intl-narrow intl-closing__text">
        <p class="intl-lead">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="intl-closing__thanks">{{ content.closing.thankYou }}</p>
        <FamilyAcknowledgments :content="content" />
        <p class="intl-closing__names">{{ content.opening.coupleNames }}</p>
        <p class="intl-eyebrow">{{ view.date.short }}</p>
      </div>
    </footer>
  </article>
</template>
