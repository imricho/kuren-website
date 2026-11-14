<script setup lang="ts">
/** Themes / Family / Collection / Template — the last item is the current page. */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { ThemeCollection, ThemeFamily, ThemeTemplate } from '../core/types'
import { collectionRoute, familyRoute } from './routes'
import { localizedCatalogText, useAppLocale } from '@/composables/useAppLocale'

const props = defineProps<{ family?: ThemeFamily; collection?: ThemeCollection; template?: ThemeTemplate }>()
const { t } = useAppLocale()

const items = computed(() => {
  const list: { label: string; to: RouteLocationRaw }[] = [{ label: t('themes'), to: { name: 'themes' } }]
  if (props.family) list.push({ label: localizedCatalogText(props.family.id, 'name', props.family.name), to: familyRoute(props.family.id) })
  if (props.family && props.collection)
    list.push({ label: localizedCatalogText(props.collection.id, 'name', props.collection.name), to: collectionRoute(props.family.id, props.collection.id) })
  if (props.template) list.push({ label: props.template.name, to: {} })
  return list
})
</script>

<template>
  <nav :aria-label="t('previewLocation')" class="text-sm">
    <ol class="flex flex-wrap items-center gap-1.5 text-ink-500">
      <li v-for="(item, i) in items" :key="i" class="flex items-center gap-1.5">
        <span v-if="i > 0" aria-hidden="true">/</span>
        <span v-if="i === items.length - 1" aria-current="page" class="font-medium text-ink-900">{{ item.label }}</span>
        <RouterLink v-else :to="item.to" class="rounded hover:text-ink-900">{{ item.label }}</RouterLink>
      </li>
    </ol>
  </nav>
</template>
