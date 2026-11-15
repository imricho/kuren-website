<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WeddingContent, HolyReciteSection } from '@/features/wedding/types'
import { formatDate, isSafeImageSrc } from '@/features/wedding/format'
import CountdownTimer from './CountdownTimer.vue'
const props = defineProps<{ content: WeddingContent; section: 'holyRecite1' | 'holyRecite2' | 'date' | 'wishes' | 'amplopDigital' }>()
const id = computed(() => props.section === 'date' ? 'weddingDate' : props.section)
const enabled = computed(() => props.section === 'date' || props.content[props.section]?.enabled === true)
const scripture = computed(() => props.section.startsWith('holyRecite') ? props.content[props.section as 'holyRecite1' | 'holyRecite2'] as HolyReciteSection : undefined)
const gifts = computed(() => props.content.amplopDigital)
const isId = computed(() => props.content.locale === 'id')
const failedQrisUrl = ref<string>()
watch(() => gifts.value?.qrisImage?.src, () => { failedQrisUrl.value = undefined })
const failedQris = computed(() => !gifts.value?.qrisImage || !isSafeImageSrc(gifts.value.qrisImage.src) || failedQrisUrl.value === gifts.value.qrisImage.src)
</script>

<template>
  <section v-if="enabled" class="universal-section" :data-section="id">
    <div class="universal-section__content">
      <div v-if="$slots.decoration" class="universal-section__decoration" aria-hidden="true"><slot name="decoration" /></div>
      <template v-if="scripture">
        <h2>{{ isId ? 'Kutipan Suci' : 'Sacred Passage' }}</h2>
        <p v-if="scripture.passage" class="universal-text" dir="auto">{{ scripture.passage }}</p>
        <p v-if="scripture.originalScript" class="universal-script" dir="auto">{{ scripture.originalScript }}</p>
        <p v-if="scripture.translation" class="universal-text" dir="auto">{{ scripture.translation }}</p>
        <p v-if="scripture.reference" class="universal-text" dir="auto">{{ scripture.reference }}</p>
      </template>
      <template v-else-if="section === 'date'">
        <h2>{{ isId ? 'Tanggal Pernikahan' : 'Wedding Date' }}</h2>
        <p><time :datetime="content.opening.weddingDate">{{ formatDate(content.opening.weddingDate, content.locale, 'full') }}</time></p>
        <CountdownTimer v-if="content.countdown?.enabled !== false" :content="content" />
      </template>
      <template v-else-if="section === 'wishes'">
        <h2>{{ content.wishes?.title || (isId ? 'Ucapan & Doa' : 'Wishes & Prayers') }}</h2>
        <p v-if="content.wishes?.introduction" class="universal-text" dir="auto">{{ content.wishes.introduction }}</p>
        <p role="status">{{ isId ? 'Pengiriman ucapan online belum tersedia.' : 'Online wishes are not available yet.' }}</p>
      </template>
      <template v-else-if="section === 'amplopDigital' && gifts">
        <h2>{{ gifts.title || 'Amplop Digital' }}</h2>
        <p v-if="gifts.message" class="universal-text" dir="auto">{{ gifts.message }}</p>
        <dl v-if="gifts.bankAccountsEnabled" class="universal-accounts">
          <div v-for="(account, index) in gifts.bankAccounts" :key="account.id || index">
            <dt>{{ account.bankName }}</dt>
            <dd>{{ account.accountHolder }}</dd>
            <dd><bdi>{{ account.accountNumber }}</bdi></dd>
          </div>
        </dl>
        <figure v-if="gifts.qrisEnabled" class="universal-qris">
          <img v-if="!failedQris" :src="gifts.qrisImage!.src" :alt="gifts.qrisImage!.alt || 'QRIS'" loading="lazy" @error="failedQrisUrl = gifts.qrisImage!.src" />
          <p v-else role="status">{{ isId ? 'Gambar QRIS tidak tersedia.' : 'QRIS image is unavailable.' }}</p>
          <figcaption>QRIS</figcaption>
        </figure>
        <div v-if="gifts.physicalGifts?.enabled" class="universal-physical">
          <h3>{{ isId ? 'Kirim Hadiah' : 'Physical Gifts' }}</h3>
          <p v-if="gifts.physicalGifts.recipient" dir="auto">{{ gifts.physicalGifts.recipient }}</p>
          <p v-if="gifts.physicalGifts.address" class="universal-text" dir="auto">{{ gifts.physicalGifts.address }}</p>
          <p v-if="gifts.physicalGifts.phone"><bdi>{{ gifts.physicalGifts.phone }}</bdi></p>
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
.universal-text, .universal-script { white-space: pre-wrap; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.universal-script { font-family: system-ui, sans-serif; font-size: clamp(1.3rem, 4cqi, 2rem); line-height: 2.2; }
.universal-accounts { display: grid; gap: 1.5rem; margin-block: 2rem; }
.universal-accounts dd { margin-inline: 0; overflow-wrap: anywhere; }
.universal-accounts dt { font-weight: 600; }
.universal-qris { position: relative; isolation: isolate; margin: 2rem auto; width: min(100%, 24rem); padding: 1rem; background: white; color: #222; }
.universal-qris img { position: static; display: block; width: 100%; height: auto; max-height: none; object-fit: contain; border-radius: 0; filter: none; opacity: 1; }
.universal-physical { margin-block-start: 2rem; }
</style>
