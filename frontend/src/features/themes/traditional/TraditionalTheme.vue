<script setup lang="ts">
/**
 * Traditional — formal, symmetrical, ceremonial.
 * Maroon & antique gold, framed panels, original ornaments (components/).
 * Deliberately generic: no single regional tradition. Regional variants can
 * swap the ornament components and palette without touching the layout.
 */
import UniversalSection from '../core/components/UniversalSection.vue'
import GuestGreeting from '../core/components/GuestGreeting.vue'
import GreetingPrayer from '../core/components/GreetingPrayer.vue'
import EventExtras from '../core/components/EventExtras.vue'
import FamilyAcknowledgments from '../core/components/FamilyAcknowledgments.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { holyReciteHasContent } from '../core/visibility'
import { vReveal } from '../core/directives/reveal'
import { useHeroHeading } from '../core/composables/useHeroHeading'
import type { ThemeProps } from '../core/types'
import TradCorner from './components/TradCorner.vue'
import TradCrest from './components/TradCrest.vue'
import TradDivider from './components/TradDivider.vue'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const heroHeading = useHeroHeading()
const view = useWeddingView(props)
</script>

<template>
  <article class="t-trad" :data-variant="config?.variant ?? 'royal-maroon'" :data-ornament-density="['royal-maroon', 'loomed-lines'].includes(String(config?.variant ?? 'royal-maroon')) ? 'ornate' : 'balanced'">
    <!-- Opening -->
    <header data-section="opening" class="trad-hero">
      <div class="trad-frame">
        <TradCorner v-for="pos in ['tl', 'tr', 'bl', 'br']" :key="pos" :class="`trad-corner--${pos}`" />
        <div class="trad-hero__content">
          <TradCrest />
          <GuestGreeting :content="content" />
          <p class="trad-caps trad-gold">{{ view.t.weddingOf }}</p>
          <div v-if="content.opening.coverImage" class="trad-medallion">
            <ThemeImage :image="content.opening.coverImage" eager />
          </div>
          <h1 v-bind="heroHeading" class="trad-hero__names">
            <span>{{ content.couple.groom.name }}</span>
            <TradDivider />
            <span>{{ content.couple.bride.name }}</span>
          </h1>
          <p class="trad-caps trad-hero__date">{{ view.date.full }}</p>
        </div>
      </div>
    </header>

    <div v-if="view.greeting || holyReciteHasContent(content.holyRecite1)" class="trad-band" aria-hidden="true" />

    <UniversalSection section="holyRecite1" :content="content" class="trad-section" />

    <section v-if="view.greeting" data-section="greeting" class="trad-section trad-intro">
      <div v-reveal class="trad-col">
        <p class="trad-caps trad-maroon">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="view.greeting?.title" class="trad-title">{{ view.greeting?.title }}</h2>
        <TradDivider />
        <p v-if="view.greeting?.message" class="trad-lead">{{ view.greeting?.message }}</p>
        <GreetingPrayer :prayer="view.greeting?.prayer" />
      </div>
    </section>

    <!-- Couple -->
    <section data-section="couple" class="trad-section trad-couple" aria-label="The couple">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <div class="trad-couple__grid">
        <figure v-reveal class="trad-person">
          <div v-if="content.couple.groom.image" class="trad-portrait"><ThemeImage :image="content.couple.groom.image" /></div>
          <figcaption>
            <p class="trad-caps trad-maroon">{{ view.t.groom }}</p>
            <h3 class="trad-person__name">{{ content.couple.groom.name }}</h3>
            <p v-if="content.couple.groom.parents" class="trad-body" data-role="parents" style="font-style: italic">{{ content.couple.groom.parents }}</p>
            <p v-if="content.couple.groom.description" class="trad-body">{{ content.couple.groom.description }}</p>
          </figcaption>
        </figure>
        <p class="trad-amp" aria-hidden="true">&amp;</p>
        <figure v-reveal class="trad-person">
          <div v-if="content.couple.bride.image" class="trad-portrait"><ThemeImage :image="content.couple.bride.image" /></div>
          <figcaption>
            <p class="trad-caps trad-maroon">{{ view.t.bride }}</p>
            <h3 class="trad-person__name">{{ content.couple.bride.name }}</h3>
            <p v-if="content.couple.bride.parents" class="trad-body" data-role="parents" style="font-style: italic">{{ content.couple.bride.parents }}</p>
            <p v-if="content.couple.bride.description" class="trad-body">{{ content.couple.bride.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Events -->
    <div class="trad-band" aria-hidden="true" />
    <UniversalSection section="date" :content="content" class="trad-section" />

    <section data-section="events" class="trad-section trad-events">
      <header v-reveal class="trad-col">
        <p class="trad-caps trad-gold">{{ view.t.saveTheDate }}</p>
        <h2 class="trad-title trad-title--light">{{ view.date.long }}</h2>
        <TradDivider />
      </header>
      <div class="trad-events__list">
        <article v-for="event in view.events" :key="event.id" v-reveal class="trad-event">
          <p class="trad-caps trad-gold">{{ event.typeLabel }}</p>
          <h3 class="trad-event__title">{{ event.title }}</h3>
          <p class="trad-event__date">{{ event.dateText }}</p>
          <p class="trad-event__time">{{ event.timeText }}</p>
          <TradDivider />
          <p class="trad-event__venue">{{ event.venueName }}</p>
          <p class="trad-event__address">{{ event.address }}</p>
          <p v-if="event.description" class="trad-event__note">{{ event.description }}</p><EventExtras :event="event" :locale="view.locale" />
          <a class="trad-button" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }}</a>
        </article>
      </div>
    </section>

    <section data-section="story" v-if="view.story" class="trad-section trad-story">
      <header v-reveal class="trad-col">
        <h2 class="trad-title">{{ view.story.title }}</h2>
        <TradDivider />
        <p v-if="view.story.introduction" class="trad-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="trad-timeline">
        <li v-for="entry in view.story.timeline" :key="entry.id" v-reveal class="trad-moment">
          <span class="trad-moment__node" aria-hidden="true" />
          <div class="trad-moment__card">
            <div v-if="entry.image" class="trad-moment__photo"><ThemeImage :image="entry.image" /></div>
            <p v-if="entry.date" class="trad-caps trad-maroon">{{ entry.date }}</p>
            <h3 class="trad-moment__title">{{ entry.title }}</h3>
            <p class="trad-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>
    <div v-if="view.story" class="trad-band" aria-hidden="true" />

    <!-- Gallery -->
    <section data-section="gallery" v-if="view.gallery" class="trad-section trad-gallery">
      <header v-reveal class="trad-col">
        <h2 class="trad-title">{{ view.gallery.title }}</h2>
        <TradDivider />
        <p v-if="view.gallery.description" class="trad-body">{{ view.gallery.description }}</p>
      </header>
      <div class="trad-gallery__grid">
        <figure v-for="image in view.gallery.images" :key="image.id" v-reveal class="trad-mat">
          <div class="trad-mat__photo"><ThemeImage :image="image" /></div>
          <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <!-- RSVP -->
    <section v-if="content.rsvp.enabled" data-section="rsvp" class="trad-section trad-rsvp">
      <div v-reveal class="trad-panel">
        <TradCorner v-for="pos in ['tl', 'tr', 'bl', 'br']" :key="pos" :class="`trad-corner--${pos}`" />
        <div class="trad-col">
          <h2 class="trad-title">{{ content.rsvp.title }}</h2>
          <TradDivider />
          <p v-if="content.rsvp.introduction" class="trad-body">{{ content.rsvp.introduction }}</p>
          <RsvpPreview :content="content" />
        </div>
      </div>
    </section>

    <!-- Closing -->
    <UniversalSection section="wishes" :content="content" class="trad-section" />
    <UniversalSection section="amplopDigital" :content="content" class="trad-section" />
    <UniversalSection section="holyRecite2" :content="content" class="trad-section" />

    <footer data-section="closing" class="trad-closing">
      <div class="trad-band" aria-hidden="true" />
      <div v-reveal class="trad-col trad-closing__inner">
        <div v-if="content.closing.image" class="trad-medallion trad-medallion--small">
          <ThemeImage :image="content.closing.image" />
        </div>
        <p class="trad-lead">{{ content.closing.message }}</p>
        <TradDivider />
        <p v-if="content.closing.thankYou" class="trad-closing__thanks">{{ content.closing.thankYou }}</p>
        <FamilyAcknowledgments :content="content" />
        <p class="trad-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
