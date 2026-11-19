<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getTheme } from '@/features/themes/core/registry'
import { isSelectable } from '@/features/themes/core/types'
import { useAuthStore } from '@/stores/auth'
import { useThemeSelectionStore } from '@/stores/themeSelection'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const selection = useThemeSelectionStore()
const ownerId = auth.user?.id
const template = computed(() => {
  const id = route.params.templateId
  const candidate = typeof id === 'string' ? getTheme(id) : undefined
  return candidate && isSelectable(candidate) ? candidate : undefined
})
const saving = ref(false)
const failed = ref(false)
const accountChanged = computed(() => !ownerId || auth.user?.id !== ownerId)
let attempt = 0

// Selection is saved pessimistically. The store skips an already saved template,
// so a reload or a return to this URL cannot cause a duplicate theme PATCH.
async function applyTemplate() {
  const chosen = template.value
  if (!chosen || saving.value || accountChanged.value) return
  const current = ++attempt
  saving.value = true
  failed.value = false
  try {
    const saved = await selection.select(chosen.id)
    if (current !== attempt || accountChanged.value || template.value?.id !== chosen.id) return
    if (saved) await router.replace({ name: 'wedding-opening' })
    else failed.value = true
  } catch {
    if (current === attempt) failed.value = true
  } finally {
    if (current === attempt) saving.value = false
  }
}

watch(() => route.params.templateId, () => {
  attempt++
  saving.value = false
  failed.value = false
  void applyTemplate()
}, { immediate: true })
watch(() => auth.user?.id, () => {
  // Never continue a choice made for a different account.
  attempt++
  saving.value = false
})
onBeforeUnmount(() => { attempt++ })
</script>

<template>
  <main class="template-handoff mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6 py-16" :aria-busy="saving">
    <template v-if="!template">
      <h1 class="font-display text-3xl text-ink-900">Template tidak tersedia</h1>
      <p>Template ini belum dapat digunakan. Silakan pilih desain lain dari koleksi Kuren.</p>
    </template>
    <template v-else-if="accountChanged">
      <h1 class="font-display text-3xl text-ink-900">Akun telah berubah</h1>
      <p role="alert">Pilihan template dihentikan. Kembali ke koleksi dan pilih kembali menggunakan akun Anda saat ini.</p>
    </template>
    <template v-else>
      <h1 class="font-display text-3xl text-ink-900">Menyiapkan {{ template.name }}</h1>
      <p v-if="!failed" role="status">Menyimpan pilihan template sebelum membuka editor undangan Anda…</p>
      <div v-else role="alert" class="space-y-4">
        <p>Pilihan template belum berhasil disimpan. Konten undangan Anda tetap tersimpan. Silakan coba lagi.</p>
        <button type="button" class="min-h-11 rounded-lg bg-rose-700 px-5 py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4" :disabled="saving" @click="applyTemplate">Coba lagi</button>
      </div>
    </template>
    <RouterLink :to="{ name: 'public-templates' }" class="inline-flex min-h-11 items-center font-medium text-rose-700 underline underline-offset-4">Kembali ke koleksi template</RouterLink>
  </main>
</template>

<style scoped>
.template-handoff {
  color: #39283f;
  background: radial-gradient(ellipse at 50% 25%, #f0e3f3, #fcf8fc 75%);
  box-shadow: 0 0 0 100vmax #fcf8fc;
  clip-path: inset(0 -100vmax);
}
.template-handoff h1 { color: #35183e; font-family: Georgia, 'Times New Roman', serif; }
.template-handoff a { color: #64336d; }
.template-handoff button { background: #593062; color: #fff8ed; }
.template-handoff a:focus-visible, .template-handoff button:focus-visible { outline: 3px solid #885795; outline-offset: 4px; }
</style>
