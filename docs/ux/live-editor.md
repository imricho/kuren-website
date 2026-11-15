# Live Split-Screen Editor — UX/Layout Spec

## 1. Desktop (≥1024px) grid

- Editor routes get `meta.layout: 'studio'`, so AppLayout gives them the full remaining height.
- Root: `grid h-full grid-cols-[var(--editor-w)_0.5rem_minmax(0,1fr)]`, `--editor-w: 40%`.
- **Editor panel** (`#editor-panel`): `flex flex-col min-w-0 border-r border-line bg-canvas`.
  - Header `shrink-0 border-b border-line bg-surface px-4`:
    - Row 1 `h-12 flex items-center`: `<SaveStatus>` (`mr-auto`) + "6 of 9 done" / "6 dari 9 selesai" (`text-xs text-ink-500`).
    - Row 2: **section chip row**, the existing <lg chip scroller used at every width (`overflow-x-auto py-2`, chips `h-9 px-3 text-sm`). The Unsaved badge becomes an amber dot with sr-only text.
  - Drop the 16rem column, the CompletionMeter card and the "Preview website →" chip.
  - Form body: `flex-1 overflow-y-auto px-6 py-6`, content `max-w-xl`. Section h1 becomes `text-2xl`.
- **Preview panel**: `flex flex-col min-w-0 bg-rose-50/40`; toolbar on top, stage `flex-1 overflow-auto`.

## 2. Preview toolbar

`h-12 flex items-center gap-2 border-b border-line bg-surface px-3`, left to right:

1. Device `role="radiogroup"`: **Phone / Desktop** · **Ponsel / Desktop** (default Phone). Items `h-8 px-3 text-sm` in a `rounded-full border border-line p-0.5` group.
2. Zoom: **Fit / 100%** · **Pas / 100%** (default Fit), same style.
3. `ml-auto` theme name (`truncate max-w-48 text-sm`) + "Change" / "Ganti" link (to `/themes`).
4. **Full screen** / **Layar penuh**: `h-9` ghost button with icon. Label is sr-only below 1280px. Opens `/wedding/preview?from=<current>`.

## 3. Frame & scaling

- The frame is laid out at true width W (390 / 1280).
- Fit: `s = min(1, (stageW−48)/W)`. Outer box `W·s × (stageH−48)`; inner box `W × (stageH−48)/s` with `scale(s)` and `origin-top-left`, centred.
- 100%: `s = 1`, and the stage scrolls horizontally.
- The inner frame is the vertical scroller.
- Section change → scroll the frame to `[data-section=key]` (smooth). If that section is missing, do nothing.

## 4. Divider

- Hit area `w-2 cursor-col-resize`; a 1px `bg-line` that becomes 2px `bg-rose-500` on hover and focus.
- `role="separator" aria-orientation="vertical" aria-controls="editor-panel" aria-valuemin=30 aria-valuemax=55 aria-valuenow=<%> aria-valuetext="Editor 40%"`, label "Resize editor" / "Ubah ukuran editor", `tabindex=0`.
- Clamp to 30–55%, editor ≥360px and preview ≥420px.
- ←/→ ±2%, Shift ±10%, Home/End min/max. Enter or double-click resets to 40%.
- Pointer drag uses `setPointerCapture` and body `select-none`. Rescale on `ResizeObserver`. Persist the width in `localStorage` (try/catch).

## 5. Save status (one component, always visible)

Desktop: editor header row 1. Mobile: right side of the tab bar. Text `text-sm`, actions `h-8`.

| State | EN | ID | Action |
|---|---|---|---|
| Saved | All changes saved | Semua perubahan tersimpan | — |
| Unsaved | Unsaved changes | Ada perubahan belum tersimpan | Save now / Simpan sekarang |
| Saving | Saving… | Menyimpan… | — |
| Failed | Couldn't save | Gagal menyimpan | Retry / Coba lagi |
| Offline | Offline — saves when you reconnect | Offline — disimpan saat online kembali | — |
| Conflict | Edited on another device | Diubah di perangkat lain | Reload latest / Muat versi terbaru · Keep mine / Pakai versi saya |

- Conflict also shows a `role="alert"` amber banner under the header holding both buttons.
- A polite sr-only region announces only Failed, Offline, Conflict, and Saved after a manual save or Retry. Autosave shows no toast.
- **SaveBar is retired.** "Save now" replaces "Save changes"; Ctrl/Cmd+S and Enter also save right away.
- **Discard is removed.** A 1s autosave leaves almost nothing to discard, and native field undo covers typos.
- List add/delete/reorder stay explicit.
- Leave and sign-out guards apply only while Unsaved, Saving or Failed.

## 6. Preview states

- **Loading**: frame-sized `animate-pulse bg-rose-50` with `role="status"` "Loading preview…" / "Memuat pratinjau…".
- **No theme**: render the default theme with an amber note under the toolbar: "No theme chosen yet — showing {name}." / "Belum memilih tema — menampilkan {name}." + "Choose a theme" / "Pilih tema".
- **Missing content**: the existing labelled placeholders.
- **Render error** (error boundary): card "Preview couldn't load" / "Pratinjau gagal dimuat" + "Try again" / "Coba lagi". The editor keeps working.

## 7. Mobile (<1024px)

- Tab bar **sticky at the top**, under the app header: `sticky top-14 z-[9] h-12 flex items-center border-b border-line bg-surface/95 px-4`. Top, because the on-screen keyboard hides bottom bars.
- `role="tablist"`: **Edit / Preview** · **Edit / Pratinjau** (`h-11 px-4`, selected `border-b-2 border-rose-600`), then `<SaveStatus>` at `ml-auto`, so it is visible on both tabs.
- Panels use `v-show` (both stay mounted). Restore each panel's scroll position when switching.
- Preview tab: Fit/100% plus an icon-only Full screen button (`size-11`). Always phone width, no device toggle. Frame `h-[calc(100dvh-7rem)]`.
- Choosing a section pre-scrolls the hidden preview.

## 8. Focus & keyboard

- Tabs: ←/→ move and activate, Home/End jump, focus stays on the tab. Panels are `role="tabpanel"` with `aria-labelledby`.
- Choosing a section never focuses the preview; focus goes to the section h1 (`tabindex=-1`), as today.
- Frame: `role="region"`, `tabindex=0`, label "Live preview, {device} size — scrollable" / "Pratinjau langsung, ukuran {device} — dapat digulir". The theme content inside is `inert`, so Tab skips the invitation's links and RSVP fields. Headings start at h2.

## 9. Reduced motion

Use `behavior: auto` for all scrolling. No width, scale or divider transitions. A static Saving icon. `motion-reduce:animate-none` on skeletons.

## 10. 320px

- `px-4` gutters; tabs `px-3`.
- SaveStatus shrinks to icon + short word (Saved/Tersimpan, Unsaved/Belum disimpan, Saving…/Menyimpan…, Failed/Gagal, Offline, Conflict/Konflik). Full text stays sr-only and the action button stays visible (`h-9`).
- Fit gives s ≈ 0.74. Horizontal scroll only inside the stage, never on the page.
- The conflict banner stacks its buttons full-width.
