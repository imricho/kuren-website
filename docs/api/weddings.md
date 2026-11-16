# Wedding CMS API contract (Workstream 3)

Source of truth for the `/api/v1/weddings` API. Backend (`backend/app/...`) and frontend
(`frontend/src/api/weddings.ts`) both implement exactly this.

## Conventions

- All routes require a logged-in session (cookie `wp_session`) → **401 `not_authenticated`** otherwise.
- State-changing requests pass the existing `Origin` CSRF check (403 on a foreign Origin).
- **All JSON on this API is camelCase** (request and response), matching `frontend/src/features/wedding/types.ts`.
- Errors use the existing shape `{"error": {"code", "message", "details?"}}`.
  - 422 `validation_error`: `details = [{ "field": "<camelCase dotted path>", "message": "..." }]`,
    e.g. `groom.name`, `startTime`, `images.0.alt`. (No `body.` prefix.)
  - 404 `not_found`: wedding/item missing **or owned by another user** (never 403, to avoid revealing ids).
  - 409 `wedding_exists`: POST /weddings when the user already has one.
  - 409 `limit_reached`: adding beyond a collection limit.
  - 409 `edit_conflict`: a content write whose `If-Match` is not the current revision;
    `details = { "currentRevision": number }`. Nothing is written.
  - 400 `bad_request`: malformed `If-Match`.
- **Optimistic concurrency (autosave).** Every content write (sections, collection create/update/
  delete/reorder, PUT /content) increments the wedding's content `revision`. Every content GET and
  write response carries it as `ETag: "<revision>"`. Clients send the revision they last saw as
  `If-Match: "<revision>"` (weak `W/"n"` and bare `n` accepted; absent or `*` = unconditional).
  The check runs under the wedding row lock, after the ownership check (foreign ids stay 404).
  Theme/locale changes (PATCH /weddings/{id}) do **not** change the content revision.
- Strings are trimmed; an empty string means "not set" (stored as null, omitted from responses).
- Drafts may be incomplete: required-for-publishing fields may be missing. Values that ARE sent must be valid.
- Dates `YYYY-MM-DD`; times `HH:mm` (24h); venue-local, no timezone.
- Response objects **omit** keys whose value is not set (except the always-present keys listed below).

## Shared value types

```ts
type Locale = 'en' | 'id'
type EventType = 'engagement' | 'akad' | 'holy_matrimony' | 'ceremony' | 'reception' | 'other'
interface ImageAsset { src: string; alt: string; focalPoint?: { x: number; y: number } } // x,y ints 0..100
```

Image `src`: absolute `http(s)://` URL (≤2048) **or** a bundled sample asset path matching
`^/sample-wedding/[A-Za-z0-9_.-]+$` (whole string, no trailing newline) without `..`; other same-origin paths are rejected. `javascript:`, `data:` and `//host` are rejected. `alt` is required (1..300) whenever an image is set.

## Wedding record

```ts
interface WeddingRead {
  id: string              // uuid
  themeId: string | null  // canonical template id; null = not chosen
  locale: Locale          // language guests see
  status: 'draft'         // 'published' reserved for a later workstream
  publishedAt: null
  revision: number        // content revision (see Optimistic concurrency); 0 for a new wedding
  createdAt: string; updatedAt: string // ISO datetimes
}
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/weddings/me` | – | 200 `WeddingRead`; 404 if the user has none |
| POST | `/weddings` | `{ themeId?: string \| null, locale?: Locale }` | 201 `WeddingRead`; 409 `wedding_exists` |
| PATCH | `/weddings/{weddingId}` | `{ themeId?: string \| null, locale?: Locale }` | 200 `WeddingRead` |

`themeId` must be in `backend/app/core/selectable_theme_ids.json` (generated from the frontend registry:
only `available` templates; drafts/planned are rejected) → otherwise 422 with field `themeId`.
MVP: one wedding per user (unique owner).

## Content (assembled draft)

```ts
interface PersonDraft { name?: string; nickname?: string; image?: ImageAsset; description?: string; parents?: string /* ≤200 */; instagramUrl?: string }
interface StoryEntry  { id: string; title?: string; date?: string; description?: string; image?: ImageAsset }
interface EventItem   { id: string; type: EventType; title?: string; date?: string; startTime?: string; endTime?: string;
                        venueName?: string; address?: string; mapsUrl?: string; description?: string }
interface GalleryItem { id: string; src: string; alt: string; caption?: string; focalPoint?: { x: number; y: number } }

interface WeddingDraft {
  schemaVersion: 1
  locale: Locale
  opening: { weddingTitle?; coupleNames?; headline?; introduction?; coverImage?: ImageAsset; weddingDate? }
  couple:  { groom: PersonDraft; bride: PersonDraft }            // always present (may be {})
  story:   { title?; introduction?; enabled: boolean; timeline: StoryEntry[] } // timeline always present; enabled default true ("Show on website")
  events:  EventItem[]                                             // always present
  gallery: { title?; description?; enabled: boolean; images: GalleryItem[] } // images always present; enabled default true
  rsvp:    { title?; introduction?; enabled: boolean; deadline?; confirmationMessage?; maxGuestsPerResponse? } // enabled default true
  closing: { message?; thankYou?; image?: ImageAsset }
}
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/weddings/{id}/content` | – | 200 `WeddingDraft` |
| PUT | `/weddings/{id}/content` | `WeddingDraft` (without `schemaVersion`/`locale` required) | 200 `WeddingDraft` — replaces everything in one transaction; collection items matched by `id` (existing → updated, unknown valid id `^[A-Za-z0-9_-]{1,64}$` → created with that id, missing → deleted), order = array order |
| GET | `/weddings/{id}/sections/{section}` | – | 200 section object |
| PUT | `/weddings/{id}/sections/{section}` | section object (full replace) | 200 section object |
| GET | `/weddings/{id}/preview` | – | 200 `{ themeId: string \| null, content: WeddingDraft }` |

`section` ∈ `opening | couple | story | gallery | rsvp | closing`. For `story` and `gallery` the section object is the
**meta only** (`{title?, introduction?}` / `{title?, description?}`); items use the collection routes. Unknown section → 404.

## Collections

Same five routes for each: `stories` (StoryEntry), `events` (EventItem), `gallery` (GalleryItem).

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/weddings/{id}/{collection}` | – | 200 `Item[]` in display order |
| POST | `/weddings/{id}/{collection}` | item without `id` | 201 `Item` (server id, appended last); 409 `limit_reached` |
| PUT | `/weddings/{id}/{collection}/order` | `{ ids: string[] }` (exact permutation) | 200 `Item[]`; 422 otherwise |
| PUT | `/weddings/{id}/{collection}/{itemId}` | full item without `id` | 200 `Item` |
| DELETE | `/weddings/{id}/{collection}/{itemId}` | – | 204 |

Limits: stories 20, events 20, gallery 60. Event `type` defaults to `other` when omitted.

## Validation rules

| Field | Rule |
|---|---|
| weddingTitle, coupleNames, names, story/event titles, rsvp.title | ≤120 |
| nickname | ≤40 |
| headline, caption, thankYou | ≤200 |
| introduction, description, closing.message | ≤2000 |
| story `date` (free-text label, e.g. "March 2018") | ≤60 |
| venueName ≤160 · address ≤500 · confirmationMessage ≤500 | |
| weddingDate, event date, rsvp.deadline | ISO date |
| startTime, endTime | `HH:mm`; if both set, `endTime > startTime` (field `endTime`) |
| mapsUrl | http(s) URL ≤2048 |
| instagramUrl | https URL on `instagram.com` / `www.instagram.com` ≤2048 |
| maxGuestsPerResponse | integer 1..20 |
| unknown keys | rejected (422) |

## CMS v2.0 additions (contentVersion "1.2")

### Universal section endpoints
`GET|PUT /weddings/{id}/sections/{holyRecite1|holyRecite2|greeting|countdown|wishes|amplopDigital}`
— stored in `weddings.universal_content`. **PUT replaces the whole section** (a field left out is
cleared), unlike `PUT /content`, which merges universal sections for legacy clients. Same If-Match /
ETag / 409 `edit_conflict` rules as every content write. Unknown section → 404.

```ts
interface HolyRecite { enabled: boolean; title?; tradition?; book?; reference?; passage?; originalScript?; translation?; translationLanguage?; attribution? }
interface Greeting   { enabled: boolean; title?; message?; prayer? }
interface Countdown  { enabled: boolean; addToCalendar?: boolean }      // date is opening.weddingDate
interface Wishes     { enabled: boolean; title?; introduction? }
interface AmplopDigital {
  enabled: boolean; title?; message?
  bankAccountsEnabled: boolean
  bankAccounts: { id: string; bankName: string; accountHolder: string; accountNumber: string }[] // ≤20; id assigned if missing, unique, [A-Za-z0-9_-]{1,64}
  qrisEnabled: boolean; qrisImage?: ImageAsset
  physicalGifts?: { enabled: boolean; recipient?; address?; note?; phone? }
}
```
- `accountNumber`: **string**, digits with single spaces/hyphens (`[0-9]+([ -][0-9]+)*`, ≤40); leading zeros kept;
  numbers, letters and invisible bidi/control characters → 422. `phone`: optional `+`, digits, single spaces/hyphens.
- Sacred text fields are stored exactly as sent (trimmed only at the ends; line breaks kept).

Other new fields: `opening.guestGreeting?: { enabled; label? }` (e.g. "Kepada Yth."; public page appends the
`?to=` name), `closing.familyAcknowledgments?: string`, event `dressCode?: { enabled; text? }` and
`livestream?: { enabled; url? (https only); label? }` (migration 0005, `wedding_events.extras` JSONB).

### Publishing (migration 0006)
- `WeddingRead` adds `slug: string | null`, `hasUnpublishedChanges: boolean`, and
  `publication: { publishedAt: string; revision: number; themeId: string } | null`. `status` becomes `'published'`
  while a publication is live and `publishedAt` mirrors `publication.publishedAt` (both reset on unpublish).
- `POST /weddings/{id}/publish` (If-Match semantics as other writes: optional; a stale revision → 409 `edit_conflict`)
  → 200 `WeddingRead` + `ETag: "<revision>"`. Publishing does **not** change the content revision.
  Validates server-side; on failure **422 `publish_blocked`**, `details = [{ section, field, code, message }]`,
  in this order:

  | section | field | code | when |
  |---|---|---|---|
  | `theme` | `themeId` | `required` / `invalid` | no theme / theme no longer selectable |
  | `opening` | `opening.weddingDate` | `required` | |
  | `couple` | `couple.groom.name`, `couple.bride.name` | `required` | |
  | `events` | `events` | `required` | no events |
  | `events` | `events.<i>.title\|date\|startTime\|venueName\|address` | `required` | per event (index in display order) |
  | `events` | `events.<i>.livestream.url` | `required` | livestream enabled without url |
  | `closing` | `closing.message` | `required` | |
  | `story` | `story.timeline` | `incomplete` | shown, but no entry with title **and** description |
  | `gallery` | `gallery.images` | `incomplete` | shown, but no images |
  | `holyRecite1\|2` | `holyRecite1.passage` | `incomplete` | enabled without passage/originalScript/translation |
  | `greeting` | `greeting.message` | `incomplete` | enabled without title or message |
  | `amplopDigital` | `amplopDigital` | `incomplete` | enabled but no gift method switched on |
  | `amplopDigital` | `amplopDigital.bankAccounts` | `incomplete` | bank transfers on, no accounts |
  | `amplopDigital` | `amplopDigital.qrisImage` | `required` / `invalid` | QRIS on: no image / not a `/media/…` upload of this wedding |
  | `amplopDigital` | `amplopDigital.physicalGifts.recipient\|address` | `required` | gift delivery on |

  `wishes`, `countdown`, `rsvp` and disabled sections never block. Warnings are frontend-only.
- **Snapshot** = allow-listed copy in draft shape, built field by field (unknown keys are never copied):
  disabled `story`/`gallery`/`rsvp` and disabled universal sections are **absent**; empty strings are dropped;
  `opening.guestGreeting` only when enabled; event `dressCode` only when enabled with text, `livestream` only when
  enabled with url; `countdown.addToCalendar` only when true; `amplopDigital` always carries
  `bankAccountsEnabled`/`qrisEnabled` booleans and `bankAccounts` (`[]` unless bank transfers are on — account
  numbers are never published while disabled), `qrisImage` only when QRIS is on, `physicalGifts` only when enabled.
  Collection/bank-account ids are kept as render keys; no wedding/owner/db ids. `couple.groom|bride`, `opening`,
  `closing`, `events` are always present. Inserts a `wedding_publications` row and points the wedding at it in one
  transaction; a failed publish leaves the live publication unchanged. First publish assigns a slug:
  `{groom nickname or first name}-{bride nickname or first name}-{6 random [a-z0-9]}`, ASCII-folded and lowercased
  (fallback `undangan-xxxxxx` when either part is empty); it never changes afterwards (also not after unpublish).
- `POST /weddings/{id}/unpublish` (same If-Match rules) → 200 `WeddingRead` (status draft, `publication`/`publishedAt`
  null, slug kept; public URL 404s; publication rows kept as history). Idempotent.
- `hasUnpublishedChanges` = published and (`revision` ≠ publication.revision or `themeId` ≠ publication.themeId).
- **Public:** `GET /public/weddings/{slug}` — no auth/cookies, separate router →
  `{ themeId, locale, content, publishedAt }` where `content` is the snapshot (draft shape; the frontend renders it with
  `toPreviewContent(content, locale, today, { mode: 'public' })`, which never inserts placeholders).
  Unknown, malformed and unpublished slugs all return the same `404 {"error":{"code":"not_found","message":"Not found."}}`.
  Headers: `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-cache` (revalidated by ETag, so a republish or unpublish shows at once),
  `ETag: "<publication id>"` (`If-None-Match` match → 304, empty body), `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`. Rate limited to 120 requests/min per client IP → 429 `too_many_requests`
  (in-memory, **per process**: limits multiply with workers and reset on restart; keyed by the socket peer, so behind a
  proxy run uvicorn with trusted `--proxy-headers`).
- New weddings start with `countdown = { enabled: true, addToCalendar: true }` (existing weddings unchanged).

### Image uploads (migration 0007)
- `POST /weddings/{id}/assets` (multipart: `file`, `kind: 'image' | 'qris'`; owner only, **no** If-Match, does not
  change the content revision) → 201 `{ id, src: "/media/<uuid>.<ext>", width, height, kind }`.
  - ≤ 5 MB file (this route's body cap is 5 MB + 64 KiB; every other route keeps 1 MiB) → else 413 `payload_too_large`.
  - JPEG/PNG/WebP only, detected by decoding (never by name/MIME); SVG, GIF, BMP, TIFF, HEIC, animated PNG/WebP,
    truncated/corrupt files and images over 40 MP → 422 `unsupported_image`. Bad/missing `kind` or `file` → 422
    `validation_error`. More than 300 assets per wedding → 409 `limit_reached`.
  - Re-encoded from pixels (EXIF/GPS/XMP/comments stripped, EXIF orientation applied first; `width`/`height` are the
    stored, upright size). `image`: long edge ≤ 2560 px, JPEG q85 (`.jpg`), or WebP q85 (`.webp`) when it has
    transparency. `qris`: lossless PNG (`.png`) at its original size, never resampled.
- `DELETE /weddings/{id}/assets/{assetId}` → 204 (owner only; unknown/foreign/malformed id → 404). The record is
  deleted and the file removed at once, unless the **live publication** still shows it (then it keeps being served
  until a later cleanup). Drafts that still reference a deleted image show it broken.
- `GET /media/<uuid>.<ext>` (app root, not under `/api`; no auth) serves only names matching
  `^[0-9a-f-]{36}\.(png|jpg|webp)$`, else 404. Headers: exact `Content-Type` (`image/png|jpeg|webp`),
  `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`,
  `Cache-Control: public, max-age=31536000, immutable`, `Cross-Origin-Resource-Policy: same-site`.
- `ImageAsset.src` also accepts `/media/<lowercase uuid>.(jpg|png|webp)` (any wedding's upload; ownership is only
  enforced for the QRIS image at publish time).
- QRIS images must be uploads (`/media/…`) owned by the same wedding to publish (any `kind`; upload with
  `kind: 'qris'` so it stays lossless).
