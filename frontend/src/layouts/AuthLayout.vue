<script setup lang="ts">
import AppLanguageSwitch from '@/components/AppLanguageSwitch.vue'
import BrandMark from '@/components/BrandMark.vue'
import { useAppLocale } from '@/composables/useAppLocale'

const { t } = useAppLocale()
</script>

<template>
  <div class="kuren-auth">
    <header class="auth-language"><AppLanguageSwitch /></header>
    <aside class="auth-story">
      <RouterLink to="/" class="auth-brand" aria-label="Kuren"><BrandMark size="lg" /></RouterLink>
      <div class="auth-story-copy">
        <p class="auth-eyebrow">Kuren</p>
        <p class="auth-brand-title">{{ t('authBrandTitle') }}</p>
        <p class="auth-brand-body">{{ t('authBrandBody') }}</p>
      </div>
      <p class="auth-copyright">&copy; {{ new Date().getFullYear() }} Kuren</p>
    </aside>
    <main class="auth-main">
      <RouterLink to="/" class="auth-mobile-brand" aria-label="Kuren"><BrandMark size="lg" /></RouterLink>
      <div class="auth-form-card"><RouterView /></div>
    </main>
  </div>
</template>

<style scoped>
.kuren-auth {
  --color-canvas: #f3ecf7;
  --color-surface: #fcf9fe;
  --color-line: #e0d0e8;
  --color-ink-900: #2e1538;
  --color-ink-700: #574260;
  --color-ink-500: #776381;
  --color-rose-50: #eee2f3;
  --color-rose-100: #e2cde9;
  --color-rose-500: #a47db3;
  --color-rose-600: #72477f;
  --color-rose-700: #57315f;
  display: grid;
  min-height: 100dvh;
  background: #f3ecf7;
  color: #2e1538;
}
.auth-language { position: absolute; top: 24px; right: 28px; z-index: 10; }
.auth-story { display: none; }
.auth-main { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 88px 20px 40px; }
.auth-mobile-brand { margin-bottom: 32px; }
.auth-form-card { width: 100%; max-width: 460px; padding: 32px; border: 1px solid #e0d0e8; border-radius: 20px; background: #fcf9fe; box-shadow: 0 12px 44px #321a390a; }
.auth-form-card :deep(h1) { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; color: #321a39; }
.auth-form-card :deep(input) { border-color: #d6c0e0; background: #fff; color: #321a39; border-radius: 8px; }
.auth-form-card :deep(input[aria-invalid='true']) { border-color: var(--color-danger-600); }
.auth-form-card :deep(button[type='submit']) { min-height: 46px; background: #dbb991; color: #29162e; }
.auth-form-card :deep(button[type='submit']:hover) { background: #d0aa7e; }
.kuren-auth :deep(:focus-visible) { outline: 2px solid #91609e; outline-offset: 3px; }
@media (min-width: 1024px) {
  .kuren-auth { grid-template-columns: 1fr 1fr; }
  .auth-story { display: flex; flex-direction: column; justify-content: space-between; min-height: 100dvh; padding: 48px 56px; background: #321a39; color: #fff8fc; }
  .auth-brand { width: fit-content; border-radius: 6px; }
  .auth-story :deep(.text-ink-900) { color: #fff8fc; }
  .auth-story-copy { max-width: 440px; padding-block: 70px; }
  .auth-eyebrow { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #dbb991; margin-bottom: 22px; }
  .auth-brand-title { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(36px, 3.4vw, 54px); line-height: 1.15; }
  .auth-brand-body { max-width: 390px; margin-top: 24px; color: #e1d1e7; line-height: 1.8; }
  .auth-copyright { font-size: 12px; color: #c9b5d1; }
  .auth-main { padding: 96px 40px; }
  .auth-mobile-brand { display: none; }
}
@media (max-width: 400px) {
  .auth-main { padding-inline: 16px; }
  .auth-form-card { padding: 26px 20px; }
}
</style>
