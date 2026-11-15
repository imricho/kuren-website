/**
 * Route-change accessibility for a single-page app:
 *  - a localized document title per route ("<Page> · Kuren"), updated when the
 *    UI language changes;
 *  - after an in-app navigation (never on first load) focus moves to the new
 *    page's main heading, so keyboard and screen-reader users start at the top
 *    of the new content instead of on a link that may no longer exist.
 *
 * Navigations that keep the same page component (e.g. theme studio levels,
 * /welcome?step=2) are left alone: those pages manage focus themselves.
 */
import { onBeforeUnmount, watch } from 'vue'
import { START_LOCATION, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

import { useAppLocale, type AppMessageKey } from '@/composables/useAppLocale'
import { BRAND_NAME } from '@/features/shell/brand'
import { isSameView } from '@/router/views'

type Translate = (key: AppMessageKey) => string

export function pageTitle(route: Pick<RouteLocationNormalizedLoaded, 'meta'>, t: Translate): string {
  const key = route.meta.titleKey
  return key ? `${t(key)} · ${BRAND_NAME}` : t('appTitleDefault')
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Focus the page's main heading (the first h1 inside <main>, else any h1, else
 * <main> itself). Pages are lazy-loaded, so retry briefly until the heading
 * exists; give up if the user has moved focus meanwhile.
 */
export async function focusMainHeading(attempts = 10, interval = 50): Promise<HTMLElement | null> {
  if (typeof document === 'undefined') return null
  const initial = document.activeElement
  for (let i = 0; i < attempts; i++) {
    await wait(i === 0 ? 0 : interval)
    const active = document.activeElement
    if (active && active !== initial && active !== document.body) return null // the user moved on
    const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')
    if (heading) return focusElement(heading)
  }
  const main = document.querySelector<HTMLElement>('main')
  return main ? focusElement(main) : null
}

function focusElement(el: HTMLElement): HTMLElement {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  // The router already resets scroll (instantly, so reduced-motion users get no animation).
  el.focus({ preventScroll: true })
  return el
}

export function useRouteA11y() {
  const router = useRouter()
  const route = useRoute()
  const { t, locale } = useAppLocale()

  watch(
    [() => route.meta.titleKey, locale],
    () => {
      document.title = pageTitle(route, t)
    },
    { immediate: true },
  )

  const stop = router.afterEach((to, from, failure) => {
    if (failure || from === START_LOCATION || from.matched.length === 0) return
    if (to.hash || isSameView(to, from)) return
    void focusMainHeading()
  })
  onBeforeUnmount(stop)
}
