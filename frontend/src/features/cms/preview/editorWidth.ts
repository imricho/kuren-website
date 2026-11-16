/**
 * Editor panel width for the split editor (docs/ux/live-editor.md §4), as a
 * percentage of the editor grid. Clamped to 30–55%, and further so the editor
 * keeps ≥360px and the preview ≥420px. Persisted per browser (best effort).
 */
import { ref, watch } from 'vue'

export const EDITOR_WIDTH = { default: 40, min: 30, max: 55, minEditorPx: 360, minPreviewPx: 420, dividerPx: 8 } as const
export const EDITOR_WIDTH_STORAGE_KEY = 'kuren.editor.width'

export interface WidthBounds {
  min: number
  max: number
}

/** Percentage bounds for a grid `containerPx` wide (unmeasured → the plain 30–55%). */
export function editorWidthBounds(containerPx: number): WidthBounds {
  if (!(containerPx > 0)) return { min: EDITOR_WIDTH.min, max: EDITOR_WIDTH.max }
  const min = Math.max(EDITOR_WIDTH.min, (EDITOR_WIDTH.minEditorPx / containerPx) * 100)
  const max = Math.min(EDITOR_WIDTH.max, ((containerPx - EDITOR_WIDTH.minPreviewPx - EDITOR_WIDTH.dividerPx) / containerPx) * 100)
  // Too narrow to honour both minimums: favour the editor.
  return max < min ? { min, max: min } : { min, max }
}

export function clampWidth(value: number, bounds: WidthBounds): number {
  const v = Number.isFinite(value) ? value : EDITOR_WIDTH.default
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, v)) * 10) / 10
}

function readStored(): number {
  try {
    const raw = localStorage.getItem(EDITOR_WIDTH_STORAGE_KEY)
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? clampWidth(n, { min: EDITOR_WIDTH.min, max: EDITOR_WIDTH.max }) : EDITOR_WIDTH.default
  } catch {
    return EDITOR_WIDTH.default
  }
}

/** The user's preferred width (persisted). Effective width = clampWidth(width, bounds of the current grid). */
export function useEditorWidth() {
  const width = ref(readStored())
  watch(width, (w) => {
    try {
      localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, String(w))
    } catch {
      /* storage unavailable (private mode, quota) — keep the in-memory value */
    }
  })
  return width
}
