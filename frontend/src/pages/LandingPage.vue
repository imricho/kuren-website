<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getTheme, templateSlug } from '@/features/themes/core/registry'
import LandingPreview from '@/features/landing/LandingPreview.vue'
import ornament from '@/features/themes/royal-maroon-v2/assets/botanical-corner.webp'
const auth = useAuthStore()
const menuOpen = ref(false)
const gallery = ['royal-maroon-v2', 'ivory-processional', 'conventional', 'international'].map(id => getTheme(id)!)
const previewPath = (theme: typeof gallery[number]) => `/themes/${theme.familyId}/${theme.collectionId}/${templateSlug(theme)}/preview?from=landing`
const join = { name: 'register' }
const features = [
  { icon: 'screen', title: 'Editor Intuitif', text: 'Atur cerita, foto, dan acara melalui editor yang terstruktur.' },
  { icon: 'grid', title: 'Bagian yang Lengkap', text: 'Dari profil mempelai dan kisah cinta hingga detail acara.' },
  { icon: 'eye', title: 'Preview Langsung', text: 'Lihat undangan dengan konten Anda sebelum dibagikan.' },
  { icon: 'phone', title: 'Tampil di Semua Layar', text: 'Pratinjau tampilan desktop dan ponsel dalam satu tempat.' },
  { icon: 'shield', title: 'Ruang Kerja Pribadi', text: 'Masuk ke akun untuk mengelola konten undangan Anda.' },
  { icon: 'gift', title: 'Cerita & Galeri', text: 'Rangkai kisah cinta dan tampilkan foto momen istimewa.' },
]
const plans = [
  { name: 'Free', price: '0', note: 'Untuk mulai merangkai cerita.', items: ['Mengenal editor Kuren', 'Menyusun konten undangan', 'Melihat pratinjau desain'], cta: 'Mulai Gratis' },
  { name: 'Premium', price: '99.000', note: 'Rencana harga per undangan.', items: ['Rencana koleksi template standar', 'Rencana bagian undangan lengkap', 'Rencana personalisasi undangan', 'Detail paket akan dikonfirmasi'], cta: 'Buat Akun' },
  { name: 'Signature', price: '199.000', note: 'Rencana harga per undangan.', items: ['Rencana koleksi template premium', 'Rencana pilihan desain tambahan', 'Detail layanan akan dikonfirmasi', 'Detail paket akan dikonfirmasi'], cta: 'Buat Akun' },
]
const faqs = [
  ['Apa itu Kuren?', 'Kuren adalah ruang untuk menyusun undangan pernikahan digital: memilih desain, mengisi cerita, menambahkan detail acara, dan melihat pratinjau.'],
  ['Apakah saya perlu keahlian desain?', 'Tidak. Mulai dari template yang tersedia, lalu isi konten melalui editor. Anda dapat memeriksa hasilnya di pratinjau.'],
  ['Bagaimana cara membuat undangan?', 'Buat akun, lengkapi nama dan tanggal pernikahan, pilih template, lalu susun bagian undangan melalui dashboard.'],
  ['Apakah pembayaran sudah tersedia?', 'Belum. Harga Free, Premium, dan Signature masih merupakan rencana awal. Halaman ini tidak memproses pembayaran atau mengaktifkan paket berbayar.'],
  ['Berapa lama undangan bisa diakses?', 'Masa aktif dan ketentuan publikasi akan dikonfirmasi saat layanan tersedia. Saat ini Anda dapat menyusun dan meninjau undangan di CMS.'],
  ['Apakah saya bisa mengganti tema nantinya?', 'Ya. Pilih template lain melalui studio tema. Konten pernikahan dikelola terpisah dari tampilan desain.'],
]
</script>

<template>
<div
  class="kuren-landing"
  lang="id"
>
  <a
    class="landing-skip"
    href="#landing-main"
  >Lewati ke konten utama</a>
  <header class="landing-header landing-container">
    <RouterLink
      to="/"
      class="landing-brand"
      aria-label="Kuren, beranda"
    ><svg
        viewBox="0 0 40 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20 39V17M20 31C4 31 3 16 4 12c12 1 18 8 16 19Zm0 0c16 0 17-15 16-19-12 1-18 8-16 19ZM20 25C9 19 12 7 20 2c8 5 11 17 0 23ZM20 36C7 39 1 30 2 25c10-2 16 2 18 11Zm0 0c13 3 19-6 18-11-10-2-16 2-18 11Z"
          stroke="currentColor"
        />
      </svg>Kuren</RouterLink>
    <button
      class="landing-menu-toggle"
      type="button"
      :aria-expanded="menuOpen"
      aria-controls="landing-navigation"
      @click="menuOpen = !menuOpen"
    >{{ menuOpen ? 'Tutup' : 'Menu' }} <span aria-hidden="true">☰</span></button>
    <nav
      id="landing-navigation"
      class="landing-navigation"
      :class="{ 'is-open': menuOpen }"
      aria-label="Navigasi utama"
      @click="menuOpen = false"
    ><a href="#template">Template</a><a href="#fitur">Fitur</a><a href="#harga">Harga</a><a
        href="#inspirasi">Inspirasi</a><a href="#bantuan">Bantuan</a></nav>
    <div class="header-actions">
      <RouterLink
        class="landing-button landing-button--outline landing-button--small"
        :to="auth.isAuthenticated ? '/dashboard' : '/login'"
      >{{ auth.isAuthenticated ? 'Dashboard' : 'Masuk' }}</RouterLink>
      <RouterLink
        class="landing-button landing-button--gold landing-button--small"
        :to="join"
      >Buat Undangan <span aria-hidden="true">→</span></RouterLink>
    </div>
  </header>
  <main
    id="landing-main"
    tabindex="-1"
  >
    <section class="landing-hero">
      <div class="hero-body landing-container">
        <div class="hero-copy">
          <p class="landing-eyebrow">Undangan Pernikahan Digital</p>
          <h1>Undangan Pernikahan<br class="desktop-break" /> Elegan, Sesuai Cerita Anda</h1>
          <p class="hero-description">Buat undangan pernikahan digital yang indah, personal,<br class="desktop-break" />
            dan mudah dipersonalisasi. Pilih desain favorit, rangkai cerita,<br class="desktop-break" /> dan persiapkan
            hari istimewa Anda.</p>
          <div class="hero-actions">
            <RouterLink
              class="landing-button landing-button--gold"
              :to="join"
            >Buat Undangan Sekarang <span aria-hidden="true">→</span></RouterLink><a
              class="landing-button landing-button--outline"
              href="#template"
            >Lihat Koleksi Template</a>
          </div>
          <div class="hero-benefits"><span><b aria-hidden="true">∞</b>Konten yang Personal</span><span><svg
                viewBox="0 0 24 28"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="1"
                  width="14"
                  height="26"
                  rx="2"
                />
                <path d="M10 4h4m-3 20h2" />
              </svg>Tampil di Desktop<br />dan Ponsel</span><span><svg
                viewBox="0 0 28 28"
                aria-hidden="true"
              >
                <path d="m3 7 5-5h12l5 5-11 19L3 7Zm0 0h22M8 2l6 24L20 2" />
              </svg>Pilihan Desain<br />yang Berkarakter</span></div>
        </div>
        <div
          class="hero-showcase"
          role="img"
          aria-label="Contoh editor Kuren di laptop dan undangan Royal Maroon v2 di ponsel"
        >
          <div class="showcase-pedestal"></div>
          <div class="showcase-laptop">
            <div class="laptop-screen">
              <div class="mock-toolbar"><span>♧ Kuren</span><span>◉ &nbsp; ▯ &nbsp; Pratinjau</span></div>
              <div class="mock-workspace">
                <div class="mock-sidebar"><strong>Royal Maroon v2⌄</strong><small>Konten Undangan</small><span
                    class="selected"
                  >▧ &nbsp; Sampul / Pembuka</span><span>♧ &nbsp; Profil Mempelai</span><span>♡ &nbsp; Kisah
                    Kami</span><span>⌖ &nbsp; Acara & Lokasi</span><span>▧ &nbsp; Momen Kami</span><span>✉ &nbsp;
                    RSVP</span><span>♧ &nbsp; Penutup</span></div>
                <div class="laptop-invitation">
                  <LandingPreview template-id="royal-maroon-v2" />
                </div>
              </div>
            </div>
            <div class="laptop-base"></div>
          </div>
          <div class="showcase-phone">
            <div class="phone-notch"></div>
            <LandingPreview template-id="royal-maroon-v2" />
          </div>
        </div>
      </div>
    </section>

    <section
      id="template"
      class="landing-gallery"
    >
      <div class="landing-container">
        <header class="landing-section-heading">
          <p class="landing-kicker">Koleksi Template</p>
          <h2>Temukan Desain yang Mewakili Kisah Anda</h2>
          <p>Dari ornamen klasik dan floral romantis<br />hingga gaya editorial yang tenang.</p>
        </header>
        <div
          id="inspirasi"
          class="template-grid"
        >
          <RouterLink
            v-for="theme in gallery"
            :key="theme.id"
            class="template-card"
            :to="previewPath(theme)"
            :aria-label="`Lihat template ${theme.name}`"
          >
            <div class="template-card__preview">
              <LandingPreview :template-id="theme.id" />
            </div>
            <div class="template-card__caption">
              <div>
                <h3>{{ theme.name }}</h3>
                <p>
                  {{ theme.familyId === 'traditional' ? 'Classic Elegance' : theme.familyId === 'classic' ? 'Romantic Garden' : 'Modern Editorial' }}
                </p>
              </div><span
                class="circle-arrow"
                aria-hidden="true"
              >→</span>
            </div>
          </RouterLink>
          <RouterLink
            to="/templates"
            class="template-all"
          ><svg
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <path d="m3 12 13-7 13 7-13 7-13-7Zm0 6 13 7 13-7M3 24l13 7 13-7" />
            </svg><span>Lihat <br />Semua Template</span><span
              class="circle-arrow"
              aria-hidden="true"
            >→</span></RouterLink>
        </div>
      </div>
    </section>

    <section
      id="fitur"
      class="landing-features"
    >
      <div class="landing-container">
        <header class="landing-section-heading">
          <p class="landing-kicker">Fitur Lengkap</p>
          <h2>Semua yang Anda Butuhkan<br />untuk Merangkai Undangan</h2>
        </header>
        <div class="feature-grid">
          <article
            v-for="feature in features"
            :key="feature.title"
          ><svg
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <g v-if="feature.icon === 'screen'">
                <rect
                  x="3"
                  y="3"
                  width="26"
                  height="19"
                  rx="1"
                />
                <path d="M10 28h12m-6-6v6M3 18h26" />
              </g>
              <g v-else-if="feature.icon === 'grid'">
                <rect
                  x="3"
                  y="3"
                  width="10"
                  height="10"
                  rx="1"
                />
                <rect
                  x="19"
                  y="3"
                  width="10"
                  height="10"
                  rx="1"
                />
                <rect
                  x="3"
                  y="19"
                  width="10"
                  height="10"
                  rx="1"
                />
                <rect
                  x="19"
                  y="19"
                  width="10"
                  height="10"
                  rx="1"
                />
              </g>
              <g v-else-if="feature.icon === 'eye'">
                <path d="M2 16S8 6 16 6s14 10 14 10-6 10-14 10S2 16 2 16Z" />
                <circle
                  cx="16"
                  cy="16"
                  r="5"
                />
              </g>
              <g v-else-if="feature.icon === 'phone'">
                <rect
                  x="8"
                  y="2"
                  width="16"
                  height="28"
                  rx="2"
                />
                <path d="M14 5h4m-3 22h2" />
              </g>
              <g v-else-if="feature.icon === 'shield'">
                <path d="m16 2 12 5v10c0 7-12 13-12 13S4 24 4 17V7l12-5Z" />
                <path d="m10 15 4 4 8-9" />
              </g>
              <g v-else>
                <path
                  d="M4 14h24v15H4ZM2 8h28v6H2Zm14 0v21M16 8C5 10 5 0 11 2c3 1 5 6 5 6Zm0 0c11 2 11-8 5-6-3 1-5 6-5 6Z"
                />
              </g>
            </svg>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section
      id="harga"
      class="landing-pricing"
    ><img
        class="pricing-ornament"
        :src="ornament"
        alt=""
      />
      <div class="landing-container pricing-faq-grid">
        <div class="pricing-column">
          <header class="landing-section-heading">
            <p class="landing-kicker">Paket Harga</p>
            <h2>Pilih Paket yang Sesuai dengan Kebutuhan Anda</h2>
            <p>Mulai merangkai cerita, temukan pilihan untuk hari istimewa.</p>
          </header>
          <p class="pricing-notice">Harga awal yang direncanakan · Paket berbayar dan pembayaran belum tersedia.</p>
          <div class="pricing-cards">
            <article
              v-for="(plan, index) in plans"
              :key="plan.name"
              class="price-card"
              :class="{ 'price-card--premium': index === 1 }"
            >
              <div class="price-card__top">
                <h3>{{ plan.name }}</h3><span
                  v-if="index === 1"
                  class="plan-badge"
                >Rencana Premium</span>
              </div>
              <p class="plan-price"><span>Rp</span>{{ plan.price }}</p>
              <p class="plan-note">{{ plan.note }}</p>
              <ul>
                <li
                  v-for="item in plan.items"
                  :key="item"
                ><span aria-hidden="true">✓</span>{{ item }}</li>
              </ul>
              <RouterLink
                class="landing-button"
                :class="index === 1 ? 'landing-button--gold' : 'landing-button--plum'"
                :to="join"
              >{{ plan.cta }}<span
                  v-if="index === 1"
                  aria-hidden="true"
                >→</span></RouterLink>
            </article>
          </div>
        </div>
        <aside
          id="bantuan"
          class="landing-faq"
        >
          <h2>Pertanyaan <br />yang Sering Diajukan</h2>
          <details
            v-for="faq in faqs"
            :key="faq[0]"
          >
            <summary>{{ faq[0] }}<span aria-hidden="true">⌄</span></summary>
            <p>{{ faq[1] }}</p>
          </details>
        </aside>
      </div>
    </section>

    <section class="landing-closing"><img
        class="closing-ornament closing-ornament--left"
        :src="ornament"
        alt=""
      /><img
        class="closing-ornament closing-ornament--right"
        :src="ornament"
        alt=""
      />
      <div class="landing-container">
        <h2>Mulai Cerita Pernikahan Anda<br />Bersama Kuren</h2>
        <RouterLink
          :to="join"
          class="landing-button landing-button--gold"
        >Buat Undangan Sekarang <span aria-hidden="true">→</span></RouterLink>
      </div>
    </section>
  </main>
  <footer class="landing-footer landing-container">
    <RouterLink
      to="/"
      class="footer-brand"
    >Kuren</RouterLink>
    <p>Undangan indah. Cerita Anda.</p>
    <nav aria-label="Navigasi footer"><a href="#template">Template</a><a href="#harga">Harga</a><a
        href="#bantuan">Bantuan</a>
      <RouterLink to="/login">Masuk</RouterLink>
    </nav><small>© {{ new Date().getFullYear() }} Kuren</small>
  </footer>
</div>
</template>

<style scoped>
.kuren-landing {
  --plum: #321634;
  --purple: #6e3675;
  --champagne: #ecd0a9;
  --lavender: #f3ebf7;
  color: #26122f;
  background: #fcf9fd;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  overflow: clip
}

.kuren-landing * {
  box-sizing: border-box
}

.kuren-landing h1,
.kuren-landing h2,
.landing-brand,
.footer-brand {
  font-family: Georgia, 'Times New Roman', serif;
  letter-spacing: -.035em;
  font-weight: 400
}

.kuren-landing h1,
.kuren-landing h2,
.kuren-landing h3,
.kuren-landing p {
  margin: 0
}

.kuren-landing a {
  text-decoration: none
}

.kuren-landing a:focus-visible,
.kuren-landing button:focus-visible,
.kuren-landing summary:focus-visible {
  outline: 3px solid #9c6f38;
  outline-offset: 5px
}

.landing-container {
  max-width: 1376px;
  width: calc(100% - 144px);
  margin: auto
}

.landing-skip {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  background: #fff;
  color: #321634;
  padding: 12px;
  transform: translateY(-180%)
}

.landing-skip:focus {
  transform: none
}

.landing-hero {
  padding-top: 100px;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  color: #fff7fb;
  background: #3b2040
}

.landing-header {
  position: absolute !important;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 100px;
  display: flex;
  align-items: center;
  gap: 60px;
  position: relative;
  z-index: 5
}

.landing-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  font-size: 38px;
  letter-spacing: -1px
}

.landing-brand svg {
  width: 40px;
  height: 44px;
  color: #f5e9d8
}

.landing-navigation {
  display: flex;
  gap: 32px;
  flex: 1
}

.landing-navigation a {
  color: #fff;
  font-size: 14px
}

.header-actions {
  display: flex;
  gap: 16px
}

.landing-button {
  min-height: 50px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 13px 25px;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  transition: background .15s, box-shadow .15s
}

.landing-button--gold {
  background: linear-gradient(110deg, #e7c99d, #f5dec0);
  color: #271329;
  box-shadow: inset 0 1px 0 #fff5
}

.landing-button--gold:hover {
  background: #f7dfba;
  box-shadow: 0 4px 18px #1b0c2320
}

.landing-button--outline {
  border-color: #e1d3e0;
  color: #fff;
  background: #2c142c20
}

.landing-button--outline:hover {
  background: #ffffff12
}

.landing-button--small {
  min-height: 40px;
  padding: 9px 18px;
  border-radius: 11px;
  font-size: 13px
}

.landing-menu-toggle {
  display: none
}

.hero-body {
  min-height: 510px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  position: relative
}

.hero-copy {
  position: relative;
  z-index: 3;
  align-self: start;
  padding-top: 30px;
  padding-bottom: 74px
}

.landing-eyebrow {
  text-transform: uppercase;
  letter-spacing: .15em;
  font-size: 13px;
  color: #f4d9b3;
  font-weight: 600
}

.hero-copy h1 {
  font-size: 47px;
  line-height: 1.1;
  color: #fff9fc;
  margin: 12px 0 24px;
  max-width: 670px
}

.hero-description {
  font-size: 16px;
  line-height: 1.6;
  color: #f6edf7
}

.hero-actions {
  display: flex;
  gap: 18px;
  margin-top: 28px
}

.hero-benefits {
  display: flex;
  align-items: center;
  gap: 30px;
  margin-top: 40px;
  font-size: 12px;
  line-height: 1.45
}

.hero-benefits>span {
  display: flex;
  align-items: center;
  gap: 11px
}

.hero-benefits b {
  font-size: 37px;
  line-height: 1;
  font-weight: 400
}

.hero-benefits svg {
  width: 28px;
  height: 28px;
  stroke: currentColor;
  stroke-width: 1.3;
  fill: none;
  flex-shrink: 0
}

.hero-showcase {
  height: 490px;
  position: relative;
  align-self: end;
  margin-left: 24px;
  pointer-events: none
}

.showcase-laptop {
  position: absolute;
  width: 94%;
  height: 400px;
  right: 5%;
  top: 14px;
  z-index: 2
}

.laptop-screen {
  height: 95%;
  border: 10px solid #151316;
  border-radius: 24px 24px 6px 6px;
  outline: 2px solid #d7c4d3;
  background: #f0e8eb;
  overflow: hidden;
  box-shadow: 0 15px 35px #140c2433
}

.mock-toolbar {
  height: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9px;
  color: #403540;
  background: #faf7f8;
  border-bottom: 1px solid #e0d7db
}

.mock-workspace {
  display: flex;
  height: calc(100% - 32px);
  padding: 10px 14px 0 0;
  gap: 20px
}

.mock-sidebar {
  width: 33%;
  padding: 3px 8px;
  font-size: 9px;
  color: #3d303c;
  display: flex;
  flex-direction: column;
  gap: 17px;
  flex-shrink: 0
}

.mock-sidebar strong {
  font-weight: 500;
  font-size: 10px
}

.mock-sidebar small {
  font-size: 8px;
  font-weight: 600
}

.mock-sidebar span {
  white-space: nowrap
}

.mock-sidebar .selected {
  background: #e5ccba;
  border-radius: 4px;
  padding: 5px;
  margin: -5px
}

.laptop-invitation {
  width: 57%;
  height: 540px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 0 18px #4c25312a
}

.laptop-base {
  height: 17px;
  position: absolute;
  bottom: 0;
  left: -8%;
  right: -8%;
  background: linear-gradient(#ddd1da, #4a414c 48%, #ada3ae 70%, #2e2631);
  border-radius: 3px 3px 70% 70%;
  box-shadow: 0 7px 10px #21132266
}

.showcase-phone {
  transform: translateY(-28px);
  width: 25%;
  height: 310px;
  position: absolute;
  right: -1%;
  top: 133px;
  z-index: 3;
  background: #19151a;
  border: 6px solid #181419;
  border-radius: 26px;
  box-shadow: 0 0 0 2px #c5aab7, 0 10px 20px #190b274d;
  overflow: hidden
}

.phone-notch {
  width: 48%;
  height: 10px;
  border-radius: 0 0 10px 10px;
  background: #171116;
  position: absolute;
  top: 0;
  left: 26%;
  z-index: 2
}

.showcase-pedestal {
  position: absolute;
  bottom: -12px;
  left: -18%;
  right: -15%;
  height: 140px;
  background: url('../features/landing/purple-granite-photo.png') center bottom / 100% 100% no-repeat;
  pointer-events: none
}

.landing-gallery {
  background: radial-gradient(ellipse at center, #fdfbfe, #f0e6f4);
  padding: 38px 0 40px
}

.landing-section-heading {
  text-align: center
}

.landing-kicker {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  text-transform: uppercase;
  letter-spacing: .2em;
  font-size: 11px;
  font-weight: 600;
  color: #773c7d
}

.landing-kicker:before,
.landing-kicker:after {
  content: '⟵';
  color: #af83b3;
  font-size: 16px;
  font-weight: 400;
  letter-spacing: 0
}

.landing-kicker:after {
  content: '⟶'
}

.landing-section-heading h2 {
  font-size: 39px;
  line-height: 1.16;
  margin-top: 12px;
  color: #2b1233
}

.landing-section-heading>p:last-child:not(.landing-kicker) {
  color: #4c4052;
  font-size: 15px;
  line-height: 1.5;
  margin-top: 10px
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) .73fr;
  gap: 20px;
  margin-top: 28px;
  scroll-margin-top: 20px
}

.template-card {
  display: block;
  overflow: hidden;
  border-radius: 14px;
  background: #fcf9fb;
  color: #211327;
  box-shadow: 0 6px 18px #43204914;
  border: 1px solid #fff9;
  transition: transform .15s, box-shadow .15s
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px #43204922
}

.template-card__preview {
  height: 235px;
  overflow: hidden
}

.template-card__caption {
  padding: 15px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px
}

.template-card h3 {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.3;
  font-weight: 600;
  color: #28132f;
  letter-spacing: -.02em
}

.template-card p {
  font-size: 12px;
  color: #66586b;
  margin-top: 3px
}

.circle-arrow {
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  border: 1px solid #ad97b1;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 19px
}

.template-all {
  background: #e7dbed;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  color: #391841;
  text-align: center;
  font-size: 15px;
  font-weight: 600
}

.template-all svg {
  width: 28px;
  height: 28px;
  stroke: #75497a;
  stroke-width: 1.4;
  fill: none
}

.template-all .circle-arrow {
  background: #fff;
  border: 0
}

.landing-features {
  padding: 28px 0 40px;
  background: linear-gradient(110deg, #fdfbfe, #faf6fc)
}

.landing-features .landing-section-heading h2 {
  font-size: 34px
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  margin-top: 28px
}

.feature-grid article {
  text-align: center;
  padding: 0 22px;
  border-right: 1px solid #e9dfed
}

.feature-grid article:last-child {
  border: 0
}

.feature-grid svg {
  display: block;
  width: 32px;
  height: 32px;
  margin: 0 auto 14px;
  stroke: #733d7b;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none
}

.feature-grid h3 {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #24102e;
  line-height: 1.35;
  letter-spacing: -.02em
}

.feature-grid p {
  font-size: 13px;
  line-height: 1.5;
  color: #56465d;
  margin-top: 9px
}

.landing-pricing {
  position: relative;
  overflow: hidden;
  padding: 32px 0 34px;
  background: radial-gradient(ellipse at 50% 90%, #fff, #f1e8f6)
}

.pricing-ornament {
  position: absolute;
  width: 230px;
  left: -80px;
  top: -20px;
  opacity: .21;
  filter: sepia(.3) hue-rotate(230deg) saturate(.4);
  pointer-events: none
}

.pricing-faq-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr);
  gap: 38px;
  position: relative
}

.pricing-column .landing-section-heading h2 {
  font-size: 29px
}

.pricing-column .landing-section-heading>p:last-child {
  font-size: 13px
}

.pricing-notice {
  text-align: center;
  color: #6e4b75;
  font-size: 11px;
  margin-top: 9px !important
}

.pricing-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 17px;
  align-items: stretch;
  margin-top: 22px
}

.price-card {
  padding: 20px 20px 17px;
  background: #ffffff90;
  border: 1px solid #e7dceb;
  border-radius: 13px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 5px 14px #51355a0a
}

.price-card--premium {
  background: linear-gradient(135deg, #442047, #704774);
  color: #fff;
  border-color: #69446e;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px #46234824
}

.price-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px
}

.price-card h3 {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 16px;
  letter-spacing: -.02em;
  font-weight: 600;
  color: inherit
}

.plan-badge {
  font-size: 8px;
  padding: 4px 6px;
  border-radius: 20px;
  white-space: nowrap;
  background: #ecd0a9;
  color: #291331
}

.plan-price {
  font-family: Georgia, serif;
  font-size: 32px;
  letter-spacing: -.05em;
  margin-top: 9px !important;
  line-height: 1.25
}

.plan-price>span {
  font-size: 20px;
  letter-spacing: -.02em;
  margin-right: 1px
}

.plan-note {
  font-size: 11px;
  margin-top: 6px !important;
  opacity: .85
}

.price-card ul {
  list-style: none;
  margin: 20px 0 22px;
  padding: 0;
  font-size: 12px;
  line-height: 1.5;
  flex: 1
}

.price-card li {
  display: flex;
  gap: 9px;
  margin-top: 9px
}

.price-card li>span {
  font-size: 12px;
  flex-shrink: 0
}

.price-card .landing-button {
  font-size: 11px;
  padding: 10px 8px;
  min-height: 39px;
  border-radius: 9px;
  gap: 8px
}

.landing-button--plum {
  border-color: #97719e;
  background: transparent;
  color: #693573
}

.landing-button--plum:hover {
  background: #eee1f3
}

.landing-faq {
  border-left: 1px solid #cdb8d5;
  padding-left: 38px;
  margin-top: 30px
}

.landing-faq h2 {
  font-size: 29px;
  line-height: 1.1;
  color: #28112e;
  margin-bottom: 24px
}

.landing-faq details {
  border-top: 1px solid #e0d3e6
}

.landing-faq details:last-child {
  border-bottom: 1px solid #d1bdd9
}

.landing-faq summary {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 16px 0;
  list-style: none
}

.landing-faq summary::-webkit-details-marker {
  display: none
}

.landing-faq summary>span {
  font-weight: 400;
  font-size: 17px
}

.landing-faq details[open] summary>span {
  transform: rotate(180deg)
}

.landing-faq details p {
  font-size: 12px;
  line-height: 1.65;
  color: #614b6a;
  padding-bottom: 18px
}

.landing-closing {
  position: relative;
  overflow: hidden;
  text-align: center;
  color: #fff6fa;
  background: radial-gradient(ellipse at 60% 60%, #774b77, transparent 65%), linear-gradient(110deg, #301632, #4a254c);
  padding: 20px 0 22px
}

.landing-closing h2 {
  font-size: 30px;
  color: #fff4fa;
  line-height: 1.12
}

.landing-closing .landing-button {
  margin-top: 14px;
  min-height: 42px;
  padding: 10px 24px;
  font-size: 12px;
  border-radius: 10px
}

.closing-ornament {
  position: absolute;
  width: 310px;
  pointer-events: none;
  opacity: .42
}

.closing-ornament--left {
  left: -10px;
  bottom: -112px;
  transform: rotate(5deg)
}

.closing-ornament--right {
  right: -10px;
  bottom: -112px;
  transform: scaleX(-1) rotate(5deg)
}

.landing-footer {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 24px;
  padding-bottom: 24px;
  color: #775f7e;
  font-size: 12px
}

.footer-brand {
  font-size: 25px;
  color: #432149
}

.landing-footer nav {
  display: flex;
  gap: 24px;
  margin-left: auto
}

.landing-footer a {
  color: #55335e
}

.landing-footer small {
  font-size: 11px
}

.kuren-landing section[id],
.landing-faq {
  scroll-margin-top: 24px
}

@media(min-width:1500px) {
  .hero-body {
    min-height: 560px
  }

  .hero-copy {
    padding-top: 45px
  }

  .hero-copy h1 {
    font-size: 53px
  }

  .hero-showcase {
    height: 530px
  }

  .showcase-laptop {
    height: 430px
  }

  .showcase-phone {
    height: 335px;
    top: 145px
  }

  .template-card__preview {
    height: 250px
  }
}

@media(max-width:1200px) {
  .landing-hero {
    padding-top: 78px
  }

  .landing-header {
    height: 78px
  }

  .hero-body {
    min-height: calc(41.5vw - 78px)
  }

  .hero-copy {
    padding-top: 12px;
    padding-bottom: 40px
  }

  .hero-copy h1 {
    font-size: 36px;
    margin: 10px 0 18px
  }

  .hero-actions {
    margin-top: 22px
  }

  .hero-benefits {
    margin-top: 28px
  }

  .hero-showcase {
    height: calc(41.5vw - 78px)
  }

  .showcase-laptop {
    height: calc(34vw - 45px);
    top: 5px
  }

  .showcase-phone {
    height: calc(26vw - 20px);
    top: 90px
  }

  .landing-container {
    width: calc(100% - 96px)
  }

  .landing-header {
    gap: 36px;
    height: 88px
  }

  .landing-navigation {
    gap: 22px
  }

  .landing-brand {
    font-size: 34px
  }

  .landing-brand svg {
    width: 34px
  }

  .header-actions {
    gap: 10px
  }

  .landing-button {
    padding: 12px 18px;
    font-size: 13px;
    gap: 12px
  }

  .landing-button--small {
    font-size: 12px;
    padding: 9px 14px
  }

  .hero-copy h1 {
    font-size: 40px
  }

  .hero-description {
    font-size: 14px
  }

  .hero-body {
    min-height: 460px
  }

  .hero-copy {
    padding-top: 25px;
    padding-bottom: 55px
  }

  .hero-showcase {
    height: 440px;
    margin-left: 10px
  }

  .showcase-laptop {
    height: 355px;
    top: 16px
  }

  .showcase-phone {
    height: 275px;
    top: 123px;
    width: 26%
  }

  .hero-benefits {
    gap: 23px;
    font-size: 10px;
    margin-top: 35px
  }

  .hero-benefits b {
    font-size: 30px
  }

  .hero-benefits svg {
    width: 24px;
    height: 24px
  }

  .mock-workspace {
    gap: 12px;
    padding-right: 10px
  }

  .mock-sidebar {
    gap: 15px;
    font-size: 8px
  }

  .mock-sidebar strong {
    font-size: 8px
  }

  .mock-toolbar {
    font-size: 8px
  }

  .landing-section-heading h2 {
    font-size: 34px
  }

  .template-card__preview {
    height: 215px
  }

  .template-grid {
    gap: 16px
  }

  .template-card__caption {
    padding: 13px 14px
  }

  .template-card h3 {
    font-size: 12px
  }

  .template-card p {
    font-size: 11px
  }

  .template-all {
    font-size: 13px
  }

  .feature-grid article {
    padding: 0 16px
  }

  .feature-grid h3 {
    font-size: 12px
  }

  .feature-grid p {
    font-size: 12px
  }

  .pricing-faq-grid {
    gap: 26px;
    grid-template-columns: minmax(0, 2.5fr) minmax(0, 1fr)
  }

  .pricing-column .landing-section-heading h2 {
    font-size: 26px
  }

  .price-card {
    padding: 18px 16px 15px
  }

  .pricing-cards {
    gap: 14px
  }

  .price-card h3 {
    font-size: 14px
  }

  .plan-price {
    font-size: 29px
  }

  .price-card ul {
    font-size: 11px
  }

  .plan-badge {
    font-size: 7px;
    padding: 3px 5px
  }

  .landing-faq {
    padding-left: 26px
  }

  .landing-faq h2 {
    font-size: 25px
  }

  .landing-faq summary {
    font-size: 11px
  }

  .price-card .landing-button {
    font-size: 10px
  }

  .landing-closing h2 {
    font-size: 28px
  }
}

@media(max-width:1000px) {
  .landing-container {
    width: calc(100% - 64px)
  }

  .landing-header {
    gap: 25px
  }

  .landing-navigation {
    gap: 18px
  }

  .landing-navigation a {
    font-size: 12px
  }

  .hero-copy h1 {
    font-size: 35px
  }

  .hero-actions {
    gap: 12px
  }

  .hero-actions .landing-button {
    font-size: 11px;
    padding: 12px 16px
  }

  .hero-description {
    font-size: 13px
  }

  .hero-benefits {
    gap: 14px;
    font-size: 9px
  }

  .hero-benefits>span {
    gap: 7px
  }

  .hero-showcase {
    height: 400px
  }

  .hero-body {
    min-height: 420px
  }

  .showcase-laptop {
    height: 325px
  }

  .showcase-phone {
    height: 248px;
    top: 113px;
    border-width: 5px;
    border-radius: 21px
  }

  .laptop-screen {
    border-width: 8px;
    border-radius: 19px 19px 4px 4px
  }

  .mock-sidebar {
    gap: 12px;
    font-size: 7px
  }

  .mock-sidebar small {
    font-size: 7px
  }

  .showcase-pedestal {
    height: 140px
  }

  .template-card__preview {
    height: 190px
  }

  .template-card__caption {
    padding: 11px 10px;
    gap: 4px
  }

  .circle-arrow {
    width: 25px;
    height: 25px;
    font-size: 16px
  }

  .template-card h3 {
    font-size: 11px
  }

  .template-card p {
    font-size: 10px
  }

  .template-grid {
    gap: 13px
  }

  .feature-grid article {
    padding: 0 10px
  }

  .feature-grid p {
    font-size: 11px
  }

  .pricing-faq-grid {
    gap: 24px;
    grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr)
  }

  .pricing-column .landing-section-heading h2 {
    font-size: 22px
  }

  .pricing-column .landing-section-heading>p:last-child {
    font-size: 11px
  }

  .price-card {
    padding: 16px 12px 13px
  }

  .price-card__top {
    align-items: start;
    flex-wrap: wrap;
    min-height: 35px
  }

  .pricing-cards {
    gap: 10px
  }

  .plan-price {
    font-size: 26px
  }

  .plan-price>span {
    font-size: 17px
  }

  .price-card ul {
    font-size: 10px
  }

  .landing-faq {
    padding-left: 24px
  }

  .landing-faq h2 {
    font-size: 22px
  }

  .landing-faq summary {
    font-size: 10px
  }

  .landing-faq details p {
    font-size: 11px
  }

  .landing-footer {
    gap: 16px
  }

  .landing-footer nav {
    gap: 16px
  }
}

@media(min-width:1001px) and (max-width:1200px) {
  .landing-header {
    height: 78px
  }

  .hero-body {
    min-height: calc(41.5vw - 78px)
  }

  .hero-copy {
    padding-top: 12px;
    padding-bottom: 40px
  }

  .hero-copy h1 {
    font-size: 36px;
    margin: 10px 0 18px
  }

  .hero-actions {
    margin-top: 22px
  }

  .hero-benefits {
    margin-top: 28px
  }

  .hero-showcase {
    height: calc(41.5vw - 78px)
  }

  .showcase-laptop {
    height: calc(34vw - 45px);
    top: 5px
  }

  .showcase-phone {
    height: calc(26vw - 20px);
    top: 90px
  }
}

@media(max-width:760px) {
  .landing-hero {
    padding-top: 80px
  }

  .landing-container {
    width: calc(100% - 40px)
  }

  .landing-header {
    height: 80px;
    gap: 16px;
    flex-wrap: wrap
  }

  .landing-brand {
    font-size: 30px;
    gap: 8px;
    margin-right: auto
  }

  .landing-brand svg {
    width: 30px;
    height: 35px
  }

  .landing-menu-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 9px 10px;
    border: 1px solid #c4a6c4;
    border-radius: 8px;
    color: #fff;
    background: transparent;
    cursor: pointer;
    order: 3
  }

  .header-actions .landing-button--gold {
    display: none
  }

  .header-actions .landing-button {
    font-size: 12px;
    min-height: 36px;
    padding: 8px 14px
  }

  .landing-navigation {
    display: none;
    position: absolute;
    top: 70px;
    left: 0;
    right: 0;
    padding: 16px;
    border: 1px solid #b28db4;
    background: #3a203d;
    border-radius: 12px;
    box-shadow: 0 8px 24px #210e3240
  }

  .landing-navigation.is-open {
    display: flex;
    flex-wrap: wrap;
    gap: 20px
  }

  .landing-navigation a {
    font-size: 14px;
    min-height: 30px;
    display: flex;
    align-items: center
  }

  .hero-body {
    display: flex;
    flex-direction: column;
    min-height: 0
  }

  .hero-copy {
    align-self: stretch;
    padding-top: 25px;
    padding-bottom: 20px;
    text-align: center
  }

  .landing-eyebrow {
    font-size: 10px;
    letter-spacing: .16em
  }

  .hero-copy h1 {
    font-size: clamp(33px, 7vw, 47px);
    line-height: 1.13;
    max-width: 620px;
    margin: 14px auto 18px
  }

  .hero-description {
    font-size: 14px;
    max-width: 500px;
    margin: auto
  }

  .desktop-break {
    display: none
  }

  .hero-actions {
    justify-content: center;
    gap: 12px;
    margin-top: 23px;
    flex-wrap: wrap
  }

  .hero-actions .landing-button {
    font-size: 12px;
    padding: 13px 17px;
    min-height: 46px
  }

  .hero-benefits {
    justify-content: center;
    font-size: 10px;
    gap: 24px;
    margin-top: 26px
  }

  .hero-benefits b {
    font-size: 31px
  }

  .hero-benefits svg {
    width: 23px;
    height: 26px
  }

  .hero-showcase {
    width: min(100%, 550px);
    height: 365px;
    margin: 10px 0 0;
    align-self: center
  }

  .showcase-laptop {
    width: 88%;
    height: 305px;
    right: 8%;
    top: 8px
  }

  .laptop-screen {
    border-width: 8px;
    border-radius: 19px 19px 4px 4px
  }

  .showcase-phone {
    width: 23%;
    height: 235px;
    top: 100px;
    right: 2%
  }

  .mock-toolbar {
    height: 26px;
    font-size: 8px
  }

  .mock-workspace {
    height: calc(100% - 26px);
    gap: 14px
  }

  .mock-sidebar {
    gap: 13px;
    font-size: 7px
  }

  .mock-sidebar strong {
    font-size: 8px
  }

  .mock-sidebar small {
    font-size: 7px
  }

  .showcase-pedestal {
    height: 140px;
    left: -10%;
    right: -10%
  }

  .landing-gallery {
    padding: 32px 0
  }

  .landing-section-heading h2 {
    font-size: 29px;
    line-height: 1.15;
    max-width: 500px;
    margin: 10px auto 0
  }

  .landing-section-heading>p:last-child:not(.landing-kicker) {
    font-size: 13px
  }

  .landing-kicker {
    font-size: 10px;
    gap: 12px
  }

  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 24px
  }

  .template-card__preview {
    height: 240px
  }

  .template-card h3 {
    font-size: 13px
  }

  .template-card p {
    font-size: 11px
  }

  .template-card__caption {
    padding: 13px 12px
  }

  .template-all {
    grid-column: 1/-1;
    flex-direction: row;
    gap: 18px;
    min-height: 75px;
    font-size: 14px;
    border-radius: 12px
  }

  .template-all br {
    display: none
  }

  .template-all svg {
    width: 24px;
    height: 26px
  }

  .landing-features {
    padding: 29px 0 32px
  }

  .landing-features .landing-section-heading h2 {
    font-size: 29px
  }

  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 28px;
    margin-top: 28px
  }

  .feature-grid article {
    padding: 0 20px
  }

  .feature-grid article:nth-child(even) {
    border-right: 0
  }

  .feature-grid h3 {
    font-size: 13px
  }

  .feature-grid p {
    font-size: 12px;
    max-width: 220px;
    margin: 8px auto 0
  }

  .feature-grid svg {
    width: 29px;
    height: 29px;
    margin-bottom: 11px
  }

  .landing-pricing {
    padding: 30px 0
  }

  .pricing-faq-grid {
    grid-template-columns: 1fr;
    gap: 34px
  }

  .pricing-column .landing-section-heading h2 {
    font-size: 28px;
    max-width: 450px
  }

  .pricing-column .landing-section-heading>p:last-child {
    font-size: 13px
  }

  .pricing-notice {
    font-size: 11px;
    max-width: 350px;
    margin: 10px auto 0 !important
  }

  .pricing-cards {
    grid-template-columns: 1fr;
    gap: 17px;
    margin-top: 24px
  }

  .price-card {
    padding: 22px;
    max-width: 440px;
    width: 100%;
    margin: auto
  }

  .price-card--premium {
    transform: none
  }

  .price-card__top {
    min-height: 0;
    align-items: center;
    flex-wrap: nowrap
  }

  .price-card h3 {
    font-size: 18px
  }

  .plan-badge {
    font-size: 10px;
    padding: 5px 8px
  }

  .plan-price {
    font-size: 36px
  }

  .plan-price>span {
    font-size: 23px
  }

  .plan-note {
    font-size: 12px
  }

  .price-card ul {
    font-size: 13px;
    margin: 14px 0 22px
  }

  .price-card li {
    margin-top: 9px
  }

  .price-card .landing-button {
    font-size: 12px;
    min-height: 43px
  }

  .landing-faq {
    border-left: 0;
    border-top: 1px solid #d5c2dc;
    padding: 28px 0 0;
    margin-top: 0
  }

  .landing-faq h2 {
    font-size: 29px;
    margin-bottom: 20px
  }

  .landing-faq h2 br {
    display: none
  }

  .landing-faq summary {
    font-size: 13px;
    padding: 17px 0
  }

  .landing-faq details p {
    font-size: 13px
  }

  .landing-closing {
    padding: 28px 0
  }

  .landing-closing h2 {
    font-size: 27px;
    position: relative;
    z-index: 1
  }

  .closing-ornament {
    width: 220px;
    opacity: .23;
    bottom: -50px
  }

  .closing-ornament--left {
    left: -90px
  }

  .closing-ornament--right {
    right: -90px
  }

  .landing-closing .landing-button {
    position: relative;
    z-index: 1
  }

  .landing-footer {
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
    gap: 10px 18px;
    padding-top: 22px;
    padding-bottom: 22px
  }

  .landing-footer nav {
    order: 3;
    width: 100%;
    margin: 4px 0;
    justify-content: center;
    gap: 26px
  }

  .landing-footer small {
    order: 4;
    width: 100%
  }
}

@media(max-width:400px) {
  .landing-container {
    width: calc(100% - 32px)
  }

  .hero-copy h1 {
    font-size: 32px
  }

  .hero-description {
    font-size: 13px
  }

  .hero-actions {
    gap: 10px
  }

  .hero-actions .landing-button {
    font-size: 11px;
    padding: 12px 13px
  }

  .hero-benefits {
    gap: 12px;
    font-size: 9px
  }

  .hero-benefits>span {
    gap: 6px
  }

  .hero-showcase {
    height: 315px
  }

  .showcase-laptop {
    height: 265px
  }

  .showcase-phone {
    height: 205px;
    top: 85px
  }

  .mock-sidebar {
    gap: 10px;
    font-size: 6px
  }

  .mock-sidebar strong {
    font-size: 7px
  }

  .mock-toolbar {
    font-size: 7px;
    height: 24px
  }

  .template-card__preview {
    height: 205px
  }

  .template-card h3 {
    font-size: 12px
  }

  .template-card p {
    font-size: 10px
  }

  .template-grid {
    gap: 12px
  }

  .template-card__caption {
    padding: 11px 10px
  }

  .circle-arrow {
    width: 23px;
    height: 23px
  }

  .landing-section-heading h2 {
    font-size: 27px
  }

  .feature-grid article {
    padding: 0 12px
  }
}

@media(min-width:761px) and (max-width:1200px) {
  .landing-gallery {
    padding: 24px 0 28px
  }

  .landing-section-heading h2 {
    font-size: 30px;
    margin-top: 8px
  }

  .landing-section-heading>p:last-child:not(.landing-kicker) {
    font-size: 13px;
    margin-top: 8px;
    line-height: 1.4
  }

  .landing-kicker {
    font-size: 10px;
    line-height: 1.5
  }

  .template-grid {
    margin-top: 20px
  }

  .template-card__preview {
    height: 164px
  }

  .template-card__caption {
    padding: 10px 12px;
    min-height: 52px
  }

  .template-card h3 {
    font-size: 11px
  }

  .template-card p {
    font-size: 10px
  }

  .template-all {
    font-size: 12px;
    gap: 14px
  }

  .landing-features {
    padding: 20px 0 24px
  }

  .landing-features .landing-section-heading h2 {
    font-size: 27px;
    line-height: 1.1
  }

  .feature-grid {
    margin-top: 22px
  }

  .feature-grid article {
    padding: 0 13px
  }

  .feature-grid svg {
    width: 26px;
    height: 26px;
    margin-bottom: 10px
  }

  .feature-grid h3 {
    font-size: 11px;
    line-height: 1.3;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center
  }

  .feature-grid p {
    font-size: 11px;
    line-height: 1.4;
    margin-top: 6px
  }

  .landing-pricing {
    padding: 22px 0 24px
  }

  .pricing-column .landing-section-heading h2 {
    font-size: 23px;
    line-height: 1.15
  }

  .pricing-column .landing-section-heading>p:last-child {
    font-size: 11px;
    margin-top: 6px
  }

  .pricing-notice {
    font-size: 10px;
    line-height: 1.35;
    margin-top: 6px !important
  }

  .pricing-cards {
    margin-top: 18px;
    gap: 12px
  }

  .price-card {
    padding: 16px 14px 13px
  }

  .price-card h3 {
    font-size: 13px
  }

  .price-card__top {
    min-height: 20px
  }

  .plan-price {
    font-size: 28px;
    margin-top: 5px !important
  }

  .plan-price>span {
    font-size: 18px
  }

  .plan-note {
    font-size: 10px;
    margin-top: 3px !important
  }

  .price-card ul {
    font-size: 10px;
    line-height: 1.4;
    margin: 12px 0 16px
  }

  .price-card li {
    margin-top: 7px;
    gap: 7px
  }

  .price-card .landing-button {
    min-height: 32px;
    padding: 8px 6px;
    font-size: 10px;
    border-radius: 8px
  }

  .landing-faq {
    margin-top: 25px
  }

  .landing-faq h2 {
    font-size: 23px;
    line-height: 1.1;
    margin-bottom: 18px
  }

  .landing-faq summary {
    font-size: 10px;
    padding: 12px 0;
    min-height: 42px
  }

  .landing-faq details p {
    font-size: 11px;
    line-height: 1.5;
    padding-bottom: 12px
  }

  .landing-closing {
    padding: 14px 0 16px
  }

  .landing-closing h2 {
    font-size: 26px;
    line-height: 1.05
  }

  .landing-closing .landing-button {
    margin-top: 10px;
    min-height: 34px;
    padding: 8px 22px;
    font-size: 11px
  }

  .landing-footer {
    padding-top: 17px;
    padding-bottom: 17px
  }
}

@media(prefers-reduced-motion:reduce) {
  .kuren-landing * {
    transition: none !important;
    scroll-behavior: auto !important
  }
}
</style>
