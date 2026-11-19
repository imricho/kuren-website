<script setup lang="ts">
import { langOrUndefined } from '@/features/wedding/languages'
import { computed, ref, watch } from 'vue'
import type { WeddingContent, HolyReciteSection } from '@/features/wedding/types'
import { formatDate } from '@/features/wedding/format'
import { isDisplayableImageSrc } from '@/features/wedding/draft'
import CountdownTimer from './CountdownTimer.vue'
import AddToCalendar from './AddToCalendar.vue'
import { useIsDraftRender } from '../composables/useRenderMode'
import { amplopHasContent, holyReciteHasContent, showsPhysicalGifts, visibleBankAccounts } from '../visibility'

const props = defineProps<{ content: WeddingContent; section: 'holyRecite1' | 'holyRecite2' | 'date' | 'wishes' | 'amplopDigital' }>()
const isDraft = useIsDraftRender()
const id = computed(() => props.section === 'date' ? 'weddingDate' : props.section)
const scripture = computed(() => props.section.startsWith('holyRecite') ? props.content[props.section as 'holyRecite1' | 'holyRecite2'] as HolyReciteSection | undefined : undefined)
const gifts = computed(() => props.content.amplopDigital)
/** Enabled AND has something to show: an enabled-but-empty section renders nothing at all. */
const visible = computed(() => {
  switch (props.section) {
    case 'date': return true
    case 'wishes': return props.content.wishes?.enabled === true
    case 'amplopDigital': return amplopHasContent(gifts.value)
    default: return holyReciteHasContent(scripture.value)
  }
})
const isId = computed(() => props.content.locale === 'id')
const translationLang = computed(() => langOrUndefined(scripture.value?.translationLanguage))
const originalLang = computed(() => langOrUndefined(scripture.value?.originalLanguage))
/** "Book Reference · Attribution" (tradition is kept in the data but not shown). */
const citation = computed(() => {
  const s = scripture.value
  if (!s) return ''
  const source = [s.book?.trim(), s.reference?.trim()].filter(Boolean).join(' ')
  return [source, s.attribution?.trim()].filter(Boolean).join(' · ')
})
const accounts = computed(() => visibleBankAccounts(gifts.value))
const physical = computed(() => showsPhysicalGifts(gifts.value))
const showCalendar = computed(() => props.content.countdown?.addToCalendar === true)
const failedQrisUrl = ref<string>()
watch(() => gifts.value?.qrisImage?.src, () => { failedQrisUrl.value = undefined })
const failedQris = computed(() => !gifts.value?.qrisImage || !isDisplayableImageSrc(gifts.value.qrisImage.src) || failedQrisUrl.value === gifts.value.qrisImage.src)
</script>

<template>
  <section v-if="visible" class="universal-section" :data-section="id">
    <div class="universal-section__content">
      <div v-if="$slots.decoration" class="universal-section__decoration" aria-hidden="true"><slot name="decoration" /></div>
      <template v-if="scripture">
        <h2>{{ scripture.title?.trim() || (isId ? 'Kutipan Suci' : 'Sacred Passage') }}</h2>
        <p v-if="scripture.originalScript?.trim()" class="universal-script whitespace-pre-line" dir="auto" :lang="originalLang" data-role="original-script">{{ scripture.originalScript.trim() }}</p>
        <p v-if="scripture.passage?.trim()" class="universal-text whitespace-pre-line" dir="auto" data-role="passage">{{ scripture.passage.trim() }}</p>
        <p v-if="scripture.translation?.trim()" class="universal-text universal-translation whitespace-pre-line" dir="auto" :lang="translationLang" data-role="translation">{{ scripture.translation.trim() }}</p>
        <p v-if="citation" class="universal-citation" dir="auto" data-role="citation"><cite>{{ citation }}</cite></p>
      </template>
      <template v-else-if="section === 'date'">
        <h2>{{ isId ? 'Tanggal Pernikahan' : 'Wedding Date' }}</h2>
        <p><time :datetime="content.opening.weddingDate">{{ formatDate(content.opening.weddingDate, content.locale, 'full') }}</time></p>
        <CountdownTimer v-if="content.countdown?.enabled !== false" :content="content" />
        <AddToCalendar v-if="showCalendar" :content="content" />
      </template>
      <template v-else-if="section === 'wishes'">
        <h2>{{ content.wishes?.title?.trim() || (isId ? 'Ucapan & Doa' : 'Wishes & Prayers') }}</h2>
        <p v-if="content.wishes?.introduction?.trim()" class="universal-text whitespace-pre-line" dir="auto">{{ content.wishes.introduction.trim() }}</p>
        <p v-if="isDraft" class="universal-editor-note" role="note" data-editor-only>{{ isId ? 'Pengiriman ucapan online belum tersedia.' : 'Online wishes are not available yet.' }}</p>
      </template>
      <template v-else-if="section === 'amplopDigital' && gifts">
        <h2>{{ gifts.title?.trim() || 'Amplop Digital' }}</h2>
        <p v-if="gifts.message?.trim()" class="universal-text whitespace-pre-line" dir="auto">{{ gifts.message.trim() }}</p>
        <dl v-if="accounts.length" class="universal-accounts">
          <div v-for="(account, index) in accounts" :key="account.id || index">
            <dt dir="auto">{{ account.bankName }}</dt>
            <dd dir="auto">{{ account.accountHolder }}</dd>
            <dd><bdi>{{ account.accountNumber }}</bdi></dd>
          </div>
        </dl>
        <figure v-if="gifts.qrisEnabled && (isDraft || !failedQris)" class="universal-qris">
          <img v-if="!failedQris" :src="gifts.qrisImage!.src" :alt="gifts.qrisImage!.alt && gifts.qrisImage!.alt !== 'QRIS' ? gifts.qrisImage!.alt : (isId ? 'Kode QRIS' : 'QRIS code')" loading="lazy" @error="failedQrisUrl = gifts.qrisImage!.src" />
          <p v-else role="status">{{ isId ? 'Gambar QRIS tidak tersedia.' : 'QRIS image is unavailable.' }}</p>
          <figcaption>QRIS</figcaption>
        </figure>
        <div v-if="physical" class="universal-physical">
          <h3>{{ isId ? 'Kirim Hadiah' : 'Physical Gifts' }}</h3>
          <p v-if="gifts.physicalGifts!.recipient?.trim()" dir="auto">{{ gifts.physicalGifts!.recipient.trim() }}</p>
          <p v-if="gifts.physicalGifts!.address?.trim()" class="universal-text whitespace-pre-line" dir="auto">{{ gifts.physicalGifts!.address.trim() }}</p>
          <p v-if="gifts.physicalGifts!.phone?.trim()"><bdi>{{ gifts.physicalGifts!.phone.trim() }}</bdi></p>
          <p v-if="gifts.physicalGifts!.note?.trim()" class="universal-text whitespace-pre-line" dir="auto">{{ gifts.physicalGifts!.note.trim() }}</p>
        </div>
      </template>
    </div>
  </section>
</template>

<style>
.universal-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
.universal-section { position: relative; text-align: center; }
.universal-section__content { width: min(100%, 44rem); margin-inline: auto; position: relative; z-index: 1; overflow-wrap: anywhere; min-width: 0; }
.universal-section__decoration { display: flex; justify-content: center; margin-block-end: 1.5rem; }
.universal-section__decoration > * { width: 3.25rem; }
.universal-section h2 { font-family: var(--display, var(--mf-display, var(--rn-display, var(--serif, inherit)))); font-size: clamp(1.65rem, 5cqi, 2.75rem); margin-block: 0 1.5rem; }
.universal-section p { line-height: 1.8; }
/* Keep capped countdown rows centered on wide invitation layouts as well. */
.universal-section[data-section="weddingDate"] .countdown { margin-inline: auto; justify-content: center; }
.universal-section[data-section="weddingDate"] .countdown[data-unit-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.universal-text, .universal-script { white-space: pre-line; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.universal-citation { font-size: 0.9em; letter-spacing: 0.04em; opacity: 0.85; margin-block-start: 1.25rem; }
.universal-citation cite { font-style: normal; }
.universal-translation { font-style: italic; }
.universal-editor-note { font-size: 0.8em; opacity: 0.7; }
.universal-script { font-family: system-ui, sans-serif; font-size: clamp(1.3rem, 4cqi, 2rem); line-height: 2.2; }
.universal-accounts { display: grid; gap: 1.5rem; margin-block: 2rem; }
.universal-accounts dd { margin-inline: 0; overflow-wrap: anywhere; }
.universal-accounts dt { font-weight: 600; }
.universal-qris { position: relative; isolation: isolate; margin: 2rem auto; width: min(100%, 24rem); padding: 1rem; background: white; color: #222; }
.universal-qris img { position: static; display: block; width: 100%; height: auto; max-height: none; object-fit: contain; border-radius: 0; filter: none; opacity: 1; }
.universal-physical { margin-block-start: 2rem; }
</style>
