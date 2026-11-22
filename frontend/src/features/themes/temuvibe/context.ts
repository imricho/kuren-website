/** Shared state of one Temuvibe render (wording, variant, preset), provided by the root. */
import { inject, provide, type ComputedRef, type InjectionKey } from 'vue'

import type { VariantId } from '@/features/invitation/registry'
import type { WeddingLocale } from '@/features/wedding/types'

import type { TemuvibePreset } from './presets'
import type { Translate } from './wording'

export interface TvContext {
  t: ComputedRef<Translate>
  locale: ComputedRef<WeddingLocale>
  variant: ComputedRef<VariantId>
  preset: ComputedRef<TemuvibePreset>
  isDraft: ComputedRef<boolean>
}

const KEY: InjectionKey<TvContext> = Symbol('temuvibe')

export function provideTv(ctx: TvContext) {
  provide(KEY, ctx)
}

export function useTv(): TvContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('[temuvibe] section rendered outside TemuvibeTheme')
  return ctx
}
