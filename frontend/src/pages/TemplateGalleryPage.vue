<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { THEMES } from '@/features/themes/core/registry'
import { previewRoute } from '@/features/themes/picker/routes'

const galleryPreview = (theme: typeof THEMES[number]) => ({ ...previewRoute(theme) as object, query: { from: 'gallery' } })
const visibleCount = ref(12)
const query = ref('')
const matching = computed(() => THEMES.filter(theme => `${theme.name} ${theme.tagline}`.toLowerCase().includes(query.value.toLowerCase().trim())))
const visible = computed(() => matching.value.slice(0, visibleCount.value))
</script>

<template>
<div
  class="public-gallery"
  lang="id"
>
  <a
    class="gallery-skip"
    href="#public-template-gallery"
  >Lewati ke koleksi template</a>
  <header class="public-gallery__header">
    <RouterLink
      to="/"
      class="gallery-brand"
    >Kuren</RouterLink>
    <RouterLink
      to="/#template"
      class="gallery-back"
    >← Kembali ke beranda</RouterLink>
  </header>
  <main
    class="public-gallery__main"
    id="public-template-gallery"
    tabindex="-1"
  >
    <p class="gallery-kicker">Koleksi Template</p>
    <h1>Temukan desain untuk cerita Anda</h1>
    <p class="gallery-description">Lihat contoh undangan dari koleksi yang tersedia. Pilih “Gunakan Template”
      saat Anda siap mulai menyusun.</p>
    <div class="gallery-search">
      <label for="public-template-search">Cari template</label>
      <input
        id="public-template-search"
        v-model="query"
        type="search"
        placeholder="Nama atau gaya template"
        @input="visibleCount = 12"
      />
    </div>
    <p
      class="gallery-count"
      role="status"
    >{{ matching.length }} template tersedia</p>
    <div class="public-gallery__grid">
      <RouterLink
        v-for="theme in visible"
        :key="theme.id"
        class="public-template"
        :to="galleryPreview(theme)"
        :aria-label="`Lihat template ${theme.name}`"
      >
        <img
          :src="theme.previewImage"
          :alt="`Desain ${theme.name}`"
          loading="lazy"
          width="320"
          height="200"
        />
        <div class="public-template__caption">
          <h2>{{ theme.name }}</h2>
          <p>{{ theme.tagline }}</p><span>Lihat Template <span aria-hidden="true">→</span></span>
        </div>
      </RouterLink>
    </div>
    <p
      v-if="!matching.length"
      class="gallery-empty"
    >Belum ada template yang cocok. Coba kata kunci lain.</p>
    <button
      v-if="visible.length < matching.length"
      class="gallery-more"
      type="button"
      @click="visibleCount += 12"
    >Tampilkan lebih banyak</button>
  </main>
  <footer class="public-gallery__footer">
    <RouterLink to="/">Kuren</RouterLink> · Undangan indah. Cerita Anda.
  </footer>
</div>
</template>

<style scoped>
.gallery-skip {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 70;
  padding: 12px;
  background: white;
  color: #352039;
  border-radius: 8px;
  transform: translateY(-180%);
}

.gallery-skip:focus {
  transform: none;
}

.public-gallery {
  min-height: 100dvh;
  color: #2e1934;
  background: #f8f3fa;
  font-family: Arial, Helvetica, sans-serif;
}

.public-gallery__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px max(24px, calc((100% - 1200px) / 2));
  border-bottom: 1px solid #e6d9eb;
  background: #352039;
  color: #fff;
}

.gallery-brand {
  font: 32px Georgia, serif;
  color: #fff;
  text-decoration: none;
}

.gallery-back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 14px;
  color: #fff;
  text-decoration: none;
}

.public-gallery__main {
  width: calc(100% - 48px);
  max-width: 1200px;
  margin: auto;
  padding: 48px 0;
}

.gallery-kicker {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: .18em;
  color: #794c82;
  text-align: center;
}

.public-gallery h1 {
  font: 400 clamp(30px, 4vw, 44px)/1.15 Georgia, serif;
  color: #32163b;
  text-align: center;
  margin: 12px 0;
}

.gallery-description {
  max-width: 650px;
  margin: 0 auto;
  text-align: center;
  color: #67556d;
  font-size: 14px;
  line-height: 1.7;
}

.gallery-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 440px;
  margin: 28px auto 0;
}

.gallery-search label {
  font-size: 13px;
  font-weight: 600;
}

.gallery-search input {
  min-height: 46px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ad90b5;
  border-radius: 10px;
  background: #fff;
  color: #301c37;
  font: inherit;
  font-size: 14px;
}

.gallery-count {
  margin: 28px 0 14px;
  font-size: 13px;
  color: #6c5674;
}

.public-gallery__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.public-template {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e6d9eb;
  border-radius: 14px;
  background: #fff;
  color: #2f1937;
  text-decoration: none;
  box-shadow: 0 4px 14px #47234e0b;
}

.public-template:hover {
  box-shadow: 0 6px 20px #47234e20;
}

.public-template img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1.6;
  object-fit: cover;
  background: #ede2f0;
}

.public-template__caption {
  padding: 16px;
}

.public-template h2 {
  font: 600 15px/1.4 Arial, Helvetica, sans-serif;
  letter-spacing: 0;
  color: #321a3a;
  margin: 0;
}

.public-template p {
  color: #6d5a73;
  font-size: 12px;
  line-height: 1.5;
  margin: 6px 0 16px;
}

.public-template__caption>span {
  font-size: 12px;
  font-weight: 600;
  color: #754180;
}

.gallery-more {
  display: block;
  min-height: 46px;
  margin: 32px auto 0;
  padding: 12px 24px;
  border: 1px solid #6c3d78;
  border-radius: 10px;
  color: #fff;
  background: #56305f;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.gallery-empty {
  text-align: center;
  padding: 30px 0;
  font-size: 14px;
}

.public-gallery__footer {
  padding: 24px;
  border-top: 1px solid #e6d9eb;
  color: #796180;
  text-align: center;
  font-size: 12px;
}

.public-gallery__footer a {
  color: #583461;
}

.public-gallery a:focus-visible,
.public-gallery button:focus-visible,
.public-gallery input:focus-visible {
  outline: 3px solid #a77b36;
  outline-offset: 4px;
}

@media(max-width: 900px) {
  .public-gallery__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}

@media(max-width: 640px) {
  .public-gallery__header {
    padding: 14px 20px;
  }

  .gallery-brand {
    font-size: 28px;
  }

  .gallery-back {
    font-size: 12px;
  }

  .public-gallery__main {
    width: calc(100% - 32px);
    padding: 32px 0;
  }

  .public-gallery__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .public-template__caption {
    padding: 12px;
  }

  .public-template h2 {
    font-size: 13px;
  }

  .public-template p {
    font-size: 11px;
  }

  .gallery-description {
    font-size: 13px;
  }
}

@media(max-width: 360px) {
  .public-gallery__grid {
    grid-template-columns: 1fr;
  }

  .public-template img {
    aspect-ratio: 1.8;
  }
}
</style>
