/**
 * A regional motif set for the Ethnic theme. Each set provides its patterns
 * and palette; the theme layout stays the same. Future regional sets (sourced
 * and reviewed with care for their cultural meaning) add a new folder here.
 */
export interface MotifSet {
  id: string
  name: string
  /** Short note on the inspiration, for documentation and review. */
  origin: string
  /** CSS custom properties applied to the theme root (patterns + palette). */
  cssVars: Record<`--${string}`, string>
}

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
