<script setup lang="ts">
/** Public sample preview: selection is deferred to the protected handoff route. */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { previewableTemplatesOf, templatePath } from '@/features/themes/core/registry'
import ThemeRenderer from '@/features/themes/core/ThemeRenderer.vue'
import { isSelectable, type RenderableTemplate } from '@/features/themes/core/types'
import { collectionRoute, previewRoute } from '@/features/themes/picker/routes'
import { universalDemo } from '@/features/wedding/universalDemo'
import { useAuthStore } from '@/stores/auth'
import { useAppLocale } from '@/composables/useAppLocale'

const props = defineProps<{ familyId?: string; collectionId?: string; templateSlug?: string }>()
const { t, locale } = useAppLocale()
const route = useRoute()
const router = useRouter()
// Read existing in-memory session state only; public browsing never probes the session.
const auth = useAuthStore()
const toolbar = ref<HTMLElement>()
const toolbarHeight = ref(96)
let observer: ResizeObserver | undefined

const path = computed(() => templatePath(props.templateSlug))
const template = computed(() => path.value?.template as RenderableTemplate | undefined)
const siblings = computed(() => path.value ? previewableTemplatesOf(path.value.collection.id).filter(item => item.status === 'available') : [])
const backTarget = computed(() => {
  if (route.query.from === 'landing') return '/#template'
  if (route.query.from === 'gallery') return { name: 'public-templates' }
  if (auth.isAuthenticated && path.value) return collectionRoute(path.value.family.id, path.value.collection.id)
  return { name: 'public-templates' }
})
const selectable = computed(() => isSelectable(template.value))
const notFound = computed(() => typeof route.query.notFound === 'string' ? route.query.notFound : null)

function switchTo(id: string) {
  const next = siblings.value.find(item => item.id === id)
  if (next) void router.replace({ ...previewRoute(next) as object, query: route.query })
}

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) toolbarHeight.value = entry.target.getBoundingClientRect().height
  })
  if (toolbar.value) observer.observe(toolbar.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
<div
  v-if="path && template"
  class="template-preview-page"
  :style="{ '--toolbar-h': `${toolbarHeight}px` }"
>
  <a
    class="preview-skip"
    href="#template-invitation"
  >Lewati ke contoh undangan</a>
  <header
    ref="toolbar"
    class="preview-toolbar"
    data-testid="public-preview-toolbar"
    aria-label="Kontrol pratinjau"
    lang="id"
  >
    <div class="preview-toolbar__panel">
      <RouterLink
        class="preview-back"
        :to="backTarget"
      >
        <span aria-hidden="true">←</span> Kembali
      </RouterLink>

      <div class="preview-title">
        <template v-if="siblings.length > 1">
          <label
            class="sr-only"
            for="fs-template"
          >Pilih template untuk dilihat</label>
          <select
            id="fs-template"
            :value="template.id"
            @change="switchTo(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="item in siblings"
              :key="item.id"
              :value="item.id"
            >{{ item.name }}</option>
          </select>
        </template>
        <strong v-else>{{ template.name }}</strong>
      </div>

      <RouterLink
        v-if="selectable"
        class="preview-use"
        :to="{ name: 'use-template', params: { templateId: template.id } }"
        :aria-label="`Gunakan Template: ${template.name}`"
        data-action="select"
      >Gunakan Template</RouterLink>
      <span
        v-else
        class="preview-draft"
        role="note"
        data-action="draft-not-selectable"
      >Masih dalam peninjauan</span>
    </div>
    <p
      v-if="notFound"
      class="preview-notice"
      :lang="locale"
      role="status"
      data-testid="preview-not-found"
    >
      {{ t('templateMissing', { name: notFound, fallback: template.name }) }}
    </p>
  </header>

  <main
    id="template-invitation"
    tabindex="-1"
    :aria-label="`${template.name} — contoh undangan`"
    :lang="universalDemo.locale"
  >
    <ThemeRenderer
      :content="universalDemo"
      :theme-id="template.id"
      viewport-height="calc(100svh - var(--toolbar-h))"
    />
  </main>
</div>
</template>

<style scoped>
.template-preview-page {
  min-height: 100dvh;
  background: #171316;
}

.preview-skip {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 70;
  padding: 12px 16px;
  color: #201823;
  background: #fff;
  border-radius: 8px;
  transform: translateY(-180%);
}

.preview-skip:focus {
  transform: none;
}

.preview-toolbar {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 16px 24px;
  background: #171316;
  font-family: Arial, Helvetica, sans-serif;
}

.preview-toolbar__panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 1040px;
  min-height: 64px;
  margin: auto;
  padding: 10px 12px 10px 22px;
  border: 1px solid #726b71;
  border-radius: 20px;
  color: #fff;
  background: #211c20ed;
  box-shadow: 0 4px 24px #0003;
}

.preview-back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.preview-title {
  min-width: 0;
  text-align: center;
}

.preview-title strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.preview-title select {
  display: block;
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  padding: 6px 24px 6px 8px;
  color: #fff;
  background: #211c20;
  text-align: center;
  font: 600 14px Arial, Helvetica, sans-serif;
  text-overflow: ellipsis;
  cursor: pointer;
}

.preview-title option {
  color: #fff;
  background: #211c20;
}

.preview-use {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 11px 18px;
  border: 1px solid #eee6ed;
  border-radius: 12px;
  color: #241f23;
  background: #fff;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.preview-use:hover {
  background: #f4eaf4;
}

.preview-draft {
  justify-self: end;
  max-width: 190px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f4dfb3;
  color: #3c2d18;
  font-size: 12px;
  text-align: center;
}

.preview-notice {
  max-width: 1040px;
  margin: 10px auto 0;
  color: #fff1d3;
  font-size: 13px;
  line-height: 1.5;
}

.preview-toolbar a:focus-visible,
.preview-title select:focus-visible {
  outline: 3px solid #eed0a5;
  outline-offset: 4px;
}

@media (max-width: 640px) {
  .preview-toolbar {
    padding: 10px 12px;
  }

  .preview-toolbar__panel {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
    gap: 6px 12px;
    min-height: 100px;
    border-radius: 16px;
    padding: 8px 12px;
  }

  .preview-back {
    font-size: 13px;
    min-height: 38px;
  }

  .preview-title select,
  .preview-title strong {
    font-size: 13px;
  }

  .preview-title select {
    min-height: 38px;
    padding-right: 18px;
    text-align: right;
  }

  .preview-use,
  .preview-draft {
    grid-column: 1 / -1;
    justify-self: stretch;
    min-height: 40px;
    padding: 8px 12px;
    font-size: 13px;
  }

  .preview-draft {
    max-width: none;
  }
}
</style>
