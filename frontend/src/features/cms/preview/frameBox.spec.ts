import { describe, expect, it } from 'vitest'

import { computeFrameBox, FRAME_WIDTH, MIN_FRAME_HEIGHT, STAGE_GUTTER } from './frameBox'

describe('computeFrameBox (Fit / 100%)', () => {
  it('never scales a phone frame up when the stage is wide enough', () => {
    const box = computeFrameBox({ stageWidth: 760, stageHeight: 900, frameWidth: FRAME_WIDTH.phone, gutter: 48, zoom: 'fit' })
    expect(box).toEqual({ scale: 1, outerWidth: 390, outerHeight: 852, innerWidth: 390, innerHeight: 852 })
  })

  it('scales a desktop frame down to fit and compensates the inner height', () => {
    const box = computeFrameBox({ stageWidth: 800, stageHeight: 900, frameWidth: FRAME_WIDTH.desktop, gutter: STAGE_GUTTER.desktop, zoom: 'fit' })
    expect(box.scale).toBeCloseTo(752 / 1280, 4)
    expect(box.outerWidth).toBeCloseTo(752, 1)
    expect(box.outerHeight).toBe(852)
    expect(box.innerWidth).toBe(1280)
    // Once scaled, the inner box fills exactly the available height.
    expect(box.innerHeight * box.scale).toBeCloseTo(852, 0)
  })

  it('gives s ≈ 0.74 for a phone frame on a 320px screen', () => {
    const box = computeFrameBox({ stageWidth: 320, stageHeight: 600, frameWidth: FRAME_WIDTH.phone, gutter: STAGE_GUTTER.compact, zoom: 'fit' })
    expect(box.scale).toBeCloseTo(0.7385, 3)
  })

  it('100% keeps the true size (the stage scrolls instead)', () => {
    const box = computeFrameBox({ stageWidth: 800, stageHeight: 900, frameWidth: FRAME_WIDTH.desktop, gutter: 48, zoom: 'actual' })
    expect(box).toMatchObject({ scale: 1, outerWidth: 1280, innerWidth: 1280, innerHeight: 852 })
  })

  it('falls back to 100% and a minimum height before the stage is measured', () => {
    const box = computeFrameBox({ stageWidth: 0, stageHeight: 0, frameWidth: FRAME_WIDTH.phone, gutter: 48, zoom: 'fit' })
    expect(box).toMatchObject({ scale: 1, outerHeight: MIN_FRAME_HEIGHT, innerHeight: MIN_FRAME_HEIGHT })
  })
})
