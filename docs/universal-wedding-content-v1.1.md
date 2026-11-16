# Universal Wedding Invitation Content System v1.1 — implementation report

## Scope and audit

Audited 49 registered templates: eight concrete renderers and 41 visual variants. The registry has no planned entries. All registered renderers receive the same additive model; their existing artwork, typography, native sections, ornaments and variant CSS remain in place. Native blocks were reordered rather than replaced.

Base renderers: international, traditional, royal-maroon-v2, ethnic, conventional, artistic, minimalist (Still Form), rustic (Wildwood Gathering).

Registered template IDs:

`afterglow`, `afterimage`, `artistic`, `atelier`, `black-tie`, `bluebell-manor`, `candlelit-hall`, `chromatic-vows`, `city-journal`, `coastal-issue`, `coastal-pine`, `color-study`, `conventional`, `cut-paper`, `ethnic`, `gallery-no-08`, `garden-at-dusk`, `gathered-branch`, `gilded-vow`, `golden-hour-garden`, `international`, `ivory-processional`, `lily-and-lace`, `loomed-lines`, `meadowlight`, `modern-heirloom`, `monogram`, `negative-space`, `olive-grove`, `orchard-table`, `outline`, `paper-light`, `pearl-keepsake`, `peony-season`, `pressed-filigree`, `quiet-contrast`, `rosewater`, `royal-maroon-v2`, `soft-grid`, `still-form`, `sunday-collage`, `terracotta-geometry`, `the-conservatory`, `the-exhibition`, `the-monograph`, `the-sunday-edit`, `traditional`, `wildflower-press`, `wildwood-gathering`

## Rendering and data contract

`frontend/src/features/wedding/types.ts` exports the fixed 13-section order and mandatory section IDs. Content remains `schemaVersion: 1` for compatibility; additive fields use `contentVersion: "1.1"`.

1. Opening/Hero — mandatory
2. Holy Recite 1 — optional, immediately after Hero
3. Greeting & Introduction — optional
4. Couple Profile — mandatory
5. Wedding Date & Countdown — mandatory date, optional countdown
6. Event Details — mandatory
7. Our Story — optional
8. Gallery — optional
9. RSVP — optional
10. Wishes & Prayers — optional
11. Amplop Digital — optional
12. Holy Recite 2 — optional, immediately before Closing
13. Closing — mandatory

New optional content defaults off when absent. Legacy introduction, populated story/gallery and countdown retain their prior behavior. An explicit section enabled flag controls its complete wrapper; disabled content is retained. Date text remains when countdown is disabled or expired.

Both scripture fields independently accept passage, reference, originalScript and translation. Rendering escapes markup, preserves line breaks and uses automatic text direction without choosing a religion. Gifts accept multiple string account numbers, independent bank/QRIS/physical-gift toggles, an uncropped QRIS image, and optional physical delivery details. Missing/broken QRIS images show an unavailable message and recover on preview URL changes.

Draft normalization and preview conversion preserve the additive fields, including disabled values. Future editor controls can update the canonical reactive content model. Existing individual section endpoints remain unchanged; new content persists through the full authenticated PUT /content endpoint.

Backend migration `20261115_0004_universal_content.py` adds a JSONB column with an empty-object default without rewriting existing sections. Legacy full-content saves retain unknown v1.1 extensions and existing story/gallery enabled flags. Supplied extension fields merge recursively; explicit null resets a section, explicit arrays replace a list. Row locking refreshes persisted JSON before merging.

## Actual participation

Seven specialist agents participated, plus the parent implementation/verification coordinator:

- UX Architect: product/UX and information architecture source review.
- UI Designer: native theme preservation and screenshot review.
- Frontend Developer: Vue model, adapters and all eight renderers.
- Backend Architect: schema, migration, persistence and backend tests.
- Application Security Engineer: targeted source security review.
- Accessibility Auditor: static accessibility and initial cross-discipline audit.
- Test Results Analyzer: independent test coverage review.

These are actual agents, with some reviewing multiple disciplines. No separate second information-architecture agent was used. No human design/cultural review or accessibility certification is claimed.

## Verification

- Working-directory frontend full suite: 966 tests across 41 files passed. Targeted universal suite rerun after adding independent nested gift-toggle assertions.
- Production build and TypeScript checking passed.
- Browser tests: three tests passed; two iterate all 49 templates at 375px and 1280px (98 template/width combinations). Exact order, hidden wrappers, reactive updates, page overflow, long gift text, native Royal ornament size and QRIS aspect ratio/containment/center obstruction are checked. No page exceptions observed.
- Screenshots: complete mobile captures for all eight base renderers; scripture/gift detail captures for International, Royal Maroon v2, Artistic and Rustic at mobile/desktop widths. Images are explicitly loaded before full-page captures.
- Backend: isolated PostgreSQL test database and Python 3.12 container; migration and persistence/access tests. 228 tests passed, including toggle-only/nested retention, explicit resets and stale concurrent-writer state refresh.

## Limitations

No full CMS, guest management, payment processing, file uploader, public invitation endpoint or publishing snapshot pipeline was added. QRIS supports hosted uploaded image URLs through ImageAsset; uploading a local file is not implemented. Tests use a synthetic QRIS-shaped image to verify display geometry, not QRIS decoding or financial validity.

The existing backend exposes owner-authenticated drafts/previews only. Tests verify unauthenticated access is rejected and edits do not create a published invitation; they cannot establish draft-versus-published-snapshot isolation because no snapshot/publishing pipeline exists. The additive migration was applied to the running local application database during working-directory integration (0003 to 0004).

Accessibility review was static. No real screen reader, contrast measurements, keyboard/zoom audit, WCAG certification, penetration test, production deployment or performance benchmark is claimed. Chromium browser checks cover two widths, not every device/browser.

The referenced ChatGPT thread was read, but its cached assistant answers contained opaque content references. The explicit requirements in the current request were used as the implementation specification.

## Working-directory integration

Merged into `/Users/richomahardika/Mine/Sandbox/kuren`, retaining its newer live editor and optimistic save revisions. Universal content migration is revision 0004 after the existing revision 0003. Every normal template preview, picker pane and thumbnail displays all 13 sections by default with illustrative data; no query parameter is required and saved invitation content is never modified.

Working-directory verification: production build passed; all 966 frontend tests and 228 backend tests passed, including existing live-editor and revision-conflict coverage. Three browser tests passed against port 5173, including all 49 templates at two widths and the real showcase URL. The showcase browser test asserts all 13 sections and zero data-changing requests. `git diff --check` passed.

Showcase URL: http://localhost:5173/themes/traditional/ceremonial-classic/royal-maroon-v2/preview (sign in if prompted). Stored invitations retain their own enabled states; example content is never saved. Existing editor forms for newly added v1.1 sections are still future CMS work.

Default template previews now always show the full v1.1 sample, including a clearly labelled non-payment QRIS image placeholder. Saved invitations still use their own enabled states.
