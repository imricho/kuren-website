<script setup lang="ts">
import { computed } from 'vue'
import UniversalSection from '../core/components/UniversalSection.vue'
import GuestGreeting from '../core/components/GuestGreeting.vue'
import GreetingPrayer from '../core/components/GreetingPrayer.vue'
import EventExtras from '../core/components/EventExtras.vue'
import FamilyAcknowledgments from '../core/components/FamilyAcknowledgments.vue'
import RsvpPreview from '../core/components/RsvpPreview.vue'
import ThemeImage from '../core/components/ThemeImage.vue'
import { useWeddingView } from '../core/composables/useWeddingView'
import { useHeroHeading } from '../core/composables/useHeroHeading'
import { useIsDraftRender } from '../core/composables/useRenderMode'
import type { ThemeProps } from '../core/types'
import BotanicalOrnament from './BotanicalOrnament.vue'
import './theme.css'

const props = defineProps<ThemeProps>()
const view = useWeddingView(props)
const heroHeading = useHeroHeading()
const isDraft = useIsDraftRender()
const initials = computed(() => [props.content.couple.groom, props.content.couple.bride].map(p => Array.from((p.nickname || p.name).trim())[0] || '').join(' & '))
const people = computed(() => [
  { key: 'groom', label: view.value.t.groom, ...props.content.couple.groom },
  { key: 'bride', label: view.value.t.bride, ...props.content.couple.bride },
])
</script>

<template>
  <article class="rm2" data-variant="royal-maroon-v2" data-ornament-density="ornate">
    <header data-section="opening" class="rm2-hero">
      <div class="rm2-hero__frame">
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tr" />
        <div class="rm2-monogram"><BotanicalOrnament kind="wreath" /><span aria-hidden="true">{{ initials }}</span></div>
        <GuestGreeting :content="content" />
        <p class="rm2-eyebrow">{{ view.t.weddingOf }}</p>
        <div class="rm2-arch">
          <div v-if="content.opening.coverImage" class="rm2-arch__photo"><ThemeImage :image="content.opening.coverImage" eager /></div>
          <div v-else class="rm2-arch__empty" aria-hidden="true"><span>{{ initials }}</span></div>
          <BotanicalOrnament kind="vine" class="rm2-arch__vine rm2-arch__vine--left" />
          <BotanicalOrnament kind="vine" class="rm2-arch__vine rm2-arch__vine--right" />
        </div>
        <h1 v-bind="heroHeading" class="rm2-hero__names"><span>{{ content.couple.groom.name }}</span><i aria-hidden="true">&amp;</i><span>{{ content.couple.bride.name }}</span></h1>
        <p class="rm2-hero__date">{{ view.date.full }}</p>
        <BotanicalOrnament class="rm2-hero__bottom" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--bl" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
        <span class="rm2-scroll" aria-hidden="true">⌄</span>
      </div>
    </header>

    <UniversalSection section="holyRecite1" :content="content" class="rm2-section">
      <template #decoration><BotanicalOrnament kind="rosette" /></template>
    </UniversalSection>

    <section v-if="view.greeting" data-section="greeting" class="rm2-section rm2-intro">
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
      <div class="rm2-heading">
        <BotanicalOrnament kind="rosette" />
        <p class="rm2-eyebrow">{{ content.opening.weddingTitle }}</p>
        <h2 v-if="view.greeting?.title">{{ view.greeting?.title }}</h2>
        <p v-if="view.greeting?.message" class="rm2-lead">{{ view.greeting?.message }}</p>
        <GreetingPrayer :prayer="view.greeting?.prayer" />
        <BotanicalOrnament class="rm2-intro__tail" />
      </div>
    </section>

    <section data-section="couple" class="rm2-section rm2-couple" :aria-label="view.locale === 'id' ? 'Mempelai' : 'The couple'">
      <h2 class="universal-visually-hidden">{{ view.t.couple }}</h2>
      <div class="rm2-section-divider" aria-hidden="true"><span /><BotanicalOrnament kind="rosette" /><span /></div>
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tr" />
      <div class="rm2-couple__grid">
        <figure v-for="person in people" :key="person.key" class="rm2-person">
          <div v-if="person.image" class="rm2-portrait">
            <div class="rm2-portrait__photo"><ThemeImage :image="person.image" /></div>
            <BotanicalOrnament kind="wreath" />
          </div>
          <BotanicalOrnament v-else class="rm2-person__headpiece" />
          <figcaption><p class="rm2-eyebrow">{{ person.label }}</p><h2>{{ person.name }}</h2><p v-if="person.parents" class="rm2-parents">{{ person.parents }}</p><p v-if="person.description">{{ person.description }}</p></figcaption>
        </figure>
      </div>
      <BotanicalOrnament class="rm2-section-tail" />
    </section>

    <UniversalSection section="date" :content="content" class="rm2-section">
      <template #decoration><BotanicalOrnament kind="rosette" /></template>
    </UniversalSection>

    <section data-section="events" class="rm2-section rm2-events">
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tr" />
      <header class="rm2-heading"><BotanicalOrnament /><p class="rm2-eyebrow">{{ view.t.saveTheDate }}</p><h2>{{ view.date.long }}</h2></header>
      <div class="rm2-events__grid">
        <article v-for="(event, index) in view.events" :key="event.id" class="rm2-event">
          <BotanicalOrnament :kind="index % 2 ? 'rosette' : 'spray'" class="rm2-event__medallion" />
          <BotanicalOrnament kind="corner" class="rm2-event__corner rm2-event__corner--left" />
          <BotanicalOrnament kind="corner" class="rm2-event__corner rm2-event__corner--right" />
          <p v-if="event.typeLabel.toLocaleLowerCase() !== event.title.toLocaleLowerCase()" class="rm2-eyebrow">{{ event.typeLabel }}</p>
          <h3>{{ event.title }}</h3><p>{{ event.dateText }}</p><p class="rm2-event__time">{{ event.timeText }}</p>
          <div class="rm2-rule" aria-hidden="true"><BotanicalOrnament kind="rosette" /></div>
          <p class="rm2-event__venue">{{ event.venueName }}</p><p>{{ event.address }}</p><p v-if="event.description" class="rm2-event__note">{{ event.description }}</p><EventExtras :event="event" :locale="view.locale" />
          <a class="rm2-button" :href="event.mapHref" target="_blank" rel="noopener noreferrer">{{ view.t.viewMap }} <span aria-hidden="true">↗</span></a>
        </article>
      </div>
      <div class="rm2-section-divider rm2-events__tail" aria-hidden="true"><span /><BotanicalOrnament kind="rosette" /><span /></div>
    </section>

    <section data-section="story" v-if="view.story" class="rm2-section rm2-story">
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
      <header class="rm2-heading"><BotanicalOrnament kind="rosette" /><h2>{{ view.story.title }}</h2><p v-if="view.story.introduction">{{ view.story.introduction }}</p></header>
      <ol class="rm2-timeline">
        <li v-for="entry in view.story.timeline" :key="entry.id" class="rm2-moment">
          <BotanicalOrnament kind="vine" class="rm2-moment__vine" />
          <div v-if="entry.image" class="rm2-moment__photo"><ThemeImage :image="entry.image" /><BotanicalOrnament kind="corner" class="rm2-photo-corner" /></div>
          <div class="rm2-moment__text"><p v-if="entry.date" class="rm2-eyebrow">{{ entry.date }}</p><h3>{{ entry.title }}</h3><p>{{ entry.description }}</p><BotanicalOrnament kind="rosette" class="rm2-moment__seal" /></div>
        </li>
      </ol>
    </section>

    <section data-section="gallery" v-if="view.gallery" class="rm2-section rm2-gallery">
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
      <header class="rm2-heading"><BotanicalOrnament /><h2>{{ view.gallery.title }}</h2><p v-if="view.gallery.description">{{ view.gallery.description }}</p></header>
      <div class="rm2-gallery__grid">
        <figure v-for="image in view.gallery.images" :key="image.id" class="rm2-mat"><div class="rm2-mat__photo"><ThemeImage :image="image" /></div><BotanicalOrnament kind="corner" class="rm2-photo-corner" /><figcaption v-if="image.caption">{{ image.caption }}</figcaption></figure>
      </div>
      <div class="rm2-section-divider" aria-hidden="true"><span /><BotanicalOrnament kind="rosette" /><span /></div>
    </section>

    <section v-if="content.rsvp.enabled" data-section="rsvp" class="rm2-section rm2-rsvp">
      <div class="rm2-panel">
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tr" />
        <BotanicalOrnament kind="rosette" class="rm2-panel__head" />
        <div class="rm2-heading"><h2>{{ content.rsvp.title }}</h2><p v-if="content.rsvp.introduction">{{ content.rsvp.introduction }}</p></div>
        <p v-if="isDraft" class="rm2-preview-note" data-editor-only>{{ view.locale === 'id' ? 'Pratinjau formulir · RSVP online belum tersedia.' : 'Form preview · Online RSVP is not available yet.' }}</p>
        <RsvpPreview :content="content" />
        <BotanicalOrnament class="rm2-panel__tail" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--bl" />
        <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
      </div>
    </section>

    <UniversalSection section="wishes" :content="content" class="rm2-section">
      <template #decoration><BotanicalOrnament kind="rosette" /></template>
    </UniversalSection>
    <UniversalSection section="amplopDigital" :content="content" class="rm2-section">
      <template #decoration><BotanicalOrnament kind="rosette" /></template>
    </UniversalSection>
    <UniversalSection section="holyRecite2" :content="content" class="rm2-section">
      <template #decoration><BotanicalOrnament kind="rosette" /></template>
    </UniversalSection>

    <footer data-section="closing" class="rm2-closing rm2-section">
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--tr" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--bl" />
      <BotanicalOrnament kind="corner" class="rm2-corner rm2-corner--br" />
      <div class="rm2-monogram"><BotanicalOrnament kind="wreath" /><span aria-hidden="true">{{ initials }}</span></div>
      <div v-if="content.closing.image" class="rm2-closing__photo"><ThemeImage :image="content.closing.image" /></div>
      <p class="rm2-lead">{{ content.closing.message }}</p>
      <p v-if="content.closing.thankYou">{{ content.closing.thankYou }}</p>
      <FamilyAcknowledgments :content="content" />
      <p v-if="!content.closing.thankYou?.includes(content.opening.coupleNames)" class="rm2-closing__names">{{ content.opening.coupleNames }}</p>
      <BotanicalOrnament class="rm2-closing__flourish" />
    </footer>
  </article>
</template>
