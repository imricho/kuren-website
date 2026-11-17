<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { getTheme } from '@/features/themes/core/registry'
import { sampleWedding } from '@/features/wedding/sampleWedding'
const props = defineProps<{ templateId: string }>()
const root = ref<HTMLElement>()
const scale = ref(0.5)
const theme = computed(() => getTheme(props.templateId)!)
const renderer = computed(() => defineAsyncComponent(theme.value.component))
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { if (entry) scale.value = entry.contentRect.width / 390 })
  if (root.value) observer.observe(root.value)
})
onUnmounted(() => observer?.disconnect())
</script>
<template>
  <div ref="root" class="landing-preview" aria-hidden="true" inert>
    <div class="landing-preview__canvas wedding-site" :style="{ transform: `scale(${scale})` }">
      <component :is="renderer" :content="sampleWedding" :config="theme.config" />
    </div>
  </div>
</template>
<style scoped>
.landing-preview { position: relative; overflow: hidden; width: 100%; height: 100%; background: #f5eee5; }
.landing-preview__canvas { width: 390px; transform-origin: top left; pointer-events: none; }
</style>
