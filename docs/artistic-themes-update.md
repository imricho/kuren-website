# Artistic themes and selection update — 15 November 2026

Implemented Royal Heritage filigree/crest, balanced Botanical Romance arrangements, and restrained ornament-free Modern Minimalist. Original SVG artwork provenance is documented in frontend/src/features/themes/assets-ORNAMENTS.md. Shared wedding content, internal theme IDs and routes remain compatible.

English and Bahasa use Heritage and the exact hierarchy Category → Collection → Template. Sidebar template clicks only update the right-hand preview and never save or open Edit. The explicit Select template action in the preview controls saves the wedding theme before opening its existing /wedding editor. Category and collection clicks only browse; drafts remain preview-only. Selection includes request locking, account-change protection, navigation cancellation/race handling, inline errors and retry. Back returns to the specific template preview without selecting again.

A pending accessibility focus request is now cancelled on layout unmount or subsequent navigation. Sidebar hierarchy layout was adjusted so all three labels fit.

## Validation

- Full unit suite: 34 files, 781 tests passed.
- Production build and TypeScript checks passed.
- Following explicit user approval, seven distinct real-backend browser checks passed on localhost:5173: server-side theme persistence; preserved draft and Back behavior; saved-content preview; phone CMS layout; Heritage selection/preview flow; mobile template selection; Modern Minimalist and Rustic choices. The targeted run also passed one isolated mocked check. One stale Back-link label expectation was corrected and its test passed on rerun. Disposable accounts and wedding records were created as approved. The entire legacy browser suite was not run.
- Isolated Playwright suite: 10 passed (three themes at 375, 768 and 1280px; decorative accessibility semantics; save then editor; Back).
- Isolated tests intercept every /api/v1 request; no backend accounts or records are created. Run a dev server on port 5174 then `npm run test:e2e:isolated`. Set E2E_BASE_URL for another port.
- Independent QA reviewed keyboard focus, accessibility tree, SVG semantics, reduced-motion behavior, selection races and hierarchy overflow.

## Limitations

Original reference images were unavailable in the linked chat. Art direction follows the current request. No VoiceOver, axe/Lighthouse, forced-color, physical-device or formal WCAG audit was performed. Real backend persistence was subsequently verified by the approved targeted browser checks. An earlier specialist attempt created disposable test accounts but cross-origin protection rejected its selection writes. Automatic review initially rejected the parent request; the user then explicitly approved disposable records, allowing the targeted backend tests to complete. No database migration, deployment, deletion, commit or push was performed. Existing unsaved editor buffers were not touched.

## Files changed

- `frontend/src/composables/useRouteA11y.spec.ts`
- `frontend/src/composables/useRouteA11y.ts`
- `frontend/src/composables/useAppLocale.ts`
- `frontend/src/composables/useAppLocale.spec.ts`
- `frontend/src/features/themes/assets-ORNAMENTS.md`
- `frontend/src/features/themes/ornamentDensity.spec.ts`
- `frontend/src/features/themes/picker/PickerSteps.vue`
- `frontend/src/features/themes/picker/SelectTemplateButton.spec.ts`
- `frontend/src/features/themes/picker/SelectTemplateButton.vue`
- `frontend/src/features/themes/picker/ThemeSidebar.vue`
- `frontend/src/features/themes/catalog/families.ts`
- `frontend/src/features/themes/conventional/ConventionalTheme.vue`
- `frontend/src/features/themes/conventional/styles/theme.css`
- `frontend/src/features/themes/conventional/components/ConvBouquet.vue`
- `frontend/src/features/themes/traditional/TraditionalTheme.vue`
- `frontend/src/features/themes/traditional/styles/theme.css`
- `frontend/src/features/themes/traditional/components/TradCorner.vue`
- `frontend/src/features/themes/traditional/components/TradCrest.vue`
- `frontend/src/features/themes/minimalist/MinimalistTheme.vue`
- `frontend/src/features/themes/minimalist/styles/theme.css`
- `frontend/src/stores/themeSelection.spec.ts`
- `frontend/src/stores/themeSelection.ts`
- `frontend/e2e/themes.spec.ts`
- `frontend/e2e/cms.spec.ts`
- `frontend/e2e/isolated/themes.spec.ts`
- `frontend/package.json`
- `frontend/playwright.isolated.config.ts`

## Clarified preview flow

Following the user clarification, available sidebar cards were restored to preview links, matching draft preview behavior. Saving and redirecting are reserved for the explicit Select template control in the preview header (including the equivalent fullscreen preview control). The regression checks assert no PATCH on sidebar browsing, preview heading changes, one PATCH on explicit selection, editor navigation, and Back to the template preview. Validation after this correction: 20 focused unit tests, six targeted browser tests (five real-backend and one mocked), production build, and diff checks passed. Files changed in this correction: ThemeSidebar.vue, e2e/themes.spec.ts, e2e/cms.spec.ts, e2e/isolated/themes.spec.ts and this report.
