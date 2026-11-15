import type { RouteLocationRaw } from 'vue-router'

export interface MenuNavItem {
  key: string
  to: RouteLocationRaw
  label: string
  active: boolean
}
