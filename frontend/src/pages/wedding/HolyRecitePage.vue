<script setup lang="ts">
/**
 * Holy Recite 1 / 2 (route meta.recite = 1 | 2). Both routes use this page, and
 * the router reuses the component between them, so the editor is keyed by the
 * section: switching 1 ↔ 2 builds a fresh, independent form.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import HolyReciteEditor from '@/features/cms/components/editors/HolyReciteEditor.vue'

const route = useRoute()
const section = computed(() => (route.meta.recite === 2 ? 'holyRecite2' : 'holyRecite1'))
</script>

<template>
  <HolyReciteEditor :key="section" :section="section" />
</template>
