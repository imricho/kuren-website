# Theme system

**One shared wedding content model, many independent theme presentations.**

## Catalog hierarchy

```
ThemeFamily         broad visual category                      catalog/families.ts
└─ ThemeCollection  specific design direction                  catalog/collections.ts
   └─ ThemeTemplate the selectable, renderable design         <template folder>/index.ts
                    (planned templates without a renderer)    catalog/planned.ts
```

| Family | Collections | Templates (id → name) |
|---|---|---|
| Traditional | Ceremonial Classic; Artisan Pattern (origin-neutral design directions) | `traditional` → Royal Maroon, `ethnic` → Woven Indigo |
| International | Editorial | `international` → Editorial Ivory |
| Conventional / Classic (`classic`, alias `conventional`) | Romantic Floral | `conventional` → Blush Garden |
| Artistic | Contemporary | `artistic` → Gallery Bold |
| Modern Minimalist | — (coming soon) | — |
| Rustic / Nature | — (coming soon) | — |

- **Status** (`available` / `coming_soon` / `hidden`) exists at every level. Hidden templates render by
  direct link (QA) but aren't listed.
- **Template ids are permanent** — they will be stored on weddings. Display names can change freely
  (Workstream 2's ids `international`, `traditional`, `ethnic`, `conventional`, `artistic` are unchanged).
- **References**: each collection has `reference: { kind, notes, review }`. The two Traditional
  collections use original, abstract design directions and make no claim to represent a named
  region, community, textile, ceremony or cultural practice. A future culturally specific design
  needs verified research and appropriate community review before it is presented as such.
- **Config**: a template may carry `config`, passed to its component as a prop. This lets one renderer
  power several distinct design directions while keeping the shared content model intact.
- **Integrity**: `validateCatalog()` checks unique kebab-case ids, reserved ids (`preview`),
  family/collection references, status consistency and renderers. It runs in tests and logs in dev.

- **Canonical names**: one display name per entry, used on every page and in the dashboard
  ("Conventional / Classic" for the `classic` family). Old slugs are `aliases`, never shown.

### Theme studio (picker)

One page, two columns on desktop (≥1024px): **sidebar on the left** to browse Family → Collection →
Template, **live preview on the right**. Below 1024px the sidebar becomes a collapsible
"Browse themes" selector above the preview; it collapses after a template is chosen and the preview
scrolls into view.

| Level | Canonical route (all render `ThemeStudioPage`) |
|---|---|
| 1 Families | `/themes` |
| 2 Collections | `/themes/:familyId` — always shown, including single-collection and in-development families |
| 3 Templates | `/themes/:familyId/:collectionId` |
| Template previewed | `/themes/:familyId/:collectionId/:templateSlug` |
| Full-screen preview | `/themes/:familyId/:collectionId/:templateSlug/preview` |

- **URLs use slugs.** Families use their id (`classic` for "Conventional / Classic"); templates use a
  name-based `slug` (`blush-garden`), so a URL reads consistently. The template `id` (`conventional`)
  remains the stored key. `picker/guards.ts` redirects family aliases (`/themes/conventional`),
  template ids/aliases, collections under the wrong family, and the Workstream 2 URL
  `/themes/:templateId/preview` to the canonical route.
- **Preview ≠ select.** Clicking a template in the sidebar previews it (URL + preview pane; stored as
  session-only `previewedThemeId`). Selecting is one action — `SelectTemplateButton` in the preview
  pane and full-screen bar — reflected as "Selected" in the sidebar and in the
  "Selected: Family › Collection › Template" live region.
- **What the preview shows**: the URL's template; otherwise the last previewed or selected template if it
  belongs to the current family/collection; otherwise that scope's first template. Levels with nothing
  to preview (planned collections/families) keep the last template and say so in a notice.
- **Summaries agree with statuses**: `familySummary()`, `countLabel()` per collection and
  `STATUS_LABEL` use the catalog as their source of truth.
- **Accessibility**: the sidebar is a labelled navigation with step indicator, breadcrumbs and back
  links; device size is a native radio group; items expose one named link with a focus ring; the preview
  frame is a labelled, keyboard-scrollable region; themes get a visible focus outline.
- **No obscured content**: preview controls sit above the frame, never over it. The frame is a size
  container, so full-height invitation sections use `100cqh` (the frame height). The full-screen bar is a
  sticky bar above the invitation with `--site-vh = 100svh − bar height`.

## Shared content contract

Every renderable template receives exactly `ThemeProps` — `{ content: WeddingContent, config? }` —
from `ThemeRenderer`, and all previews use the same `sampleWedding` (RSVP is shown as a disabled
sample form; no RSVP processing exists). Templates differ only in
presentation. Shared behaviour for optional, missing and disabled content:

| Content | Behaviour (all templates) |
|---|---|
| Optional text (headline, introduction, descriptions, thank-you) missing | Element omitted |
| Optional image missing | Image frame omitted (no empty placeholder) |
| Image fails to load or has an unsafe `src` | `ThemeImage` shows a neutral placeholder with the alt text |
| Story with no entries / gallery with no images | Whole section omitted (`useWeddingView`) |
| `rsvp.enabled = false` | Section shows "RSVP is not being collected online", no form |
| RSVP deadline passed | "RSVP has closed", no form |
| Event without `endTime` / `mapsUrl` | "From HH:mm" / Google Maps search link from venue + address |
| Wedding date in the past | Countdown hidden |

These are enforced by `themes.spec.ts`, which renders every template with the full, minimal and
edge-case content.

## Rules for themes

1. **Consume only `WeddingContent`.** A theme never adds fields or its own schema.
   If a design needs new data, change the shared model (and every theme still works).
2. **Every optional field may be missing.** Use `v-if`; never print `undefined`.
   `useWeddingView()` returns `story`/`gallery` as `undefined` when they are empty.
3. **Scope all CSS under the theme root class** (e.g. `.t-intl`), and reset headings with
   `:where(.t-xxx) :where(h1, h2, h3)` so the theme's own classes always win.
4. **Use container queries, not media queries:** `@container site (min-width: 48rem) { … }`
   and `cqi` units for fluid type. This makes the dashboard's phone/tablet preview frames
   show the real responsive layout. Design mobile-first at 375px.
5. **Use `var(--site-vh)`** (not `100vh`) for full-screen sections.
6. **Use the shared behaviour components** and style their neutral classes:
   - `ThemeImage` — lazy loading, focal-point crop, safe `src`, placeholder on error
   - `CountdownTimer` — `.countdown`, `.countdown__unit`, `__value`, `__label`
   - `RsvpPreview` — `.rsvp`, `.rsvp-status`, `.rsvp-fieldset`, `.rsvp-input`, `.rsvp-button`…
   - `v-reveal` — scroll-in animation (respects reduced motion)
7. **Only original or properly licensed assets.** Ornaments are inline SVG/CSS in the theme folder.
   Keep culturally specific decoration modular (see `ethnic/motifs/`).
8. **Links from content go through `mapsLink()`** (blocks `javascript:` URLs); text is
   rendered with Vue interpolation only — never `v-html` with customer content.

## Adding a family or collection

Data only — no code changes:
- Family: add an entry to `catalog/families.ts` (start with `status: 'coming_soon'`).
- Collection: add an entry to `catalog/collections.ts` with its `reference`. For a cultural collection,
  write `notes` that name the sub-traditions to distinguish, and keep `review: 'needs_review'` until
  reviewed with people from or knowledgeable about the tradition.
- Planned template: add an entry to `catalog/planned.ts` (no renderer, `status: 'coming_soon'`).

## Adding a new template

New templates go in `features/themes/templates/<family>/<collection>/<template-id>/`. (The five
Workstream 2 templates keep their original folders, e.g. `traditional/` holds the Royal Maroon renderer.)

1. Create the template folder:
   ```
   <id>/
   ├── index.ts            # RenderableTemplate (id, familyId, collectionId, name, status, tagline, description, previewImage, fonts, component, config?)
   ├── <Name>Theme.vue     # root component: defineProps<ThemeProps>() + useWeddingView(props)
   ├── components/         # theme-only pieces (ornaments, sections) — optional
   ├── assets/thumbnail.svg
   └── styles/theme.css    # all selectors under .t-<id>
   ```
   To reuse an existing renderer with different styling, point `component` at it and pass `config`.
2. Add it to `RENDERABLE_TEMPLATES` in `core/registry.ts` (remove its entry from `catalog/planned.ts`
   if it was planned). Make sure its collection and family are `available`.
3. Add its id to `THEME_IDS` in `frontend/e2e/themes.spec.ts`.
4. Run `npm test` (renders the theme with full, minimal and edge-case content) and
   `npm run test:e2e` (no horizontal overflow at 375/768/1280 px, all images load).
   Review the screenshots in `test-results/screens/`.

Nothing else changes: the renderer, picker pages and content model pick it up automatically.

## Regional variants

- **Ethnic:** add a motif set in `ethnic/motifs/<region>/` (patterns + palette as CSS variables)
  and register it in `ethnic/motifs/index.ts`. Document its origin and have it reviewed
  by someone familiar with the tradition before release.
- **Traditional:** swap the ornament components (`TradCorner`, `TradDivider`) and palette variables.
- Choosing a variant per wedding is a later (CMS) concern; the content model is unaffected.
