<script setup lang="ts">
/** Profiles per role: celebrant, child (with parents / birth date), graduate, hosts, organisers, partners. */
import { computed } from 'vue'

import type { ProfilePerson, ProfileRole } from '@/features/invitation/types'
import { formatDate } from '@/features/wedding/format'
import type { WeddingContent } from '@/features/wedding/types'

import ThemeImage from '../../core/components/ThemeImage.vue'
import { useTv } from '../context'
import { profileRoleKey } from '../wording'

const props = defineProps<{ content: WeddingContent }>()
const { t, locale, variant } = useTv()
const people = computed<ProfilePerson[]>(() => props.content.profiles?.people ?? [])
const roles = computed<ProfileRole[]>(() => [...new Set(people.value.map((p) => p.role))])
const mixed = computed(() => roles.value.length > 1)
const heading = computed(() => props.content.profiles?.title?.trim() || t.value(profileRoleKey(roles.value[0] ?? 'host', variant.value)))
const roleLabel = (role: ProfileRole) => t.value(profileRoleKey(role, variant.value))
const born = (iso: string) => t.value('tvBorn', { date: formatDate(iso, locale.value, 'long') })
const single = computed(() => people.value.length === 1)
</script>

<template>
  <section data-section="profiles" class="tv-section tv-people">
    <div class="tv-inner">
      <h2 class="tv-h2 tv-center" dir="auto">{{ heading }}</h2>
      <div class="tv-people__grid" :data-count="people.length" :class="{ 'tv-people__grid--single': single }">
        <article v-for="p in people" :key="p.id" class="tv-person" :data-role-kind="p.role" :data-sample="p.id.startsWith('placeholder-') ? 'true' : undefined">
          <div v-if="p.image" class="tv-person__photo"><ThemeImage :image="p.image" /></div>
          <p v-if="mixed" class="tv-kicker">{{ roleLabel(p.role) }}</p>
          <h3 class="tv-h3" dir="auto">{{ p.name }}</h3>
          <p v-if="p.nickname" class="tv-muted" dir="auto" data-role="nickname">“{{ p.nickname }}”</p>
          <p v-if="p.parents" class="tv-muted tv-pre" dir="auto" data-role="parents">{{ p.parents }}</p>
          <p v-if="p.birthDate" class="tv-muted" data-role="birth-date"><time :datetime="p.birthDate">{{ born(p.birthDate) }}</time></p>
          <p v-if="p.description" class="tv-body tv-pre" dir="auto">{{ p.description }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
