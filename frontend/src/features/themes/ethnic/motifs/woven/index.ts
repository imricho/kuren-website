import { svgUrl, type MotifSet } from '../types'

/**
 * "Woven geometric": original stepped-diamond and zigzag patterns evoking
 * hand-woven textiles in general. It intentionally does NOT reproduce any
 * specific regional motif (batik, ikat, songket, ulos…); those should be
 * added as separate, properly researched sets.
 */
const indigo = '#1f2a44'
const terracotta = '#c0643c'
const ochre = '#d9a441'
const cream = '#f3ead9'

const band = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24">
<path d="M0 4 L6 1 L12 4 L18 1 L24 4 L30 1 L36 4 L42 1 L48 4 M0 20 L6 23 L12 20 L18 23 L24 20 L30 23 L36 20 L42 23 L48 20" fill="none" stroke="${ochre}" stroke-width="1.4"/>
<path d="M24 6 L30 12 L24 18 L18 12Z" fill="${terracotta}"/><path d="M24 9 L27 12 L24 15 L21 12Z" fill="${cream}"/>
<path d="M0 12 L4 8 L8 12 L4 16Z M40 12 L44 8 L48 12 L44 16Z" fill="${ochre}"/></svg>`

const lattice = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
<path d="M0 22 L22 0 L44 22 L22 44Z" fill="none" stroke="${cream}" stroke-opacity=".14" stroke-width="1"/>
<path d="M22 14 L30 22 L22 30 L14 22Z" fill="none" stroke="${ochre}" stroke-opacity=".22" stroke-width="1"/>
<circle cx="22" cy="22" r="1.6" fill="${ochre}" fill-opacity=".35"/></svg>`

const sawtooth = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12">
<path d="M0 12 L12 0 L24 12Z" fill="${color}"/></svg>`

export const wovenMotifs: MotifSet = {
  id: 'woven',
  name: 'Woven Geometric',
  origin: 'Original stepped diamonds and zigzags inspired by woven textiles in general (not region-specific).',
  cssVars: {
    '--eth-indigo': indigo,
    '--eth-indigo-soft': '#2f3d63',
    '--eth-terracotta': terracotta,
    '--eth-ochre': ochre,
    '--eth-cream': cream,
    '--eth-band': svgUrl(band),
    '--eth-lattice': svgUrl(lattice),
    '--eth-edge-indigo': svgUrl(sawtooth(indigo)),
    '--eth-edge-cream': svgUrl(sawtooth(cream)),
  },
}
