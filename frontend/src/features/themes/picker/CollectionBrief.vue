<script setup lang="ts">
/**
 * Shows a regional collection's cultural brief in the sidebar. It keeps three
 * things visibly separate, so nothing unverified reads as fact:
 *   - Sources (and whether they are verified) and confirmed references
 *   - Open research questions (candidate references, not confirmed)
 *   - Draft art direction (creative choices, not cultural claims)
 */
import { computed } from 'vue'

import { templatesOf } from '../core/registry'
import type { ThemeCollection } from '../core/types'
import { localizedReview } from './format'
import { useAppLocale } from '@/composables/useAppLocale'

const props = defineProps<{ collection: ThemeCollection }>()
const { t } = useAppLocale()
const brief = computed(() => props.collection.brief!)

const ITEM_GROUPS = [
  ['garments', 'Garments'],
  ['textiles', 'Textiles'],
  ['motifs', 'Motifs'],
  ['objects', 'Objects'],
] as const

const confirmedCount = computed(() => Object.values(brief.value.confirmed).flat().length)
const researchGroups = computed(() =>
  ITEM_GROUPS.map(([key, label]) => ({ label, items: brief.value.toResearch[key] })).filter((g) => g.items.length),
)
const selectedLocality = computed(() => brief.value.localities.find((l) => l.id === brief.value.selectedLocality))

// Localities the current drafts follow (provisional; not the confirmed choice needed for release).
const draftDirections = computed(() =>
  templatesOf(props.collection.id)
    .filter((t) => t.status === 'draft')
    .map((t) => brief.value.localities.find((l) => l.id === t.localityId)?.name ?? t.regionalVariation)
    .filter(Boolean),
)

const DESIGN_LABEL = {
  not_started: 'designNotStarted',
  draft: 'designDraft',
  final: 'designFinal',
} as const
</script>

<template>
  <section class="space-y-3 text-sm" aria-labelledby="brief-heading" data-testid="collection-brief">
    <h3 id="brief-heading" class="text-sm font-semibold tracking-wide text-ink-700 uppercase">{{ t('aboutCollection') }}</h3>

    <!-- Scope & review status -->
    <dl class="grid gap-y-0.5 rounded-xl border border-line bg-surface px-4 py-3 [&>dd]:mb-2 [&>dd:last-child]:mb-0 [&>dt]:text-xs [&>dt]:font-medium [&>dt]:tracking-wide [&>dt]:uppercase">
      <dt class="text-ink-500">{{ t('regionalScope') }}</dt>
      <dd class="text-ink-900">{{ collection.reference.region }}</dd>
      <dt class="text-ink-500">{{ t('designStatus') }}</dt>
      <dd>
        <span class="font-medium text-ink-900" data-testid="design-status">{{ t(DESIGN_LABEL[brief.designStatus]) }}</span>
      </dd>
      <dt class="text-ink-500">{{ t('culturalReview') }}</dt>
      <dd>
        <span class="font-medium text-ink-900" data-testid="review-status">{{ localizedReview(brief.review.status) }}</span>
        <span v-if="brief.review.status !== 'reviewed'" class="block text-xs text-ink-500">
          {{ t('notReviewedNote') }}
        </span>
      </dd>
      <dt class="text-ink-500 capitalize">{{ brief.localityLabel }}</dt>
      <dd data-testid="locality-requirement">
        <template v-if="selectedLocality">{{ selectedLocality.name }}</template>
        <template v-else>
          <span class="text-ink-900">{{ brief.localityRequired ? t('requiredUnconfirmed') : t('notConfirmedStatus') }}</span>
          <span v-if="draftDirections.length" class="block text-xs text-ink-700" data-testid="draft-direction">
            {{ t('draftDirectionProvisional', { directions: draftDirections.join(', ') }) }}
          </span>
          <span v-if="brief.localityRequired" class="block text-xs text-ink-500">
            {{ t('noCulturalMotifs', { locality: brief.localityLabel }) }}
          </span>
        </template>
        <ul v-if="brief.localities.length" class="mt-1.5 flex flex-wrap gap-1.5" :aria-label="`${brief.localityLabel} options under research`">
          <li v-for="l in brief.localities" :key="l.id" class="rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-700 ring-1 ring-line">
            {{ l.name }}
          </li>
        </ul>
        <span v-else class="mt-1 block text-xs text-ink-500">{{ t('optionsDefinedByReviewers') }}</span>
        <span v-if="brief.localitiesNote" class="mt-1 block text-xs text-ink-500" data-testid="localities-note">{{ brief.localitiesNote }}</span>
      </dd>
    </dl>

    <!-- Draft design: what it uses and what it deliberately leaves out -->
    <details v-if="brief.draft" class="rounded-xl border border-[#ecd98f] bg-[#fffbeb] px-4 py-3" data-testid="brief-draft">
      <summary class="cursor-pointer font-medium text-ink-700">
        {{ t('draftDesign') }} <span class="font-normal text-ink-500">· {{ t('basedOn') }}</span>
      </summary>
      <p class="mt-2 text-xs font-medium text-ink-700">{{ t('uses') }}</p>
      <ul class="list-disc pl-4 text-xs text-ink-500">
        <li v-for="r in brief.draft.referencesUsed" :key="r">{{ r }}</li>
      </ul>
      <p class="mt-2 text-xs font-medium text-ink-700">{{ t('leftOut') }}</p>
      <ul class="list-disc pl-4 text-xs text-ink-500">
        <li v-for="r in brief.draft.leftOutPendingReview" :key="r">{{ r }}</li>
      </ul>
    </details>

    <!-- Review plan -->
    <details class="rounded-xl border border-line bg-surface px-4 py-3" data-testid="brief-review-plan">
      <summary class="cursor-pointer font-medium text-ink-700">
        {{ t('reviewPlan') }} <span class="font-normal text-ink-500">· {{ t('notContacted') }}</span>
      </summary>
      <p class="mt-2 text-xs font-medium text-ink-700">{{ t('whoShouldReview') }}</p>
      <ul class="list-disc pl-4 text-xs text-ink-500">
        <li v-for="r in brief.suggestedReviewers" :key="r">{{ r }}</li>
      </ul>
      <p class="mt-2 text-xs font-medium text-ink-700">{{ t('openQuestions') }}</p>
      <ul class="list-disc pl-4 text-xs text-ink-500">
        <li v-for="q in brief.openQuestions" :key="q">{{ q }}</li>
      </ul>
    </details>

    <!-- Sourced information -->
    <details class="rounded-xl border border-line bg-surface px-4 py-3" data-testid="brief-sources">
      <summary class="cursor-pointer font-medium text-ink-700">
        {{ t('sources') }} <span class="font-normal text-ink-500">· {{ t('verifiedCount', { verified: brief.sources.filter((s) => s.verified).length, total: brief.sources.length }) }}</span>
      </summary>
      <ul class="mt-2 space-y-2">
        <li v-for="s in brief.sources" :key="s.url">
          <a :href="s.url" target="_blank" rel="noopener noreferrer" class="font-medium text-rose-700 underline-offset-2 hover:underline">
            {{ s.title }}
          </a>
          <span class="block text-xs text-ink-500">{{ s.publisher }} · {{ s.verified ? t('verified') : t('notYetVerified') }}</span>
          <span class="block text-xs text-ink-500">{{ s.covers }}</span>
          <span v-if="s.accessNote" class="block text-xs text-rose-700">{{ s.accessNote }}</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-ink-700">
        {{ t('confirmedReferences') }} <strong>{{ confirmedCount === 0 ? t('noneYet') : confirmedCount }}</strong>
      </p>
    </details>

    <!-- Open research questions -->
    <details v-if="researchGroups.length" class="rounded-xl border border-line bg-surface px-4 py-3" data-testid="brief-research">
      <summary class="cursor-pointer font-medium text-ink-700">
        {{ t('researchingStatus') }} <span class="font-normal text-ink-500">· {{ t('notConfirmedStatus') }}</span>
      </summary>
      <dl class="mt-2 space-y-1.5">
        <div v-for="g in researchGroups" :key="g.label">
          <dt class="text-xs font-medium text-ink-700">{{ g.label }}</dt>
          <dd>
            <ul class="list-disc pl-4 text-xs text-ink-500">
              <li v-for="item in g.items" :key="item">{{ item }}</li>
            </ul>
          </dd>
        </div>
      </dl>
    </details>

    <!-- Creative art direction -->
    <details class="rounded-xl border border-line bg-surface px-4 py-3" data-testid="brief-art-direction">
      <summary class="cursor-pointer font-medium text-ink-700">
        {{ t('draftArtDirection') }} <span class="font-normal text-ink-500">· {{ t('creativeNotClaims') }}</span>
      </summary>
      <ul class="mt-2 flex flex-wrap gap-2" :aria-label="t('draftPalette')">
        <li v-for="c in brief.artDirection.palette" :key="c.hex + c.name" class="flex items-center gap-1.5 text-xs text-ink-700">
          <span class="size-4 rounded-full ring-1 ring-black/10" :style="{ backgroundColor: c.hex }" aria-hidden="true" />
          {{ c.name }}
        </li>
      </ul>
      <dl class="mt-2 space-y-1 text-xs">
        <div><dt class="inline font-medium text-ink-700">{{ t('type') }} </dt><dd class="inline text-ink-500">{{ brief.artDirection.typography }}</dd></div>
        <div><dt class="inline font-medium text-ink-700">{{ t('composition') }} </dt><dd class="inline text-ink-500">{{ brief.artDirection.composition }}</dd></div>
        <div><dt class="inline font-medium text-ink-700">{{ t('imagery') }} </dt><dd class="inline text-ink-500">{{ brief.artDirection.imagery }}</dd></div>
      </dl>
    </details>
  </section>
</template>
