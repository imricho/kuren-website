<script setup lang="ts">
/** Field Notes: a garden-led invitation with organic pacing and original botanical linework. */
import CountdownTimer from '../core/components/CountdownTimer.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { vReveal } from '../core/directives/reveal'
import type { ThemeProps } from '../core/types'
import './styles/theme.css'

const props = defineProps<ThemeProps>()
const view = useWeddingView(props)
</script>

<template>
  <article class="t-rustic" :data-variant="config?.variant ?? 'field-notes'">
    <header class="rn-hero" :class="{ 'rn-hero--photo': content.opening.coverImage }">
      <div v-if="content.opening.coverImage" class="rn-hero__photo"><ThemeImage :image="content.opening.coverImage" eager /></div>
      <div v-else class="rn-hero__landscape" aria-hidden="true"><span /><span /><span /></div>
      <div class="rn-hero__veil" aria-hidden="true" />
      <div class="rn-hero__topline"><span>FIELD NOTES</span><span>{{ view.date.short }}</span></div>
      <div class="rn-hero__copy">
        <p class="rn-kicker">{{ view.t.weddingOf }}</p>
        <h1><span>{{ content.couple.groom.name.split(' ')[0] }}</span><i>&amp;</i><span>{{ content.couple.bride.name.split(' ')[0] }}</span></h1>
        <p class="rn-hero__date">{{ view.date.full }}</p>
        <svg class="rn-sprig" viewBox="0 0 170 44" aria-hidden="true" focusable="false">
          <path d="M8 36 C45 35 76 23 115 7 C132 0 147 6 162 12" fill="none" stroke="currentColor" stroke-width="1.2" />
          <path d="M43 30 C34 16 38 9 51 10 C56 20 52 26 43 30ZM72 21 C67 8 72 2 84 6 C85 15 80 20 72 21ZM105 10 C103 1 109 -2 118 3 C116 10 112 12 105 10ZM64 24 C72 35 81 36 85 27 C79 20 71 21 64 24Z" fill="currentColor" opacity=".76" />
        </svg>
      </div>
      <div class="rn-hero__bottomline"><span>{{ content.opening.coupleNames }}</span><span>TOGETHER, IN EVERY SEASON</span></div>
    </header>

    <section class="rn-section rn-intro">
      <div v-reveal class="rn-intro__copy">
        <p class="rn-kicker">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="content.opening.headline">{{ content.opening.headline }}</h2>
        <p v-if="content.opening.introduction" class="rn-body">{{ content.opening.introduction }}</p>
      </div>
      <CountdownTimer :content="content" />
    </section>

    <section class="rn-section rn-couple" aria-label="The couple">
      <div class="rn-section-heading" v-reveal>
        <p class="rn-kicker">THE PEOPLE WE CELEBRATE</p>
        <h2>A gathering of two stories</h2>
      </div>
      <div class="rn-couple__grid">
        <figure v-for="(person, i) in [content.couple.groom, content.couple.bride]" :key="i" v-reveal class="rn-person" :class="{ 'rn-person--second': i === 1 }">
          <div v-if="person.image" class="rn-person__photo"><ThemeImage :image="person.image" /></div>
          <figcaption>
            <p class="rn-kicker">{{ i === 0 ? view.t.groom : view.t.bride }}</p>
            <h3>{{ person.name }}</h3>
            <p v-if="person.description" class="rn-body">{{ person.description }}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <section v-if="view.story" class="rn-section rn-story">
      <header v-reveal class="rn-section-heading rn-section-heading--center">
        <p class="rn-kicker">CHAPTERS ALONG THE WAY</p>
        <h2>{{ view.story.title }}</h2>
        <p v-if="view.story.introduction" class="rn-body">{{ view.story.introduction }}</p>
      </header>
      <ol class="rn-story__list">
        <li v-for="(entry, i) in view.story.timeline" :key="entry.id" v-reveal class="rn-story__entry">
          <span class="rn-story__marker" aria-hidden="true"><span>{{ String(i + 1).padStart(2, '0') }}</span></span>
          <div v-if="entry.image" class="rn-story__photo"><ThemeImage :image="entry.image" /></div>
          <div class="rn-story__copy">
            <p v-if="entry.date" class="rn-kicker">{{ entry.date }}</p>
            <h3>{{ entry.title }}</h3>
            <p class="rn-body">{{ entry.description }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="rn-section rn-events">
      <header v-reveal class="rn-section-heading">
        <p class="rn-kicker">{{ view.t.saveTheDate }}</p>
        <h2>{{ view.date.long }}</h2>
        <p class="rn-body">A day to gather, linger and celebrate.</p>
      </header>
      <div class="rn-events__list">
        <article v-for="(event, i) in view.events" :key="event.id" v-reveal class="rn-event">
          <div class="rn-event__date"><span>{{ event.dateParts.dayPadded }}</span><small>{{ event.dateParts.monthShort }}</small></div>
          <div class="rn-event__details">
            <p class="rn-kicker">{{ event.typeLabel }} · {{ event.timeText }}</p>
            <h3>{{ event.title }}</h3>
            <p class="rn-event__venue">{{ event.venueName }}</p>
            <p class="rn-body">{{ event.address }}</p>
            <p v-if="event.description" class="rn-body">{{ event.description }}</p>
            <a class="rn-link" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }} <span aria-hidden="true">↗</span></a>
          </div>
          <span class="rn-event__index" aria-hidden="true">0{{ i + 1 }}</span>
        </article>
      </div>
    </section>

    <section v-if="view.gallery" class="rn-section rn-gallery">
      <header v-reveal class="rn-section-heading">
        <p class="rn-kicker">LITTLE THINGS, KEPT CLOSE</p>
        <h2>{{ view.gallery.title }}</h2>
        <p v-if="view.gallery.description" class="rn-body">{{ view.gallery.description }}</p>
      </header>
      <div class="rn-gallery__grid">
        <figure v-for="(image, i) in view.gallery.images" :key="image.id" v-reveal class="rn-gallery__item" :class="`rn-gallery__item--${i % 3}`">
          <div class="rn-gallery__photo"><ThemeImage :image="image" /></div>
          <figcaption v-if="image.caption">{{ image.caption }}</figcaption>
        </figure>
      </div>
    </section>

    <section class="rn-section rn-rsvp">
      <div class="rn-rsvp__ornament" aria-hidden="true">
        <svg viewBox="0 0 200 200" focusable="false"><path d="M20 180 C70 144 71 87 120 28 M61 132 C38 124 32 103 45 91 C63 103 68 116 61 132ZM85 96 C65 83 66 61 82 52 C99 65 98 83 85 96ZM113 58 C103 37 116 20 135 18 C143 36 133 53 113 58ZM78 111 C99 115 110 132 101 148 C82 145 73 128 78 111Z" fill="none" stroke="currentColor" stroke-width="1.3" /></svg>
      </div>
      <div v-reveal class="rn-rsvp__content">
        <p class="rn-kicker">SAVE A PLACE AT THE TABLE</p>
        <h2>{{ content.rsvp.title }}</h2>
        <p v-if="content.rsvp.introduction" class="rn-body">{{ content.rsvp.introduction }}</p>
        <RsvpPreview :content="content" />
      </div>
    </section>

    <footer class="rn-closing">
      <div v-if="content.closing.image" class="rn-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <div v-reveal class="rn-closing__copy">
        <p class="rn-kicker">{{ view.date.short }}</p>
        <p class="rn-closing__message">{{ content.closing.message }}</p>
        <p v-if="content.closing.thankYou" class="rn-closing__thanks">{{ content.closing.thankYou }}</p>
        <p class="rn-closing__names">{{ content.opening.coupleNames }}</p>
      </div>
    </footer>
  </article>
</template>
