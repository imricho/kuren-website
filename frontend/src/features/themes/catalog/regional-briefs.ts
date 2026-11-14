/**
 * Cultural briefs for the 12 regional Traditional collections.
 *
 * STATUS: every brief is `in_development`. No source has been verified by the
 * Kuren team and no practitioner or cultural organisation has reviewed any of
 * them. Nothing here may be shown to customers as cultural fact.
 *
 * How to read a brief:
 *   - `sources`      starting references; `verified: false` until read and confirmed.
 *   - `confirmed`    references backed by a verified source — empty everywhere for now.
 *   - `toResearch`   candidate references from the product design brief (questions, not facts).
 *   - `avoid`        guardrails from the design brief.
 *   - `artDirection` tentative creative choices; palettes are NOT cultural colour claims.
 *
 * The review process is documented in docs/cultural-review/README.md.
 */
import type { CulturalBrief, CulturalItems, LocalityOption, SourceReference } from '../core/types'

const none: CulturalItems = { garments: [], textiles: [], motifs: [], objects: [] }
const items = (partial: Partial<CulturalItems>): CulturalItems => ({ ...none, ...partial })
const options = (...names: [id: string, name: string][]): LocalityOption[] =>
  names.map(([id, name]) => ({ id, name, status: 'coming_soon' }))

/** Starting point for every collection (national intangible-heritage portal). */
const CULTURE_MINISTRY = 'Kementerian Kebudayaan (formerly Kemdikbud); record location to re-confirm'
const EXPIRED_CERT = `Checked 2026-11-14: link failing (expired TLS certificate). Heritage records may now be published via DAPOBUD (dapobud.kemenbud.go.id); re-locate before verifying.`

const BUDAYA_KITA: SourceReference = {
  title: 'Budaya Kita — Warisan Budaya Takbenda Indonesia portal',
  url: 'https://budaya.data.kemdikbud.go.id/',
  publisher: CULTURE_MINISTRY,
  covers: 'National heritage portal; a starting point for locating locality-specific records. Not itself a reference for any one design.',
  verified: false,
  accessNote: EXPIRED_CERT,
}

const NEUTRAL_PLACEHOLDER = [
  { name: 'Placeholder ivory', hex: '#F2EEE6' },
  { name: 'Placeholder stone', hex: '#B9B2A6' },
  { name: 'Placeholder charcoal', hex: '#34312D' },
]

const NOT_STARTED = 'Cultural review not started. No practitioner or cultural organisation has been consulted yet.'
const UNVERIFIED = 'Sources listed are starting points from the product brief and have not yet been verified by the team.'
/** Records the AI desk review honestly; it is not a practitioner or community review. */
const DESK_REVIEW =
  '2026-11-14: desk review by an AI cultural-intelligence assistant (not a practitioner or community review) — scope, terminology, locality options and guardrails revised; source links checked.'
const NOT_EXHAUSTIVE = 'Options are not exhaustive; confirm with the couple and reviewers.'
const ART_NOT_CLAIM = 'Palette is art direction; it may take visual cues from reviewed references but makes no colour claim.'

type BaseBrief = Omit<CulturalBrief, 'designStatus' | 'draft' | 'suggestedReviewers' | 'openQuestions'>

const BASE_BRIEFS: Record<string, BaseBrief> = {
  javanese: {
    localityRequired: true,
    localityLabel: 'locality or court tradition',
    localities: options(
      ['kasultanan-yogyakarta', 'Kasultanan Yogyakarta'],
      ['pakualaman', 'Pakualaman'],
      ['kasunanan-surakarta', 'Kasunanan Surakarta'],
      ['mangkunegaran', 'Mangkunegaran'],
      ['east-java', 'East Java (subregion to specify, e.g. Arek, Mataraman, Osing, Tengger)'],
    ),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, 'Choose one locality; do not merge Yogyakarta and Surakarta court traditions into one generic look.'],
    },
    sources: [
      {
        title: 'Indonesian Batik (Representative List of the Intangible Cultural Heritage of Humanity)',
        url: 'https://ich.unesco.org/en/RL/indonesian-batik-00170',
        publisher: 'UNESCO',
        covers: 'Batik as Indonesian intangible heritage in general. Not specific to Javanese weddings or to any one locality.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({
      garments: ['Kebaya silhouette (bride) — court/locality to confirm', 'Groom attire (e.g. beskap) — court/locality to confirm'],
      textiles: ['Locally appropriate batik for the chosen locality'],
    }),
    avoid: [
      'Reproducing palace regalia or motifs that may be restricted without local approval',
      'Merging court traditions into one generic "Javanese" style',
    ],
    artDirection: {
      palette: [
        { name: 'Warm ivory', hex: '#F4EEDF' },
        { name: 'Deep indigo', hex: '#1F2A44' },
        { name: 'Warm brown', hex: '#7A4E2D' },
        { name: 'Limited gold', hex: '#B8955A' },
      ],
      typography: 'Composed, classical serif with restrained letter-spacing.',
      composition: 'Finely balanced, symmetrical, ceremonial pacing.',
      imagery: 'Portraits and attire details; batik used as texture only once verified for the locality.',
      layout: 'Centred hierarchy with restrained ornament.',
    },
  },

  sundanese: {
    localityRequired: true,
    localityLabel: 'locality',
    localities: options(['priangan', 'Priangan'], ['cirebon', 'Cirebon (distinct tradition; confirm community self-identification)']),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, 'No locality-specific source recorded yet.', 'A siger-inspired silhouette may only be used after confirming it suits the chosen locality and context.'],
    },
    sources: [BUDAYA_KITA],
    confirmed: none,
    toResearch: items({
      garments: ['Kebaya — locality to confirm'],
      textiles: ['Samping (wrapped textile) — locality to confirm'],
      objects: ['Siger-inspired silhouette — only if appropriate to the locality and context'],
    }),
    avoid: [
      'Presenting the art-direction colours as universal Sundanese wedding customs',
      'Using Lampung siger forms for a Sundanese siger',
      'Including Baduy references without community consent (out of scope)',
    ],
    artDirection: {
      palette: [
        { name: 'Ivory', hex: '#F6F2E6' },
        { name: 'Soft sage', hex: '#9DB08B' },
        { name: 'Leaf green', hex: '#5F7A55' },
        { name: 'Warm sand', hex: '#D8C7A8' },
      ],
      typography: 'Graceful serif with an airy, light weight.',
      composition: 'Airy and open, generous white space.',
      imagery: 'Light botanical detail; no cultural motifs until verified.',
      layout: 'Flowing vertical rhythm with soft section breaks.',
    },
  },

  minangkabau: {
    localityRequired: true,
    localityLabel: 'locality (nagari)',
    localities: options(['pandai-sikek', 'Pandai Sikek, Tanah Datar']),
    localitiesNote: 'Not exhaustive. Minang living outside West Sumatra (rantau) also need a nagari of origin.',
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, 'Attire and ornament vary between localities; confirm the specific nagari before using any detail.'],
    },
    sources: [
      {
        title: 'Tenun Songket Pandai Sikek dalam Budaya Masyarakat Minangkabau',
        url: 'https://garuda.kemdiktisaintek.go.id/documents/detail/1375494',
        publisher: 'Yandri, Humanus 13(1), 2014 — indexed in Garuda',
        covers: 'Pandai Sikek songket, including its wedding use, in that nagari only.',
        accessNote: 'Checked 2026-11-14: original download.garuda.kemdikbud.go.id link no longer resolves; moved to this address.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({
      garments: ['Baju kurung — locality to confirm'],
      textiles: ['Songket (e.g., Pandai Sikek) — confirm use in weddings for the chosen locality'],
      objects: ['Suntiang (bridal headdress) — locality to confirm', 'Rumah Gadang-inspired architectural geometry — only if sourced for the locality'],
    }),
    avoid: [
      'Inventing symbolism for colours or motifs',
      'Ignoring differences between localities',
      'Using the marawa tricolour as stripes or ornament; the draft palette is not a marawa reference',
    ],
    artDirection: {
      palette: [
        { name: 'Deep red', hex: '#7A1C1C' },
        { name: 'Black', hex: '#1B1717' },
        { name: 'Gold', hex: '#C49A3A' },
        { name: 'Cream', hex: '#F2E7D0' },
      ],
      typography: 'Formal, strong serif; layered headings.',
      composition: 'Layered, formal, strong textile-like structure.',
      imagery: 'Ceremonial framing; textile texture only once verified.',
      layout: 'Stacked bands and framed panels.',
    },
  },

  batak: {
    localityRequired: true,
    localityLabel: 'subtradition',
    localities: options(
      ['toba', 'Toba'],
      ['karo', 'Karo'],
      ['mandailing', 'Mandailing'],
      ['simalungun', 'Simalungun'],
      ['pakpak', 'Pakpak'],
      ['angkola', 'Angkola'],
    ),
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [
        NOT_STARTED,
        DESK_REVIEW,
        UNVERIFIED,
        'There is no pan-Batak visual identity. Use a neutral preview until a subtradition is identified and reviewed.',
        'Specific ulos types, their use and placement must be verified before depiction.',
      ],
    },
    sources: [
      {
        title: 'Ulos Batak Toba (Warisan Budaya Takbenda record)',
        url: 'https://budaya.data.kemdikbud.go.id/wbtb/objek/AA000240',
        publisher: CULTURE_MINISTRY,
        accessNote: EXPIRED_CERT,
        covers: 'Ulos of the Batak Toba. Applies to the Toba subtradition only.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({ textiles: ['Ulos Batak Toba — Toba variant only; specific types and placement to verify'] }),
    avoid: [
      'Presenting one pan-Batak style',
      'Applying Toba references to other Batak communities',
      'Forcing a "Batak" label: many Mandailing (and some Angkola and Karo) do not identify as Batak — let the couple name their community',
    ],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Neutral serif until a subtradition is chosen.',
      composition: 'Neutral; subtradition-specific direction to follow research.',
      imagery: 'No community-specific textiles, headwear or motifs before review.',
      layout: 'Neutral layout; textile bands only for a reviewed Toba variant.',
    },
  },

  bugis: {
    localityRequired: true,
    localityLabel: 'locality',
    localities: options(['bone', 'Bone'], ['wajo', 'Wajo'], ['soppeng', 'Soppeng'], ['diaspora', 'Bugis communities outside South Sulawesi']),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, 'Build the system around silhouette and woven texture, not invented symbols. Choose an expressive palette only after checking local examples.'],
    },
    sources: [
      {
        title: 'Eksistensi Komunitas Penenun Bugis: Sebuah Refleksi Sosio-Kultural Masyarakat Wajo',
        url: 'https://garuda.kemdiktisaintek.go.id/documents/detail/1151910',
        publisher: 'Andi Ima Kesuma, Walasuji 9(2), 2018 — indexed in Garuda',
        covers: 'Bugis weaving communities in Tanasitolo, Wajo. Research on weavers; no wedding or sabbe-design content in the abstract.',
        accessNote: 'Checked 2026-11-14: original download.garuda.kemdikbud.go.id link no longer resolves; moved to this address.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({
      garments: ['Baju bodo — verify local wedding use; also shared with Makassar, not exclusively Bugis'],
      textiles: ['Lipa sabbe (silk sarong) — verify'],
    }),
    avoid: ['Presenting historic colour or status rules as universal or current without evidence and community review'],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Confident, structured serif.',
      composition: 'Confident and structured; silhouette-led.',
      imagery: `Woven texture and garment silhouette. ${ART_NOT_CLAIM}`,
      layout: 'Strong vertical structure with textile-led panels.',
    },
  },

  betawi: {
    localityRequired: false,
    localityLabel: 'community',
    localities: options(['betawi-tengah', 'Betawi Tengah'], ['betawi-pinggir', 'Betawi Pinggir / Ora']),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, "Reflect Betawi's documented cultural influences without turning them into a collage or caricature."],
    },
    sources: [
      {
        title: 'Roti Buaya (Warisan Budaya Takbenda record)',
        url: 'https://budaya.data.kemdikbud.go.id/wbtb/objek/AA000046',
        publisher: CULTURE_MINISTRY,
        accessNote: EXPIRED_CERT,
        covers: 'Roti Buaya as Betawi intangible heritage.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({
      textiles: ['Batik Betawi — as a secondary textile element, to verify'],
      objects: ['Roti Buaya — contextual wedding illustration or detail only'],
    }),
    avoid: [
      'Using Roti Buaya as repeated decoration or a mascot',
      'Reducing Betawi culture to ondel-ondel or a generic "Jakarta" theme',
      'Collage or caricature of cultural influences',
    ],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Lively, warm serif with a friendly display face.',
      composition: 'Lively and layered, but disciplined.',
      imagery: `One contextual illustrative detail at most. ${ART_NOT_CLAIM}`,
      layout: 'Layered sections with a secondary textile band.',
    },
  },

  malay: {
    localityRequired: true,
    localityLabel: 'locality',
    localities: options(
      ['siak', 'Siak (Riau)'],
      ['riau', 'Other Riau localities'],
      ['riau-islands', 'Riau Islands'],
      ['deli-langkat', 'Deli / Langkat (North Sumatra)'],
      ['jambi', 'Jambi'],
      ['palembang', 'Palembang (South Sumatra)'],
      ['bangka-belitung', 'Bangka Belitung'],
      ['west-kalimantan', 'West Kalimantan (e.g. Sambas, Pontianak)'],
    ),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, 'Malay communities across Indonesia are not interchangeable; choose a locality before motifs or garment details.'],
    },
    sources: [
      {
        title: 'Tenun Siak (Warisan Budaya Takbenda record)',
        url: 'https://budaya.data.kemdikbud.go.id/wbtb/objek/AA000349',
        publisher: CULTURE_MINISTRY,
        accessNote: EXPIRED_CERT,
        covers: 'Siak woven textile. Specific to Siak.',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({
      garments: ['Baju kurung — locality to confirm'],
      textiles: ['Songket or other documented woven textiles (e.g., Tenun Siak for Siak)'],
      motifs: ['Gold-thread detail, floral or geometric ornament — only when confirmed for the locality'],
    }),
    avoid: [
      'Treating Malay communities across Indonesia as interchangeable',
      'Substituting Malaysian or Singaporean Malay wedding references for Indonesian localities',
    ],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Elegant, composed serif.',
      composition: 'Elegant and composed.',
      imagery: 'Woven textile texture once verified for the chosen locality.',
      layout: 'Balanced, framed sections.',
    },
  },

  madura: {
    localityRequired: true,
    localityLabel: 'locality',
    localities: options(
      ['bangkalan', 'Bangkalan'],
      ['sampang', 'Sampang'],
      ['pamekasan', 'Pamekasan'],
      ['sumenep', 'Sumenep'],
      ['outer-islands', 'Outlying islands (e.g. Kangean, Sapudi)'],
      ['pandalungan', 'Madurese communities in eastern East Java (Tapal Kuda / Pandalungan)'],
    ),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, 'No locality-specific source recorded yet.', 'Keep Madurese references distinct from broader East Java or Arek traditions unless a source supports the connection.'],
    },
    sources: [BUDAYA_KITA],
    confirmed: none,
    toResearch: items({ garments: ['Wedding attire of the chosen locality'], textiles: ['Batik of the chosen locality'] }),
    avoid: ['Stating a generic "Madura palette" as cultural fact', 'Merging Madurese references with East Java or Arek traditions without a source'],
    artDirection: {
      palette: [
        { name: 'Near-black', hex: '#141414' },
        { name: 'Ivory', hex: '#F4F0E8' },
        { name: 'Placeholder neutral', hex: '#9A8F80' },
      ],
      typography: 'Neutral serif until locality research is reviewed.',
      composition: 'Composition to follow locality research; tone neutral until reviewed.',
      imagery: `Textile references only from the verified locality. ${ART_NOT_CLAIM}`,
      layout: 'Neutral layout until reviewed.',
    },
  },

  balinese: {
    localityRequired: true,
    localityLabel: 'locality and ceremonial context',
    localities: [],
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [
        NOT_STARTED,
        DESK_REVIEW,
        'No locality-specific source recorded yet; the locality/context options still need to be defined with reviewers.',
        'Payas Agung may be considered only when appropriate to the selected context and reviewed.',
      ],
    },
    sources: [BUDAYA_KITA],
    confirmed: none,
    toResearch: items({
      garments: ['Payas Agung — only if appropriate to the context and reviewed'],
      textiles: ['Locally reviewed wedding textiles (layered treatment)'],
    }),
    avoid: [
      'Using deities, temple architecture, offerings, sacred objects or ritual imagery as generic decoration',
      'Using poleng (black-white checked cloth) or other temple/ritual cloths as pattern',
      'Framing Payas Agung or any style by caste/wangsa; Bali Aga communities and non-Hindu Balinese need their own review',
    ],
    artDirection: {
      palette: [
        { name: 'Ivory', hex: '#F4EBDD' },
        { name: 'Restrained red', hex: '#7D1F1A' },
        { name: 'Restrained gold', hex: '#B89350' },
      ],
      typography: 'Formal, richly detailed serif.',
      composition: 'Formal and detailed, with layered textile treatment.',
      imagery: 'Attire and textile details after source review; no sacred imagery.',
      layout: 'Layered frames.',
    },
  },

  dayak: {
    localityRequired: true,
    localityLabel: 'community',
    localities: options(
      ['ngaju', 'Ngaju'],
      ['iban', 'Iban'],
      ['kenyah', 'Kenyah'],
      ['kayan', 'Kayan'],
      ['maanyan', "Ma'anyan"],
      ['kanayatn', 'Kanayatn'],
      ['benuaq', 'Benuaq'],
    ),
    localitiesNote: NOT_EXHAUSTIVE,
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, UNVERIFIED, 'Dayak is an umbrella term for many peoples; select a community before any motif, textile or architectural reference.'],
    },
    sources: [
      {
        title: 'Benang Bintik (Kalimantan Tengah)',
        url: 'https://kebudayaan.kemdikbud.go.id/bpnbkalbar/wp-content/uploads/sites/22/2017/10/BENANG-BINTIK-KALTENG.pdf',
        publisher: 'Balai Pelestarian Nilai Budaya Kalimantan Barat (now BPK Wilayah XII)',
        covers: 'Benang Bintik, Central Kalimantan; community association to confirm. Not all Dayak peoples.',
        accessNote: 'Checked 2026-11-14: host no longer resolves and no copy was found; locate a current copy (paths now use /bpkw12/).',
        verified: false,
      },
      BUDAYA_KITA,
    ],
    confirmed: none,
    toResearch: items({ textiles: ['Benang Bintik — Ngaju direction only'] }),
    avoid: [
      'Using Batang Garing or any sacred or community-specific symbol without explicit local approval',
      'Mandau/war, headhunting or "warrior" imagery; hornbill or hornbill-feather imagery (protected and sacred)',
      'Generic rainforest imagery as a substitute for cultural research',
      'Generalising Ngaju references to all Dayak peoples',
    ],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Neutral serif until a community is chosen.',
      composition: 'Neutral; community-specific direction to follow research.',
      imagery: 'No motifs until a community is chosen and reviewed.',
      layout: 'Neutral layout.',
    },
  },

  'ambon-maluku': {
    localityRequired: true,
    localityLabel: 'island or community',
    localities: options(['ambon', 'Ambon']),
    localitiesNote: 'Not exhaustive. Covers Maluku and North Maluku provinces (incl. the Ternate and Tidore traditions); name the island or community.',
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, 'No community-specific source recorded yet.', 'Maluku is a diverse archipelago; identify the island or community before garments, textiles, motifs or objects.'],
    },
    sources: [BUDAYA_KITA],
    confirmed: none,
    toResearch: items({ objects: ['Tifa — only where locally appropriate and reviewed'] }),
    avoid: [
      'Using coastal colours or scenery as a stand-in for cultural specificity',
      'Presenting tifa as a Maluku identifier — it is also used in Papua and is not a symbol of every Maluku community',
      'Coding Maluku with one religion, or invoking pela gandong or conflict history without source and review',
    ],
    artDirection: {
      palette: [
        { name: 'Warm cream', hex: '#F3E6D3' },
        { name: 'Terracotta', hex: '#A9573A' },
        { name: 'Deep brown', hex: '#4A2F23' },
      ],
      typography: 'Warm, open serif.',
      composition: 'Warm and communal.',
      imagery: 'People and gatherings; cultural references only from the verified community.',
      layout: 'Open, communal grouping of sections.',
    },
  },

  papuan: {
    localityRequired: true,
    localityLabel: 'community',
    localities: options(
      ['biak', 'Biak (Papua province)'],
      ['asmat', 'Asmat (South Papua)'],
      ['sentani', 'Sentani (Papua province)'],
      ['dani', 'Dani (Highland Papua; confirm self-name, e.g. Hubula)'],
    ),
    localitiesNote: 'Not exhaustive. Lani and Yali are distinct peoples, not Dani; record the province for each community.',
    selectedLocality: null,
    review: {
      status: 'in_development',
      reviewers: [],
      notes: [NOT_STARTED, DESK_REVIEW, 'No community-specific source recorded yet.', 'Carving, textile, material or landscape references only when documented for the community and approved for this use.'],
    },
    sources: [BUDAYA_KITA],
    confirmed: none,
    toResearch: none,
    avoid: [
      'Assembling a generic "Papuan" style from feathers, body paint, barkcloth, carvings or motifs of unrelated peoples',
      'Generalising an Asmat reference to all of Papua',
      'Koteka, nudity, body paint, or "primitive/exotic" framing',
      'Bird-of-paradise feathers (protected species)',
      'The Morning Star flag or other political symbols',
    ],
    artDirection: {
      palette: NEUTRAL_PLACEHOLDER,
      typography: 'Neutral serif until a community is chosen.',
      composition: 'Neutral; community-specific direction to follow research.',
      imagery: 'No cultural references until a community is chosen, documented and approved.',
      layout: 'Neutral layout.',
    },
  },
}

// --- Draft designs (design status) -------------------------------------------------------
//
// Each collection has a complete draft template (status `draft`: previewable, not
// selectable). Cultural status is unchanged: review pending. Drafts use only safer
// cues — composition, generic material texture, typography, provisional palette.

const SAFE_CUES = [
  'Composition, typography and a generic material texture (art direction; no cultural claim)',
  'Provisional palette (art direction; no colour meaning claimed)',
  'Shared sample wedding content and the shared content contract',
]
const scoped = (title: string) => `Scope only, not design content: "${title}" (unverified)`

const DRAFT_META: Record<
  string,
  Pick<CulturalBrief, 'designStatus' | 'draft' | 'suggestedReviewers' | 'openQuestions'>
> = {
  javanese: {
    designStatus: 'draft',
    draft: {
      templateIds: ['javanese-yogyakarta'],
      referencesUsed: [...SAFE_CUES, scoped('Indonesian Batik (UNESCO)')],
      leftOutPendingReview: ['Batik motifs of any kind', 'Court regalia and Paes Ageng / Basahan styling', 'Kebaya and beskap depictions'],
    },
    suggestedReviewers: [
      'Dinas Kebudayaan (Kundha Kabudayan) DIY',
      'A Yogyakarta-style bridal (paes) practitioner',
      'Batik/textile curators, e.g. Museum Sonobudoyo',
    ],
    openQuestions: [
      'Which court tradition does the draft represent (Kasultanan or Pakualaman), and is the template name appropriate?',
      'Which batik, if any, is appropriate for wedding use and for a public website?',
      'Are any motifs restricted to court use?',
    ],
  },
  sundanese: {
    designStatus: 'draft',
    draft: {
      templateIds: ['sundanese-priangan'],
      referencesUsed: [...SAFE_CUES, 'Generic leaf divider (botanical art direction, not a cultural motif)'],
      leftOutPendingReview: ['Siger or siger-inspired forms', 'Kebaya and samping depictions'],
    },
    suggestedReviewers: [
      'Dinas Kebudayaan dan Pariwisata Jawa Barat',
      'Sundanese bridal (rias pengantin) practitioners from Priangan',
      'Textile researchers in West Java',
    ],
    openQuestions: [
      'Is a siger-inspired silhouette appropriate for a Priangan wedding website?',
      'Which samping textiles are documented for weddings in Priangan?',
    ],
  },
  minangkabau: {
    designStatus: 'draft',
    draft: {
      templateIds: ['minangkabau-pandai-sikek'],
      referencesUsed: [...SAFE_CUES, scoped('Tenun Songket Pandai Sikek (Yandri, Humanus 2014)'), 'Layered band composition (structure only)'],
      leftOutPendingReview: ['Songket motifs', 'Suntiang depictions', 'Rumah Gadang geometry', 'Marawa tricolour stripes'],
    },
    suggestedReviewers: [
      'Kerapatan Adat Nagari (KAN) of Pandai Sikek',
      'Pandai Sikek songket weavers',
      'Dinas Kebudayaan Sumatera Barat',
    ],
    openQuestions: [
      'Is the deep-red, cream and gold art direction acceptable, or does it read as a marawa reference?',
      'Which songket and suntiang references are appropriate for Pandai Sikek weddings?',
    ],
  },
  batak: {
    designStatus: 'draft',
    draft: {
      templateIds: ['batak-toba'],
      referencesUsed: [...SAFE_CUES, scoped('Ulos Batak Toba record (link failing)'), 'Generic woven texture (not an ulos pattern)'],
      leftOutPendingReview: ['Ulos patterns, colours and placement', 'Gorga or other carved ornament', 'Any reference for Karo, Mandailing, Simalungun, Pakpak or Angkola'],
    },
    suggestedReviewers: [
      'Toba Batak adat elders and cultural practitioners',
      'Ulos weavers from the Toba area',
      'Dinas Kebudayaan Sumatera Utara',
    ],
    openQuestions: [
      'Which ulos (if any) may be depicted on a wedding invitation, and how?',
      'What sources and reviewers exist for the Karo, Mandailing, Simalungun, Pakpak and Angkola variants?',
      'How should couples who do not identify as Batak be offered their own community option?',
    ],
  },
  bugis: {
    designStatus: 'draft',
    draft: {
      templateIds: ['bugis-wajo'],
      referencesUsed: [...SAFE_CUES, scoped('Bugis weaving communities in Wajo (Kesuma, Walasuji 2018)'), 'Generic silk-sheen texture (not a lipa sabbe pattern)'],
      leftOutPendingReview: ['Baju bodo depictions and colours', 'Lipa sabbe patterns', 'Historic colour or status rules'],
    },
    suggestedReviewers: [
      'Bugis cultural practitioners in Wajo',
      'Lipa sabbe weavers (e.g. Tanasitolo, Wajo)',
      'Balai Pelestarian Kebudayaan office for South Sulawesi',
    ],
    openQuestions: [
      'Which lipa sabbe patterns are used at Wajo weddings today?',
      'How should baju bodo be represented without implying historic status rules?',
    ],
  },
  betawi: {
    designStatus: 'draft',
    draft: {
      templateIds: ['betawi-tengah'],
      referencesUsed: [...SAFE_CUES, scoped('Roti Buaya record (link failing)')],
      leftOutPendingReview: ['Batik Betawi motifs', 'Roti Buaya illustration', 'Ondel-ondel or generic Jakarta imagery'],
    },
    suggestedReviewers: [
      'Lembaga Kebudayaan Betawi (LKB)',
      'Betawi wedding practitioners (Betawi Tengah and Pinggir)',
      'Dinas Kebudayaan DKI Jakarta',
    ],
    openQuestions: [
      'Is Betawi Tengah the right reference for this draft, or should communities be separate templates?',
      'How, if at all, should Roti Buaya appear as a contextual detail?',
    ],
  },
  malay: {
    designStatus: 'draft',
    draft: {
      templateIds: ['malay-siak'],
      referencesUsed: [...SAFE_CUES, scoped('Tenun Siak record (link failing)'), 'Generic fine grain texture (not gold-thread ornament)'],
      leftOutPendingReview: ['Tenun Siak and songket motifs', 'Gold-thread ornament', 'Baju kurung depictions'],
    },
    suggestedReviewers: [
      'Lembaga Adat Melayu Riau (LAM Riau), Siak',
      'Tenun Siak weavers',
      'Dinas Kebudayaan Provinsi Riau',
    ],
    openQuestions: [
      'Which Tenun Siak references are appropriate for a wedding invitation?',
      'Is the plum and gold art direction acceptable for Siak, or misleading?',
    ],
  },
  madura: {
    designStatus: 'draft',
    draft: {
      templateIds: ['madura-sumenep'],
      referencesUsed: [...SAFE_CUES, 'Neutral tone by design (avoids stereotyped "bold" framing)'],
      leftOutPendingReview: ['Sumenep batik', 'Wedding attire depictions', 'Any "Madura palette" claim'],
    },
    suggestedReviewers: [
      'Sumenep regency culture office',
      'Sumenep batik makers',
      'Madurese wedding practitioners from Sumenep',
    ],
    openQuestions: [
      'Which Sumenep batik and attire references are documented for weddings?',
      'Should other localities (Bangkalan, Sampang, Pamekasan, Pandalungan) be separate templates?',
    ],
  },
  balinese: {
    designStatus: 'draft',
    draft: {
      templateIds: ['balinese-context-pending'],
      referencesUsed: [...SAFE_CUES, 'Generic gold-sheen texture (not a ritual or temple cloth)'],
      leftOutPendingReview: ['Payas Agung', 'Deities, temples, offerings, sacred objects', 'Poleng or other ritual cloths', 'Caste/wangsa framing'],
    },
    suggestedReviewers: [
      'Majelis Desa Adat (MDA) Provinsi Bali',
      'Balinese bridal (payas) practitioners, by regency',
      'Dinas Kebudayaan Provinsi Bali',
    ],
    openQuestions: [
      'Which locality and ceremonial context should the first Balinese template represent?',
      'Which wedding attire and textile references are appropriate for a public website?',
    ],
  },
  dayak: {
    designStatus: 'draft',
    draft: {
      templateIds: ['dayak-ngaju'],
      referencesUsed: [...SAFE_CUES, scoped('Benang Bintik, Central Kalimantan (link dead; Ngaju association unconfirmed)')],
      leftOutPendingReview: ['Benang Bintik', 'Batang Garing and other sacred symbols', 'Mandau, headhunting, hornbill or rainforest imagery', 'Any Iban or other community reference'],
    },
    suggestedReviewers: [
      'Dewan Adat Dayak (DAD) Kalimantan Tengah',
      'Ngaju cultural practitioners and weavers',
      'Balai Pelestarian Kebudayaan office covering Central Kalimantan',
    ],
    openQuestions: [
      'Is Benang Bintik documented as a Ngaju wedding textile, and may it be depicted?',
      'What sources and reviewers exist for an Iban variant?',
    ],
  },
  'ambon-maluku': {
    designStatus: 'draft',
    draft: {
      templateIds: ['maluku-ambon'],
      referencesUsed: SAFE_CUES,
      leftOutPendingReview: ['Tifa', 'Coastal scenery', 'Any single textile as representative of Maluku', 'Religious or pela gandong references'],
    },
    suggestedReviewers: [
      'Ambon cultural practitioners (confirming community self-identification)',
      'Dinas Kebudayaan Provinsi Maluku',
      'Museum Siwalima, Ambon',
    ],
    openQuestions: [
      'Which Ambon community and wedding references should this draft represent?',
      'Which other islands or communities (incl. North Maluku) need their own templates?',
    ],
  },
  papuan: {
    designStatus: 'draft',
    draft: {
      templateIds: ['papuan-community-pending'],
      referencesUsed: [...SAFE_CUES, 'Intentionally community-neutral until a community is chosen'],
      leftOutPendingReview: ['Feathers (incl. bird-of-paradise), body paint, koteka, carvings, barkcloth', 'Motifs from any community', 'Political symbols'],
    },
    suggestedReviewers: [
      'Practitioners from the chosen community, via community-led organisations',
      'Dinas Kebudayaan of the relevant province',
      'Museum Loka Budaya, Universitas Cenderawasih (Jayapura)',
    ],
    openQuestions: [
      'Which community should the first Papuan template represent, and who can approve its references?',
      'Is a community-neutral draft acceptable as an interim design?',
    ],
  },
}

export const REGIONAL_BRIEFS: Record<string, CulturalBrief> = Object.fromEntries(
  Object.entries(BASE_BRIEFS).map(([id, brief]) => [id, { ...brief, ...DRAFT_META[id]! }]),
)

