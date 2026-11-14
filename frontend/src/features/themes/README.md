# Theme system

**One shared wedding content model, many independent theme presentations.**

```
WeddingContent (features/wedding/types.ts)
        │
        ▼
Theme registry (core/registry.ts)  ──  id → ThemeDefinition
        │
        ▼
<ThemeRenderer :content :theme-id>  ──  lazy-loads the theme, loads its fonts,
        │                               falls back to the default on unknown ids
        ▼
<XxxTheme :content>  ──  the couple's website
```

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

## Adding a new theme

1. Create `features/themes/<id>/`:
   ```
   <id>/
   ├── index.ts            # ThemeDefinition (id, name, category, tagline, description, previewImage, fonts, component)
   ├── <Name>Theme.vue     # root component: defineProps<ThemeProps>() + useWeddingView(props)
   ├── components/         # theme-only pieces (ornaments, sections) — optional
   ├── assets/thumbnail.svg
   └── styles/theme.css    # all selectors under .t-<id>
   ```
2. Add it to `THEMES` in `core/registry.ts`. If it's a new category, add it to
   `THEME_CATEGORIES` in `core/types.ts`.
3. Add its id to `THEME_IDS` in `frontend/e2e/themes.spec.ts`.
4. Run `npm test` (renders the theme with full, minimal and edge-case content) and
   `npm run test:e2e` (no horizontal overflow at 375/768/1280 px, all images load).
   Review the screenshots in `test-results/screens/`.

Nothing else changes: the renderer, preview page and content model pick it up automatically.

## Regional variants

- **Ethnic:** add a motif set in `ethnic/motifs/<region>/` (patterns + palette as CSS variables)
  and register it in `ethnic/motifs/index.ts`. Document its origin and have it reviewed
  by someone familiar with the tradition before release.
- **Traditional:** swap the ornament components (`TradCorner`, `TradDivider`) and palette variables.
- Choosing a variant per wedding is a later (CMS) concern; the content model is unaffected.
