import type { RouteLocationNormalized } from 'vue-router'

/** Same page component on both routes (only params/query changed), e.g. theme studio levels. */
export function isSameView(to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
  const a = to.matched.at(-1)?.components?.default
  const b = from.matched.at(-1)?.components?.default
  return !!a && a === b
}
