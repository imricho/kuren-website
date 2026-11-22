<script setup lang="ts">
/** Warm, sans-led minimalism: precise alignment, tactile neutrals and restrained detail. */
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
  <article class="t-minimal" :data-variant="config?.variant ?? 'still-form'" data-ornament-density="minimal">
    <header data-section="opening" class="mf-hero" :class="{ 'mf-hero--photo': content.opening.coverImage }">
      <div class="mf-hero__topline">
        <span>{{ view.t.weddingOf }}</span>
        <span>{{ view.date.short }}</span>
      </div>
      <div class="mf-hero__grid">
        <div class="mf-hero__copy">
          <GuestGreeting :content="content" />
          <p class="mf-kicker">A DAY TO REMEMBER</p>
          <h1 v-bind="heroHeading" class="mf-hero__names">
            <span>{{ content.couple.groom.name.split(' ')[0] }}</span>
            <span class="mf-amp">&amp;</span>
            <span>{{ content.couple.bride.name.split(' ')[0] }}</span>
          </h1>
          <p class="mf-hero__date">{{ view.date.full }}</p>
        </div>
        <div v-if="content.opening.coverImage" class="mf-hero__photo">
          <ThemeImage :image="content.opening.coverImage" eager />
          <span v-if="config?.variant === 'monogram'" class="mf-monogram-mark" aria-hidden="true">
            {{ content.couple.groom.name.charAt(0) }}<i>&amp;</i>{{ content.couple.bride.name.charAt(0) }}
          </span>
          <span class="mf-photo-index" aria-hidden="true">01 / 01</span>
        </div>
        <div v-else class="mf-hero__monogram" aria-hidden="true">
          <span>{{ content.couple.groom.name.charAt(0) }}</span>
          <i>&amp;</i>
          <span>{{ content.couple.bride.name.charAt(0) }}</span>
        </div>
      </div>
      <div class="mf-hero__bottomline">
        <span>{{ content.opening.coupleNames }}</span>
        <span>SCROLL TO EXPLORE <b aria-hidden="true">↓</b></span>
      </div>
    </header>

    <UniversalSection section="holyRecite1" :content="content" class="mf-section" />

    <section v-if="view.greeting" data-section="greeting" class="mf-section mf-intro">
      <div v-reveal class="mf-intro__copy">
        <p class="mf-kicker">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="view.greeting?.title">{{ view.greeting?.title }}</h2>
        <p v-if="view.greeting?.message" class="mf-body">{{ view.greeting?.message }}</p>
        <GreetingPrayer :prayer="view.greeting?.prayer" />
      </div>
    </section>

    <section data-section="couple" class="mf-section mf-couple" aria-label="The couple">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <div class="mf-section-label"><span>01</span><span>THE PEOPLE</span></div>
      <div class="mf-couple__grid">
        <figure v-for="(person, i) in [content.couple.groom, content.couple.bride]" :key="i" v-reveal class="mf-person">
          <div v-if="person.image" class="mf-person__photo"><ThemeImage :image="person.image" /></div>
          <div class="mf-person__copy">
            <p class="mf-kicker">{{ i === 0 ? view.t.groom : view.t.bride }}</p>
            <h3>{{ person.name }}</h3>
            <p v-if="person.parents" class="mf-body" data-role="parents" style="font-style: italic">{{ person.parents }}</p>
            <p v-if="person.description" class="mf-body">{{ person.description }}</p>
          </div>
        </figure>
      </div>
    </section>

    <UniversalSection section="date" :content="content" class="mf-section" />

    <section data-section="events" class="mf-section mf-events">
      <header v-reveal class="mf-section-heading">
        <div class="mf-section-label"><span>03</span><span>THE GATHERING</span></div>
        <p class="mf-kicker">{{ view.t.saveTheDate }}</p>
        <h2>{{ view.date.long }}</h2>
      </header>
      <div class="mf-events__list">
        <article v-for="(event, i) in view.events" :key="event.id" v-reveal class="mf-event">
          <span class="mf-event__number">0{{ i + 1 }}</span>
          <div class="mf-event__main">
            <p class="mf-kicker">{{ event.typeLabel }}</p>
            <h3>{{ event.title }}</h3>
            <p class="mf-body">{{ event.dateText }}<br />{{ event.timeText }}</p>
          </div>
          <div class="mf-event__place">
            <p class="mf-event__venue">{{ event.venueName }}</p>
            <p class="mf-body">{{ event.address }}</p>
            <p v-if="event.description" class="mf-body">{{ event.description }}</p><EventExtras :event="event" :locale="view.locale" />
            <a class="mf-link" v-if="event.mapHref" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }} <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </div>
    </section>

    <section data-section="story" v-if="view.story" class="mf-section mf-story">
      <header v-reveal class="mf-section-heading">
        <div class="mf-section-label"><span>02</span><span>THE STORY</span></div>
        <h2>{{ view.story.title }}</h2>
        <p v-if="view.story.introduction" class="mf-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="mf-story__list">
        <li v-for="(entry, i) in view.story.timeline" :key="entry.id" v-reveal class="mf-story__entry">
          <span class="mf-story__number">{{ String(i + 1).padStart(2, '0') }}</span>
          <div v-if="entry.image" class="mf-story__photo"><ThemeImage :image="entry.image" /></div>
          <div class="mf-story__copy">
            <p v-if="entry.date" class="mf-kicker">{{ entry.date }}</p>
            <h3>{{ entry.title }}</h3>
            <p class="mf-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section data-section="gallery" v-if="view.gallery" class="mf-section mf-gallery">
      <header v-reveal class="mf-section-heading">
        <div class="mf-section-label"><span>04</span><span>IN FRAMES</span></div>
        <h2>{{ view.gallery.title }}</h2>
        <p v-if="view.gallery.description" class="mf-body">{{ view.gallery.description }}</p>
      </header>
      <div class="mf-gallery__grid">
        <figure v-for="(image, i) in view.gallery.images" :key="image.id" v-reveal class="mf-gallery__item" :class="`mf-gallery__item--${i % 4}`">
          <div class="mf-gallery__photo"><ThemeImage :image="image" /></div>
          <figcaption v-if="image.caption"><span>{{ String(i + 1).padStart(2, '0') }}</span> {{ image.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <section v-if="content.rsvp.enabled" data-section="rsvp" class="mf-section mf-rsvp">
      <div v-reveal class="mf-rsvp__intro">
        <p class="mf-kicker">A NOTE BACK</p>
        <h2>{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="mf-body">{{ content.rsvp.introduction }}</p>
      </div>
      <RsvpPreview :content="content" />
    </section>

    <UniversalSection section="wishes" :content="content" class="mf-section" />
    <UniversalSection section="amplopDigital" :content="content" class="mf-section" />
    <UniversalSection section="holyRecite2" :content="content" class="mf-section" />

    <footer data-section="closing" class="mf-closing">
      <div v-if="content.closing.image" class="mf-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="mf-closing__copy">
        <p class="mf-kicker">{{ view.date.short }}</p>
        <p class="mf-closing__message">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="mf-body">{{ content.closing.thankYou }}</p>
        <FamilyAcknowledgments :content="content" />
        <p class="mf-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
