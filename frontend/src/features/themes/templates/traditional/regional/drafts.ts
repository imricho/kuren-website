/**
 * The 12 regional Traditional DRAFT templates. Design status: draft (previewable).
 * Cultural status: review pending — none is culturally verified, approved or
 * production-ready, and none can be selected for a wedding yet.
 *
 * All 12 use one renderer (RegionalDraftTheme) with distinct configs. Visual cues
 * are limited to composition, generic material texture, typography and a
 * provisional palette; no cultural motifs, sacred symbols or named textile
 * patterns are used until reviewed. See catalog/regional-briefs.ts for references
 * used, items left out pending review, suggested reviewers and open questions.
 */
import type { RenderableTemplate } from '../../../core/types'
import type { RegionalDraftConfig } from './config'

const component = () => import('./RegionalDraftTheme.vue')
const gf = (...families: string[]) =>
  `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`

/** Small schematic thumbnail generated from the config (no cultural imagery). */
function thumbnail(c: RegionalDraftConfig, label: string): string {
  const p = c.palette
  const serif = 'Georgia, serif'
  const layouts: Record<RegionalDraftConfig['hero'], string> = {
    framed: `<rect x="14" y="14" width="292" height="172" fill="none" stroke="${p.accent}"/><rect x="20" y="20" width="280" height="160" fill="none" stroke="${p.accent}" stroke-width=".6"/><rect x="138" y="34" width="44" height="54" fill="${p.accentSoft}"/>`,
    split: `<rect width="150" height="200" fill="${p.accentSoft}"/><rect x="150" width="10" height="200" fill="${p.accent}" opacity=".6"/>`,
    bands: `<rect width="320" height="22" fill="${p.accent}" opacity=".55"/><rect y="178" width="320" height="22" fill="${p.accent}" opacity=".55"/><rect x="90" y="36" width="140" height="56" fill="${p.accentSoft}"/>`,
    arch: `<path d="M136 92 V58 a24 24 0 0 1 48 0 V92 Z" fill="${p.accentSoft}"/>`,
    'side-portrait': `<rect width="170" height="200" fill="${p.accentSoft}"/><rect x="130" y="96" width="170" height="80" fill="${p.surface}"/>`,
    type: `<rect x="226" y="24" width="72" height="72" fill="${p.accentSoft}"/>`,
  }
  const textX = c.hero === 'split' ? 240 : c.hero === 'side-portrait' ? 215 : c.hero === 'type' ? 24 : 160
  const anchor = c.hero === 'type' ? 'start' : 'middle'
  const textY = c.hero === 'side-portrait' ? 132 : c.hero === 'type' ? 120 : 128
  const ink = c.hero === 'side-portrait' ? p.ink : p.heroInk
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="${p.heroBg}"/>${layouts[c.hero]}<text x="${textX}" y="${textY}" text-anchor="${anchor}" font-family="${serif}" font-size="${c.hero === 'type' ? 30 : 18}" fill="${ink}">Alexander</text><text x="${textX}" y="${textY + (c.hero === 'type' ? 30 : 22)}" text-anchor="${anchor}" font-family="${serif}" font-size="${c.hero === 'type' ? 30 : 18}" fill="${ink}">&amp; Sarah</text><rect x="8" y="${200 - 24}" width="${label.length * 6.2 + 16}" height="16" rx="3" fill="#FBF1CF"/><text x="16" y="${200 - 12.5}" font-family="Arial, sans-serif" font-size="9" fill="#5B4A12">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

interface DraftSpec {
  id: string
  collectionId: string
  name: string
  slug: string
  localityId?: string
  regionalVariation: string
  tagline: string
  description: string
  fonts: string
  config: RegionalDraftConfig
}

const specs: DraftSpec[] = [
  {
    id: 'javanese-yogyakarta',
    collectionId: 'javanese',
    name: 'Yogyakarta Draft',
    slug: 'yogyakarta-draft',
    localityId: 'kasultanan-yogyakarta',
    regionalVariation: 'Yogyakarta direction (court style to confirm)',
    tagline: 'Balanced, ceremonial and restrained',
    description:
      'A symmetrical, framed composition with classical serif type, a fine linen texture and a provisional ivory, indigo and warm-brown palette. No batik motifs or court regalia are drawn until the locality and references are reviewed.',
    fonts: gf('Libre+Caslon+Display', 'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400'),
    config: {
      draft: true,
      directionLabel: 'Javanese · Yogyakarta direction',
      palette: { bg: '#F4EEDF', surface: '#FBF8F0', ink: '#1F2A44', muted: '#5E5A55', accent: '#A27B45', accentSoft: '#EAE1CC', line: '#D6CBB4', heroBg: '#1F2A44', heroInk: '#F4EEDF', texture: 'rgb(244 238 223 / 0.07)' },
      fonts: { display: "'Libre Caslon Display', 'Libre Caslon Text', Georgia, serif", body: "'Libre Caslon Text', Georgia, serif", displayWeight: 400, displayCase: 'none', tracking: '0.01em' },
      hero: 'framed', couple: 'pair', events: 'ledger', gallery: 'grid', texture: 'linen', divider: 'double', corner: 'square',
    },
  },
  {
    id: 'sundanese-priangan',
    collectionId: 'sundanese',
    name: 'Priangan Draft',
    slug: 'priangan-draft',
    localityId: 'priangan',
    regionalVariation: 'Priangan direction',
    tagline: 'Graceful, airy and botanical',
    description:
      'An airy arched composition with light display type, soft rounded panels, a faint dotted texture and a provisional ivory and sage palette with a generic leaf divider. No siger-inspired element is used until it is confirmed for this locality.',
    fonts: gf('Italiana', 'Nunito+Sans:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Sundanese · Priangan direction',
      palette: { bg: '#F6F2E6', surface: '#FFFFFF', ink: '#2F3A2C', muted: '#677062', accent: '#5F7A55', accentSoft: '#E7ECDD', line: '#D5DCCB', heroBg: '#EEF1E4', heroInk: '#2F3A2C', texture: 'rgb(95 122 85 / 0.14)' },
      fonts: { display: "'Italiana', 'Didot', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'none', tracking: '0.02em' },
      hero: 'arch', couple: 'cards', events: 'timeline', gallery: 'masonry', texture: 'dots', divider: 'sprig', corner: 'round',
    },
  },
  {
    id: 'minangkabau-pandai-sikek',
    collectionId: 'minangkabau',
    name: 'Pandai Sikek Draft',
    slug: 'pandai-sikek-draft',
    localityId: 'pandai-sikek',
    regionalVariation: 'Pandai Sikek, Tanah Datar direction',
    tagline: 'Layered, formal and textile-structured',
    description:
      'A layered composition of horizontal bands with a fine single-colour rib texture, strong serif headings and a provisional deep-red, cream and gold palette. No songket motifs, suntiang or tricolour stripes are used until reviewed.',
    fonts: gf('Playfair+Display:wght@500;600', 'Source+Serif+4:ital,wght@0,400;0,600;1,400'),
    config: {
      draft: true,
      directionLabel: 'Minangkabau · Pandai Sikek direction',
      palette: { bg: '#F2E7D0', surface: '#FBF5E8', ink: '#1B1717', muted: '#5C4A40', accent: '#7A1C1C', accentSoft: '#EADBC0', line: '#D9C6A5', heroBg: '#7A1C1C', heroInk: '#F2E7D0', texture: 'rgb(196 154 58 / 0.22)' },
      fonts: { display: "'Playfair Display', Georgia, serif", body: "'Source Serif 4', Georgia, serif", displayWeight: 600, displayCase: 'none', tracking: '0' },
      hero: 'bands', couple: 'overlap', events: 'cards', gallery: 'mosaic', texture: 'ribbed', divider: 'band', corner: 'square',
    },
  },
  {
    id: 'batak-toba',
    collectionId: 'batak',
    name: 'Toba Draft',
    slug: 'toba-draft',
    localityId: 'toba',
    regionalVariation: 'Toba variant',
    tagline: 'Structured split composition with a woven spine',
    description:
      'A split composition with a generic woven-texture spine, a high-contrast serif and a provisional slate and oat palette. Ulos patterns, colours and placement are not depicted: they are reserved for a reviewed Toba variant.',
    fonts: gf('Bodoni+Moda:wght@500;600', 'Work+Sans:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Batak · Toba variant',
      palette: { bg: '#EFE8DC', surface: '#FAF7F1', ink: '#263039', muted: '#5B6670', accent: '#3D4A55', accentSoft: '#DCE0DF', line: '#CBD0CF', heroBg: '#3D4A55', heroInk: '#F1ECE3', texture: 'rgb(241 236 227 / 0.13)' },
      fonts: { display: "'Bodoni Moda', 'Didot', Georgia, serif", body: "'Work Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: 500, displayCase: 'uppercase', tracking: '0.04em' },
      hero: 'split', couple: 'pair', events: 'columns', gallery: 'strip', texture: 'weave', divider: 'rule', corner: 'soft',
    },
  },
  {
    id: 'bugis-wajo',
    collectionId: 'bugis',
    name: 'Wajo Draft',
    slug: 'wajo-draft',
    localityId: 'wajo',
    regionalVariation: 'Wajo direction',
    tagline: 'Confident, silhouette-led, silk-sheen texture',
    description:
      'A tall side-portrait composition led by silhouette, geometric uppercase type, a generic silk-sheen texture and a provisional champagne, navy and bronze palette. No historic colour or status rules are reproduced.',
    fonts: gf('Josefin+Sans:wght@400;600', 'Josefin+Slab:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Bugis · Wajo direction',
      palette: { bg: '#F3ECDF', surface: '#FFFCF6', ink: '#1E2433', muted: '#5D5E66', accent: '#8C6A43', accentSoft: '#E9DCC6', line: '#D8CAB2', heroBg: '#E9DCC6', heroInk: '#1E2433', texture: 'rgb(255 255 255 / 0.55)' },
      fonts: { display: "'Josefin Sans', 'Futura', system-ui, sans-serif", body: "'Josefin Slab', Georgia, serif", displayWeight: 600, displayCase: 'uppercase', tracking: '0.12em' },
      hero: 'side-portrait', couple: 'cards', events: 'ledger', gallery: 'grid', texture: 'sheen', divider: 'rule', corner: 'square',
    },
  },
  {
    id: 'betawi-tengah',
    collectionId: 'betawi',
    name: 'Betawi Tengah Draft',
    slug: 'betawi-tengah-draft',
    localityId: 'betawi-tengah',
    regionalVariation: 'Betawi Tengah direction (community to confirm)',
    tagline: 'Lively but refined, type-led',
    description:
      'A lively, type-led composition with oversized names, rounded panels, a dotted texture and a provisional teal, coral and mustard palette. No Batik Betawi motifs are drawn and Roti Buaya is not illustrated until references are verified.',
    fonts: gf('DM+Serif+Display', 'DM+Sans:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Betawi · Betawi Tengah direction',
      palette: { bg: '#FAF3E6', surface: '#FFFFFF', ink: '#23302F', muted: '#5F6B69', accent: '#C8553F', accentSoft: '#F4E1C8', line: '#E6D3B8', heroBg: '#2E7C7A', heroInk: '#FAF3E6', texture: 'rgb(226 177 60 / 0.35)' },
      fonts: { display: "'DM Serif Display', Georgia, serif", body: "'DM Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'none', tracking: '-0.01em' },
      hero: 'type', couple: 'overlap', events: 'cards', gallery: 'masonry', texture: 'dots', divider: 'dots', corner: 'round',
    },
  },
  {
    id: 'malay-siak',
    collectionId: 'malay',
    name: 'Siak Draft',
    slug: 'siak-draft',
    localityId: 'siak',
    regionalVariation: 'Siak (Riau) direction',
    tagline: 'Elegant, composed, fine metallic grain',
    description:
      'A framed, composed layout with round portrait frames, a fine grain texture and a provisional plum and gold palette. No Tenun Siak or songket motifs and no gold-thread ornament are drawn until confirmed for Siak.',
    fonts: gf('Philosopher:wght@400;700', 'Crimson+Text:ital,wght@0,400;0,600;1,400'),
    config: {
      draft: true,
      directionLabel: 'Malay · Siak direction',
      palette: { bg: '#F6F1E4', surface: '#FFFCF5', ink: '#2E1A2B', muted: '#6A5866', accent: '#A9853F', accentSoft: '#EADFCB', line: '#DCCDB4', heroBg: '#4B2340', heroInk: '#F6F1E4', texture: 'rgb(201 162 75 / 0.2)' },
      fonts: { display: "'Philosopher', 'Optima', Georgia, serif", body: "'Crimson Text', Georgia, serif", displayWeight: 400, displayCase: 'none', tracking: '0.02em' },
      hero: 'framed', couple: 'round', events: 'timeline', gallery: 'mosaic', texture: 'grain', divider: 'rule', corner: 'soft',
    },
  },
  {
    id: 'madura-sumenep',
    collectionId: 'madura',
    name: 'Sumenep Draft',
    slug: 'sumenep-draft',
    localityId: 'sumenep',
    regionalVariation: 'Sumenep direction',
    tagline: 'Calm, editorial split with a linen texture',
    description:
      'A calm split composition with an editorial serif, a linen texture and a neutral, provisional sand and indigo-grey palette. Tone is kept neutral; no batik, attire details or a "Madura palette" are claimed until locality research is reviewed.',
    fonts: gf('Spectral:ital,wght@0,400;0,500;1,400', 'IBM+Plex+Sans:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Madura · Sumenep direction',
      palette: { bg: '#F3EFE8', surface: '#FFFFFF', ink: '#232323', muted: '#5E5E5E', accent: '#3E4C63', accentSoft: '#E3DED4', line: '#D2CCC0', heroBg: '#D9CBB3', heroInk: '#232323', texture: 'rgb(35 35 35 / 0.07)' },
      fonts: { display: "'Spectral', Georgia, serif", body: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: 500, displayCase: 'none', tracking: '0' },
      hero: 'split', couple: 'pair', events: 'timeline', gallery: 'grid', texture: 'linen', divider: 'rule', corner: 'square',
    },
  },
  {
    id: 'balinese-context-pending',
    collectionId: 'balinese',
    name: 'Bali Draft',
    slug: 'bali-draft',
    regionalVariation: 'Locality and ceremonial context to be defined with reviewers',
    tagline: 'Formal, layered, gold-sheen bands',
    description:
      'A formal banded composition with refined serif type, a soft gold-sheen texture and a provisional ivory, red and gold palette. No deities, temple architecture, offerings, sacred objects, poleng or Payas Agung references are used.',
    fonts: gf('Prata', 'Raleway:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Balinese · context to be defined',
      palette: { bg: '#F4EBDD', surface: '#FFF9F0', ink: '#2A1A16', muted: '#6B5A52', accent: '#7D1F1A', accentSoft: '#EADBC4', line: '#DCC8AC', heroBg: '#EBDDC5', heroInk: '#2A1A16', texture: 'rgb(184 147 80 / 0.35)' },
      fonts: { display: "'Prata', Georgia, serif", body: "'Raleway', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'none', tracking: '0.01em' },
      hero: 'bands', couple: 'round', events: 'ledger', gallery: 'strip', texture: 'sheen', divider: 'double', corner: 'soft',
    },
  },
  {
    id: 'dayak-ngaju',
    collectionId: 'dayak',
    name: 'Ngaju Draft',
    slug: 'ngaju-draft',
    localityId: 'ngaju',
    regionalVariation: 'Ngaju variant',
    tagline: 'Grounded, type-led, earth tones',
    description:
      'A type-led composition with spaced uppercase type, a fine rib texture and a provisional umber, bone and ochre palette. Benang Bintik is not depicted (its reference is unverified), and no Batang Garing, sacred symbols, hornbill or rainforest imagery is used.',
    fonts: gf('Tenor+Sans', 'Lato:wght@400;700'),
    config: {
      draft: true,
      directionLabel: 'Dayak · Ngaju variant',
      palette: { bg: '#F1EADF', surface: '#FBF7F1', ink: '#2B1F17', muted: '#6A5B4F', accent: '#8A5A33', accentSoft: '#E6D7C1', line: '#D6C5AD', heroBg: '#5A3E2B', heroInk: '#F1EADF', texture: 'rgb(200 155 91 / 0.25)' },
      fonts: { display: "'Tenor Sans', 'Optima', system-ui, sans-serif", body: "'Lato', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'uppercase', tracking: '0.08em' },
      hero: 'type', couple: 'pair', events: 'ledger', gallery: 'grid', texture: 'ribbed', divider: 'rule', corner: 'soft',
    },
  },
  {
    id: 'maluku-ambon',
    collectionId: 'ambon-maluku',
    name: 'Ambon Draft',
    slug: 'ambon-draft',
    localityId: 'ambon',
    regionalVariation: 'Ambon direction (community to confirm)',
    tagline: 'Warm, communal, side-portrait',
    description:
      'A warm side-portrait composition with a slab serif, rounded panels, a grain texture and a provisional cream, terracotta and deep-brown palette. No tifa, coastal scenery or single textile is used as a stand-in for Maluku.',
    fonts: gf('Arvo:ital,wght@0,400;0,700;1,400', 'Cabin:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Ambon / Maluku · Ambon direction',
      palette: { bg: '#F3E6D3', surface: '#FFF8EE', ink: '#3A251B', muted: '#6E5546', accent: '#A9573A', accentSoft: '#EBD6BC', line: '#DBC2A3', heroBg: '#4A2F23', heroInk: '#F3E6D3', texture: 'rgb(243 230 211 / 0.1)' },
      fonts: { display: "'Arvo', 'Rockwell', Georgia, serif", body: "'Cabin', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'none', tracking: '0' },
      hero: 'side-portrait', couple: 'overlap', events: 'timeline', gallery: 'mosaic', texture: 'grain', divider: 'dots', corner: 'round',
    },
  },
  {
    id: 'papuan-community-pending',
    collectionId: 'papuan',
    name: 'Papua Draft',
    slug: 'papua-draft',
    regionalVariation: 'Community to be chosen with reviewers (e.g. Biak, Asmat, Sentani, Dani)',
    tagline: 'Calm arched layout, neutral earth palette',
    description:
      'A calm arched composition with a soft serif, a generic woven texture and a provisional clay, bone and charcoal palette. It is intentionally not community-specific and uses no feathers, body paint, carvings, barkcloth or motifs; community variants follow review.',
    fonts: gf('Young+Serif', 'Manrope:wght@400;600'),
    config: {
      draft: true,
      directionLabel: 'Papuan · community to be chosen',
      palette: { bg: '#F2EBE0', surface: '#FFFFFF', ink: '#2A2523', muted: '#645A54', accent: '#9A5B3F', accentSoft: '#E7DACB', line: '#D5C7B6', heroBg: '#E3D5C2', heroInk: '#2A2523', texture: 'rgb(42 37 35 / 0.08)' },
      fonts: { display: "'Young Serif', Georgia, serif", body: "'Manrope', 'Segoe UI', system-ui, sans-serif", displayWeight: 400, displayCase: 'none', tracking: '0' },
      hero: 'arch', couple: 'cards', events: 'columns', gallery: 'strip', texture: 'weave', divider: 'rule', corner: 'soft',
    },
  },
]

export const REGIONAL_DRAFT_TEMPLATES: readonly RenderableTemplate[] = specs.map((s) => ({
  id: s.id,
  slug: s.slug,
  familyId: 'traditional',
  collectionId: s.collectionId,
  localityId: s.localityId,
  regionalVariation: s.regionalVariation,
  name: s.name,
  tagline: s.tagline,
  description: s.description,
  status: 'draft',
  previewImage: thumbnail(s.config, 'DRAFT · review pending'),
  fonts: { href: s.fonts },
  component,
  config: s.config,
}))
