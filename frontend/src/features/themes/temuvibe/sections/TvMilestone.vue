<script setup lang="ts">
/** What is being celebrated: age, years together, occasion, graduation details, party theme. */
import { computed } from 'vue'

import type { WeddingContent } from '@/features/wedding/types'

import { useTv } from '../context'

const props = defineProps<{ content: WeddingContent }>()
const { t, variant } = useTv()
const m = computed(() => props.content.milestone!)
const isGraduation = computed(() => !!(m.value.institution || m.value.program || m.value.degree))
const heading = computed(() => {
  const v = m.value
  if (v.title?.trim()) return v.title.trim()
  if (v.age !== undefined) return variant.value === 'sweet_17' && v.age === 17 ? t.value('tvKickerSweet17') : t.value('tvMilestoneAge', { age: v.age })
  if (v.years !== undefined) return t.value('tvMilestoneYears', { years: v.years })
  if (v.occasion) return v.occasion
  return isGraduation.value ? t.value('tvMilestoneGraduation') : t.value('tvMilestoneGeneric')
})
const numeral = computed(() => (m.value.age !== undefined ? { value: m.value.age, unit: t.value('tvAgeUnit') } : m.value.years !== undefined ? { value: m.value.years, unit: t.value('tvYearsUnit') } : undefined))
/** The occasion is shown in the body only when the heading is a custom title. */
const occasionLine = computed(() => (m.value.occasion && heading.value !== m.value.occasion ? m.value.occasion : undefined))
const details = computed(() =>
  [
    { key: 'institution', label: t.value('tvInstitution'), value: m.value.institution },
    { key: 'program', label: t.value('tvProgram'), value: m.value.program },
    { key: 'degree', label: t.value('tvDegree'), value: m.value.degree },
    { key: 'partyTheme', label: t.value('tvPartyTheme'), value: m.value.partyTheme },
  ].filter((d) => d.value),
)
</script>

<template>
  <section data-section="milestone" class="tv-section tv-milestone">
    <div class="tv-inner tv-center">
      <p v-if="numeral" class="tv-milestone__numeral" aria-hidden="true">{{ numeral.value }}</p>
      <h2 class="tv-h2" dir="auto">{{ heading }}</h2>
      <p v-if="numeral" class="universal-visually-hidden">{{ numeral.value }} {{ numeral.unit }}</p>
      <p v-if="occasionLine" class="tv-lead" dir="auto">{{ occasionLine }}</p>
      <dl v-if="details.length" class="tv-facts">
        <div v-for="d in details" :key="d.key" class="tv-facts__row" :data-field="d.key">
          <dt>{{ d.label }}</dt>
          <dd dir="auto">{{ d.value }}</dd>
        </div>
      </dl>
      <p v-if="m.description" class="tv-body tv-pre" dir="auto">{{ m.description }}</p>
    </div>
  </section>
</template>
