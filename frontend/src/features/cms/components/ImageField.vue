<script setup lang="ts">
/**
 * Image by URL: address + live thumbnail (with a load-error state), required
 * alt text once an address is set, and an optional focal point.
 *
 * In development only, a picker offers the sample photos in /public/sample-wedding
 * (it fills in their real paths; nothing is uploaded or simulated).
 */
import { computed, nextTick, ref, useId, watch } from 'vue'

import { FOCUS_RING } from '@/components/ui/styles'
import TextField from '@/components/ui/TextField.vue'
import { useAppLocale } from '@/composables/useAppLocale'
import { isSafeImageSrc } from '@/features/wedding/format'

import type { ImageForm } from '../forms'
import { fieldId, isAcceptedImageSrc } from '../validation'

const props = withDefaults(
  defineProps<{
    label: string
    /** Field path of the image, e.g. "coverImage" → "coverImage.src" / "coverImage.alt". */
    path: string
    /** Override sub-field paths (gallery items keep src/alt at the top level). */
    srcPath?: string
    altPath?: string
    focalPath?: string
    idScope?: string
    errors?: Record<string, string>
    hint?: string
    /** Show the focal point controls. */
    focal?: boolean
    /** Dev-only sample-photo picker (ignored in production builds). */
    samples?: boolean
    /** The image address itself is required (gallery photos). */
    srcRequired?: boolean
  }>(),
  { errors: () => ({}), focal: true, samples: true, srcRequired: false, srcPath: undefined, altPath: undefined, focalPath: undefined, idScope: undefined, hint: undefined },
)

const model = defineModel<ImageForm>({ required: true })
const { t } = useAppLocale()
const uid = useId()

const srcKey = computed(() => props.srcPath ?? `${props.path}.src`)
const altKey = computed(() => props.altPath ?? `${props.path}.alt`)
const focalKey = computed(() => props.focalPath ?? `${props.path}.focalPoint`)

// Files that really exist in public/sample-wedding (development aid only; empty in production builds).
const SAMPLE_PHOTOS: readonly string[] = import.meta.env.DEV ? [
  'cover.svg',
  'groom.svg',
  'bride.svg',
  'story-1.svg',
  'story-2.svg',
  'story-3.svg',
  'gallery-1.svg',
  'gallery-2.svg',
  'gallery-3.svg',
  'gallery-4.svg',
  'gallery-5.svg',
  'gallery-6.svg',
  'closing.svg',
] : []
const showSamples = import.meta.env.DEV && props.samples

const src = computed({
  get: () => model.value.src,
  set: (value: string) => (model.value = { ...model.value, src: value }),
})
const alt = computed({
  get: () => model.value.alt,
  set: (value: string) => (model.value = { ...model.value, alt: value }),
})

const trimmed = computed(() => model.value.src.trim())
const srcInvalid = computed(() => trimmed.value !== '' && (!isSafeImageSrc(trimmed.value) || !isAcceptedImageSrc(trimmed.value)))
const srcError = computed(() => props.errors[srcKey.value] ?? (srcInvalid.value ? t('errInvalidImage') : undefined))
const altError = computed(() => props.errors[altKey.value])
const showThumb = computed(() => trimmed.value !== '' && !srcInvalid.value)

const loadError = ref(false)
watch(trimmed, () => (loadError.value = false))

function setFocal(axis: 'x' | 'y', raw: string) {
  const n = raw === '' ? NaN : Number(raw)
  const current = model.value.focalPoint ?? { x: 50, y: 50 }
  model.value = { ...model.value, focalPoint: { ...current, [axis]: Number.isFinite(n) ? Math.round(n) : 50 } }
}
function clearFocal() {
  model.value = { ...model.value, focalPoint: null }
}
function useSample(event: Event) {
  const file = (event.target as HTMLSelectElement).value
  if (file) model.value = { ...model.value, src: `/sample-wedding/${file}` }
  ;(event.target as HTMLSelectElement).value = ''
}
function removeImage() {
  model.value = { src: '', alt: '', focalPoint: null }
  // The remove button disappears; keep focus in the field.
  nextTick(() => document.getElementById(fieldId(srcKey.value, props.idScope))?.focus())
}

const focalOpen = ref(!!model.value.focalPoint)
const focalPanelId = `${uid}-focal`
// A focal-point error must be visible (and focusable) when the summary links to it.
watch(
  () => props.errors[focalKey.value],
  (error) => {
    if (error) focalOpen.value = true
  },
  { immediate: true },
)
</script>

<template>
  <fieldset class="min-w-0 space-y-3 rounded-lg border border-line p-4" data-testid="image-field">
    <legend class="px-1 text-sm font-medium text-ink-700">{{ label }}</legend>
    <p v-if="hint" class="text-xs text-ink-500">{{ hint }}</p>

    <div class="flex min-w-0 flex-col gap-4 sm:flex-row">
      <div
        class="flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-canvas ring-1 ring-line sm:w-40"
        data-testid="image-thumb"
      >
        <img
          v-if="showThumb && !loadError"
          :src="trimmed"
          :alt="model.alt || ''"
          class="size-full object-cover"
          :style="model.focalPoint ? { objectPosition: `${model.focalPoint.x}% ${model.focalPoint.y}%` } : undefined"
          @error="loadError = true"
          @load="loadError = false"
        />
        <p v-else-if="showThumb && loadError" class="px-3 text-center text-xs text-danger-600" role="status" data-testid="image-load-error">
          {{ t('imageLoadError') }}
        </p>
        <p v-else class="px-3 text-center text-xs text-ink-500">{{ t('noImage') }}</p>
      </div>

      <div class="min-w-0 flex-1 space-y-3">
        <TextField
          :id="fieldId(srcKey, idScope)"
          v-model="src"
          :label="t('imageAddress')"
          :required-marker="srcRequired ? t('requiredMarker') : undefined"
          :hint="t('imageAddressHint')"
          :error="srcError"
          inputmode="url"
          autocomplete="off"
        />
        <TextField
          v-if="trimmed !== ''"
          :id="fieldId(altKey, idScope)"
          v-model="alt"
          :label="t('altText')"
          :required-marker="t('requiredMarker')"
          :hint="t('altTextHint')"
          :error="altError"
          :maxlength="300"
        />

        <div v-if="showSamples || trimmed !== ''" class="flex flex-wrap items-center gap-2">
          <template v-if="showSamples">
            <label :for="`${uid}-sample`" class="sr-only">{{ t('useSamplePhoto') }}</label>
            <select
              :id="`${uid}-sample`"
              :class="['min-h-11 max-w-full rounded-md border border-ink-500/85 bg-surface px-2 text-sm text-ink-700 sm:min-h-9', FOCUS_RING]"
              data-testid="sample-photo"
              @change="useSample"
            >
              <option value="">{{ t('useSamplePhoto') }}</option>
              <option v-for="file in SAMPLE_PHOTOS" :key="file" :value="file">{{ file }}</option>
            </select>
          </template>
          <button
            v-if="trimmed !== ''"
            type="button"
            :class="['min-h-11 rounded-md px-3 text-sm font-medium text-danger-600 hover:bg-danger-50 sm:min-h-9', FOCUS_RING]"
            data-action="remove-image"
            @click="removeImage"
          >
            {{ t('removeImage') }}
          </button>
        </div>

        <div v-if="focal && trimmed !== ''" class="text-sm" data-testid="focal-disclosure">
          <button
            type="button"
            :class="[
              'inline-flex min-h-11 items-center gap-2 rounded-md py-2 pr-2 font-medium text-ink-700 hover:text-ink-900 sm:min-h-9',
              FOCUS_RING,
            ]"
            :aria-expanded="focalOpen"
            :aria-controls="focalPanelId"
            data-action="toggle-focal"
            @click="focalOpen = !focalOpen"
          >
            <svg
              class="size-4 transition-transform motion-reduce:transition-none"
              :class="focalOpen && 'rotate-90'"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ t('focalPoint') }}
          </button>
          <div v-show="focalOpen" :id="focalPanelId" class="mt-2 rounded-md bg-canvas p-3">
            <p class="mb-2 text-xs text-ink-500">{{ t('focalPointHint') }}</p>
            <div class="flex flex-wrap items-end gap-3" :id="fieldId(focalKey, idScope)" tabindex="-1">
              <label class="text-xs text-ink-700">
                {{ t('focalX') }}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  :class="['mt-1 block min-h-11 w-24 rounded-md border border-ink-500/85 bg-surface px-2 sm:min-h-9', FOCUS_RING]"
                  :value="model.focalPoint?.x ?? ''"
                  @input="setFocal('x', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <label class="text-xs text-ink-700">
                {{ t('focalY') }}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  :class="['mt-1 block min-h-11 w-24 rounded-md border border-ink-500/85 bg-surface px-2 sm:min-h-9', FOCUS_RING]"
                  :value="model.focalPoint?.y ?? ''"
                  @input="setFocal('y', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <button
                v-if="model.focalPoint"
                type="button"
                :class="['min-h-11 rounded-md px-2 text-xs text-ink-700 underline sm:min-h-9', FOCUS_RING]"
                @click="clearFocal"
              >
                {{ t('focalReset') }}
              </button>
            </div>
            <p v-if="errors[focalKey]" class="mt-1 text-xs text-danger-600">{{ errors[focalKey] }}</p>
          </div>
        </div>
      </div>
    </div>
  </fieldset>
</template>
