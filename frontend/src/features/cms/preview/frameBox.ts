/**
 * Preview frame geometry (docs/ux/live-editor.md §3).
 *
 * The frame is laid out at the device's true width W. "Fit" scales it down so
 * it fits the stage: s = min(1, (stageW − gutter) / W). The outer box takes the
 * scaled size; the inner (scaled) box is W wide and tall enough that, once
 * scaled, it fills the available height: (stageH − gutter) / s.
 */
export const FRAME_WIDTH = { phone: 390, desktop: 1280 } as const
export type PreviewDevice = keyof typeof FRAME_WIDTH
export type PreviewZoom = 'fit' | 'actual'

/** Total horizontal (and vertical) padding around the frame: 2 × 24px desktop, 2 × 16px phones. */
export const STAGE_GUTTER = { desktop: 48, compact: 32 } as const
/** Never collapse the frame below this height, even before the stage is measured. */
export const MIN_FRAME_HEIGHT = 240

export interface FrameBox {
  scale: number
  outerWidth: number
  outerHeight: number
  innerWidth: number
  innerHeight: number
}

export function computeFrameBox(input: {
  stageWidth: number
  stageHeight: number
  frameWidth: number
  gutter: number
  zoom: PreviewZoom
}): FrameBox {
  const { stageWidth, stageHeight, frameWidth, gutter, zoom } = input
  const availWidth = stageWidth - gutter
  const availHeight = Math.max(MIN_FRAME_HEIGHT, stageHeight - gutter)
  // Unmeasured stage (0 width, e.g. hidden or not laid out yet): show at 100%.
  const raw = zoom === 'fit' && availWidth > 0 ? Math.min(1, availWidth / frameWidth) : 1
  const scale = Math.round(raw * 10000) / 10000
  return {
    scale,
    outerWidth: Math.round(frameWidth * scale * 100) / 100,
    outerHeight: availHeight,
    innerWidth: frameWidth,
    innerHeight: Math.round((availHeight / scale) * 100) / 100,
  }
}
