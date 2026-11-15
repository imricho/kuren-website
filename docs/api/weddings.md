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
  story:   { title?; introduction?; timeline: StoryEntry[] }       // timeline always present
  events:  EventItem[]                                             // always present
  gallery: { title?; description?; images: GalleryItem[] }        // images always present
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
