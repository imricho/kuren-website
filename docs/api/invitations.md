# Invitation CMS API contract (v2.0)

Source of truth for the `/api/v1/invitations` API (architecture: `docs/architecture/invitation-engine.md`).
Backend: `backend/app/api/v1/routes/{invitations,weddings,public}.py`. The taxonomy (categories,
variants, per-variant sections, presets, template compatibility) lives in
`backend/app/core/invitation_registry.json` and is served by `GET /invitation-types`.

The old `/weddings/...` API keeps working as an alias; see [Legacy aliases](#legacy-aliases).

## Conventions

- All owner routes require a logged-in session (cookie `wp_session`) → **401 `not_authenticated`**.
  `GET /invitation-types` and `/public/...` need no session.
- State-changing requests pass the `Origin` CSRF check (403 `permission_denied` on a foreign Origin),
  including the public RSVP POST.
- **All JSON is camelCase.** Request bodies reject unknown keys (422). Strings are trimmed; an empty
  string means "not set" (stored as null, omitted from responses). Responses omit keys that are not set.
- **No control characters:** any string in any request body (object keys included) containing NUL or
  another C0/C1 control character except `\n` and `\t` → 422 `validation_error` (field = the top-level key).
- Owner responses (every `/api/v1/...` route except `/public/...`, `/invitation-types`, `/health`, errors
  included) carry `Cache-Control: no-store` and `Vary: Cookie`.
- Errors: `{"error": {"code", "message", "details?"}}`.

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | malformed `If-Match` |
| 401 | `not_authenticated` | no/expired session |
| 403 | `permission_denied` | foreign `Origin` on a write |
| 404 | `not_found` | invitation/item/reply missing **or owned by another user** (never 403) |
| 409 | `edit_conflict` | content write with a stale `If-Match`; `details = {currentRevision}` |
| 409 | `limit_reached` | 50 invitations per user, collection limits, 300 uploads, 5000 RSVP replies |
| 409 | `capacity_reached` | RSVP reply would exceed `rsvp.capacity` |
| 413 | `payload_too_large` | body over 1 MiB (uploads 5 MB + 64 KiB, public RSVP 16 KiB) |
| 422 | `validation_error` | `details = [{field, message}]`, camelCase dotted paths (`people.0.role`) |
| 422 | `section_not_available` | the variant does not offer that section; `details = {section}` |
| 422 | `template_incompatible` | theme does not support the category/variant; `details = [{field: "themeId", message}]` |
| 422 | `publish_blocked` | `details = [{section, field, code, message}]` |
| 422 | `rsvp_closed` | RSVP switched off, not offered, or past the deadline |
| 422 | `unsupported_image` | upload is not a JPEG/PNG/WebP still image |
| 429 | `too_many_requests` | public rate limits |

- **Optimistic concurrency.** Every content write (sections, collections, `PUT /content`) bumps the
  invitation's `revision` and returns `ETag: "<revision>"`; content GETs return it too. Send
  `If-Match: "<revision>"` (weak `W/"n"` and bare `n` accepted; absent or `*` = unconditional) →
  409 `edit_conflict` when stale. Checked under the invitation row lock, after the ownership check.
  Record changes (`PATCH`, publish/unpublish) do not change `revision`.
- Dates `YYYY-MM-DD`; times `HH:mm` (24h), venue-local.

## Registry

`GET /invitation-types` → 200, `Cache-Control: public, max-age=300`:

```jsonc
{
  "version": 1,
  "defaultTimezone": "Asia/Jakarta",
  "sectionOrder": ["opening", "holyRecite1", "greeting", "couple", "profiles", "organization", "milestone",
                   "countdown", "events", "agenda", "speakers", "story", "gallery", "rsvp", "wishes",
                   "amplopDigital", "holyRecite2", "closing"],
  "sessionTypes": ["engagement", "akad", "holy_matrimony", "ceremony", "reception", "party", "celebration",
                   "session", "talk", "workshop", "gathering", "prayer", "dinner", "other"],
  "profileRoles": ["celebrant", "child", "graduate", "host", "partner", "organizer"],
  "milestoneFields": ["age", "years", "occasion", "institution", "program", "degree", "partyTheme"],
  "categories": [{ "id": "wedding", "label": { "en": "Wedding", "id": "Pernikahan" }, "variants": ["wedding_ceremony", "wedding_reception"] }, ...],
  "variants": [{
    "id": "seminar", "category": "corporate", "label": { "en": "Seminar", "id": "Seminar" },
    "sections": [{ "id": "opening", "required": true, "defaultEnabled": true },
                 { "id": "organization", "defaultEnabled": true }, ...],
    // birthday: { "id": "profiles", "defaultEnabled": true, "roles": ["celebrant"], "fields": ["nickname", "image", "description", "birthDate"] }
    "sessionPresets": [{ "type": "session", "title": { "en": "Main Session", "id": "Sesi Utama" } }],
    "rsvpDefaults": { "collectContact": "email", "registrationFields": [{ "id": "company", "label": { "en": "Company", "id": "Perusahaan / Instansi" }, "type": "text", "required": false }] }
  }, ...],
  "templates": [{ "id": "temuvibe-festive", "categories": ["celebration", "gathering"] },
                { "id": "afterglow", "categories": ["wedding", "celebration"], "variants": ["wedding_ceremony", "wedding_reception", "engagement", "anniversary"] }, ...]
}
```

- `sections` is ordered (canonical order). Sections not listed are **not offered** for the variant:
  writes are refused (422 `section_not_available`), they are never checked or published.
- `required` sections are always shown (no visibility toggle). Exception: `countdown.enabled` only
  toggles the countdown timer; the date itself (`opening.weddingDate`) is required for every variant.
- `roles` (profiles only) is enforced on write. `fields` is an editor hint; for `milestone` it also
  limits which milestone fields are published (`title` and `description` always are).
- `templates` lists every selectable theme id. `variants` omitted = all variants of `categories`.

## Invitation record

```ts
type CategoryId = 'wedding' | 'celebration' | 'gathering' | 'corporate'
interface InvitationRead {
  id: string; category: CategoryId; variant: VariantId
  title: string | null        // internal name for the owner's list (never published), ≤120
  timezone: string            // IANA zone, default "Asia/Jakarta"; used for the RSVP deadline
  themeId: string | null; locale: 'en' | 'id'
  status: 'draft' | 'published'; publishedAt: string | null
  revision: number; slug: string | null; hasUnpublishedChanges: boolean
  publication: { publishedAt: string; revision: number; themeId: string } | null
  createdAt: string; updatedAt: string
}
interface InvitationSummary {
  id; title; category; variant; themeId; status; slug; hasUnpublishedChanges
  eventDate: string | null    // opening.weddingDate
  updatedAt; publishedAt
}
```

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/invitations` | – | 200 `{ items: InvitationSummary[] }`, most recently updated first |
| POST | `/invitations` | `{ category, variant, themeId?, title?, locale?, timezone?, sessions? }` — `sessions: [{type, title?}]` (≤6) replaces the variant's session presets (the wizard's ceremony/reception choices); omit for the presets, `[]` for none | 201 `InvitationRead`; 422 `validation_error` (bad pair/zone/…), 422 `template_incompatible`, 409 `limit_reached` (50 per user) |
| GET | `/invitations/{id}` | – | 200 `InvitationRead` |
| PATCH | `/invitations/{id}` | `{ title?, themeId?, locale?, timezone? }` | 200 `InvitationRead`; `category`/`variant` are immutable (422); 422 `template_incompatible` |
| DELETE | `/invitations/{id}` | – | 204; cascades content, publications, uploads, RSVP replies; media files removed best-effort |

`themeId` must be selectable (`backend/app/core/selectable_theme_ids.json`) → else 422 `validation_error`
(field `themeId`), and compatible with the category/variant → else 422 `template_incompatible`.
`timezone` must be an IANA name known to the server (`zoneinfo`), ≤64 characters.

**Seeding on create** (from the registry): `story`/`gallery`/`rsvp` `enabled` = the section's
`defaultEnabled`; optional universal sections that start **on** are stored as `{enabled: true}`
(plus milestone `defaults`, e.g. `sweet_17` → `age: 17`), the ones that start off are absent;
`countdown = {enabled: true, addToCalendar: true}`; `rsvpDefaults` are copied into `rsvp`
(registration field labels in the invitation's locale); one session per `sessionPresets` entry
(`type`, title in the invitation's locale, ids `session-1`, `session-2`, …). New rows have
`schemaVersion: 2`.

Example:

```http
POST /api/v1/invitations
{"category": "celebration", "variant": "sweet_17", "themeId": "temuvibe-festive", "title": "Sweet 17 Nadia", "locale": "id"}

201 {"id": "…", "category": "celebration", "variant": "sweet_17", "title": "Sweet 17 Nadia", "timezone": "Asia/Jakarta",
     "themeId": "temuvibe-festive", "locale": "id", "status": "draft", "revision": 0, "slug": null, …}
```

```http
POST /api/v1/invitations
{"category": "corporate", "variant": "seminar", "themeId": "temuvibe-festive"}

422 {"error": {"code": "template_incompatible", "message": "This template does not support this type of invitation. Choose another template.",
               "details": [{"field": "themeId", "message": "…"}]}}
```

## Content

Per-invitation routes (each also exists under `/weddings/{id}/…`):

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/invitations/{id}/content` | – | 200 draft + `ETag` |
| PUT | `/invitations/{id}/content` | draft | 200 draft — replaces everything in one transaction |
| GET | `/invitations/{id}/preview` | – | 200 `{ themeId, content: draft }` |
| GET / PUT | `/invitations/{id}/sections/{sectionId}` | section object (PUT = full replace) | 200 section object |
| GET / POST | `/invitations/{id}/{stories\|events\|gallery}` | item | 200 `Item[]` / 201 `Item` |
| PUT | `/invitations/{id}/{collection}/order` | `{ ids }` (exact permutation) | 200 `Item[]` |
| PUT / DELETE | `/invitations/{id}/{collection}/{itemId}` | item | 200 `Item` / 204 |
| POST | `/invitations/{id}/assets` | multipart `file`, `kind` | 201 `{ id, src, width, height, kind }` |
| DELETE | `/invitations/{id}/assets/{assetId}` | – | 204 |
| POST | `/invitations/{id}/publish` · `/unpublish` | – | 200 `InvitationRead` |

`sectionId` ∈ `opening | couple | story | gallery | rsvp | closing | holyRecite1 | holyRecite2 | greeting |
countdown | wishes | amplopDigital | profiles | milestone | organization | agenda | speakers`
(unknown → 404). Section reads are never restricted; **writes** of a section the variant does not
offer → 422 `section_not_available` (also `POST/PUT/DELETE` on `stories` without `story`, `gallery`
without `gallery`). Hiding a required section (`enabled: false`, e.g. a wedding's `couple`) → 422
`validation_error` field `enabled`.

### Draft shape

```ts
interface InvitationDraft {
  contentVersion?: '1.1' | '1.2' | '2.0'   // "2.0" is stamped by every PUT /content and universal-section PUT
  schemaVersion: 1 | 2                     // 1 = created before the invitation engine
  locale: 'en' | 'id'
  opening: { weddingTitle?; coupleNames?; headline?; introduction?; coverImage?: ImageAsset
             weddingDate?  /* main event date for every variant */; guestGreeting?: { enabled; label? } }
  couple:  { groom: PersonDraft; bride: PersonDraft; enabled?: boolean } // always present; enabled only for optional couple (anniversary)
  story:   { title?; introduction?; enabled: boolean; timeline: StoryEntry[] }
  events:  EventItem[]                        // "Sessions"
  gallery: { title?; description?; enabled: boolean; images: GalleryItem[] }
  rsvp:    RsvpConfig
  closing: { message?; thankYou?; image?: ImageAsset; familyAcknowledgments? }
  // universal sections (absent = never set)
  holyRecite1?; holyRecite2?; greeting?; countdown?; wishes?; amplopDigital?
  profiles?; milestone?; organization?; agenda?; speakers?
}
```

`couple`, `story`, `gallery`, `rsvp` are always present in the draft (shape stability). In `PUT /content`
they are **required when the variant offers them** (422 `validation_error`, field = section) and
**rejected when it does not** (422 `section_not_available`); universal sections sent for a variant
that does not offer them are rejected the same way. Universal sections in `PUT /content` are merged
into what is stored (legacy behaviour); the per-section PUT replaces.

Existing value types, limits and rules (person, story entry, gallery item, holy recite, greeting,
countdown, wishes, amplop digital, uploads, image `src` rules) are unchanged — see
[weddings.md](weddings.md) sections "Validation rules", "CMS v2.0 additions" and "Image uploads".

### New sections (v2.0)

```ts
interface ProfilesSection {          // celebrant / child / graduate / hosts / organizers
  enabled: boolean; title?: string   // ≤120
  people: Array<{ id?: SafeId; role: ProfileRole; name: string /* 1..120 */; nickname?: string /* ≤40 */
    image?: ImageAsset; description?: string /* ≤2000 */; parents?: string /* ≤200 */; birthDate?: 'YYYY-MM-DD' }> // ≤20
}
interface MilestoneSection {
  enabled: boolean; title?: string   // ≤120
  age?: number /* int 1..150 */; years?: number /* int 1..100 */; occasion?: string /* ≤120 */
  institution?; program?; degree?    // ≤160 each
  partyTheme?: string /* ≤200 */; description?: string /* ≤2000 */
}
interface OrganizationSection {
  enabled: boolean; name?: string /* ≤160 */; tagline?: string /* ≤200 */; description?: string /* ≤2000 */
  logo?: ImageAsset; websiteUrl?: string /* https only, ≤2048 */
}
interface AgendaSection {
  enabled: boolean; title?: string
  items: Array<{ id?: SafeId; time?: 'HH:mm'; endTime?: 'HH:mm' /* > time */; title: string /* 1..120 */
    description?: string; sessionId?: SafeId; speakerIds?: SafeId[] /* ≤30, unique */ }>  // ≤50
}
interface SpeakersSection {
  enabled: boolean; title?: string
  people: Array<{ id?: SafeId; name: string /* 1..120 */; role?: string /* ≤120 */; organization?: string /* ≤160 */
    image?: ImageAsset; bio?: string /* ≤2000 */ }>   // ≤30
}
type SafeId = string  // ^[A-Za-z0-9_-]{1,64}$
```

- List ids are unique per list (422 otherwise); items sent without an id get one (`person-…`, `item-…`,
  `speaker-…`, `field-…`) and keep it on later PUTs that send it back.
- `profiles.people[].role` must be one of the variant's `roles` → 422 field `people.<i>.role`
  (`profiles.people.<i>.role` in `PUT /content`).
- `agenda` references (`sessionId`, `speakerIds`) are validated for format only; dangling ones are
  dropped from the published snapshot.

### Extensions to existing sections

- `events[].type` adds `party | celebration | session | talk | workshop | gathering | prayer | dinner`.
- `events[].optional?: boolean` — a session guests may pick (with `rsvp.allowSessionChoice`).
- `rsvp` adds:

```ts
interface RsvpConfig {
  enabled: boolean; title?; introduction?; deadline?: 'YYYY-MM-DD'; confirmationMessage?: string /* ≤500 */
  maxGuestsPerResponse?: number      // party-size limit per reply, 1..20 (unset = 20)
  capacity?: number                  // total attending people, 1..100000
  collectContact?: 'none' | 'email' | 'phone' | 'email_or_phone'   // unset = none
  allowSessionChoice?: boolean
  registrationFields?: Array<{ id?: SafeId; label: string /* 1..80 */
    type: 'text' | 'textarea' | 'email' | 'phone' | 'select' | 'checkbox'; required?: boolean
    options?: string[] /* select only (required there): 1..20 unique, each 1..80; other types → 422 */ }> // ≤10, unique ids
}
```

## Publishing

`POST /invitations/{id}/publish` validates server-side (only sections the variant **offers** and that
are **shown**) → 422 `publish_blocked` with `details = [{section, field, code, message}]`, in this order:

| section | field | code | when |
|---|---|---|---|
| `theme` | `themeId` | `required` / `invalid` / `incompatible` | no theme / no longer selectable / not for this variant |
| `opening` | `opening.weddingDate` | `required` | the (main) event date |
| `couple` | `couple.groom.name`, `couple.bride.name` | `required` | couple offered and shown |
| `profiles` | `profiles.people` | `incomplete` | enabled, no person with a name |
| `organization` | `organization.name` | `required` | enabled, no name |
| `milestone` | `milestone` | `incomplete` | enabled, none of the variant's fields nor `description` set |
| `events` | `events` / `events.<i>.title\|date\|startTime` / `events.<i>.venueName\|address` (in person and hybrid) / `events.<i>.onlineUrl` (online and hybrid: a link **or** `onlineInstructions`) / `events.<i>.livestream.url` | `required` | |
| `closing` | `closing.message` | `required` | |
| `agenda` | `agenda.items` | `incomplete` | enabled, no item with a title |
| `speakers` | `speakers.people` | `incomplete` | enabled, no speaker with a name |
| `story`, `gallery`, `holyRecite1\|2`, `greeting`, `amplopDigital` | as before | | only when offered |

**Rule for optional sections:** a section that is switched ON but empty BLOCKS publishing
(add content or hide it). It is never silently dropped. The editor shows the same rules and
asks the server before claiming "all clear":

`GET /invitations/{id}/publish-check` (owner, read-only) → 200 `{ revision, ready, issues }` where
`issues` are exactly the `details` `POST …/publish` would return for the saved draft. Clients
must re-word issues from the stable `section`/`field`/`code` (the `message` is English).

**Sessions** (`events[]`) also carry `format?: 'in_person' | 'online' | 'hybrid'` (absent = in
person), `onlineUrl?` (https), `onlineLabel?`, `onlineInstructions?` (≤1000) and `endDate?`
(multi-day, ≥ `date`; then `endTime` may be earlier in the day than `startTime`). Online details
are published only for online/hybrid sessions.

**Snapshot** (allow-listed, built field by field, never wholesale): only offered sections. `couple`
for couple variants (`{enabled: false}` when an optional couple is hidden); `story`/`gallery`/`rsvp`
only when enabled; universal and new sections present when set: full when enabled, `{enabled: false}`
marker when switched off. New-section rules: profiles keep only people with an allowed role; milestone
keeps the variant's `fields` + `title`/`description`; agenda drops dangling `sessionId`/`speakerIds`;
events carry `optional: true` only when set; RSVP carries `capacity`, `collectContact` (unless none),
`allowSessionChoice` (only when true) and sanitised `registrationFields`. RSVP replies and counts are
never in the snapshot. `contentVersion` is `"2.0"` (or `"1.2"` for a pre-engine wedding never written
since, which publishes exactly as before); `schemaVersion` mirrors the row.

**Slug** (first publish, never changed): `{groom}-{bride}` for couple variants; else up to two profile
first names/nicknames; else the organization name; else `undangan`; then `-` + 6 random `[a-z0-9]`.

## Public

`GET /public/invitations/{slug}` (and legacy `GET /public/weddings/{slug}`, identical) → 200:

```json
{ "category": "celebration", "variant": "birthday", "themeId": "temuvibe-festive", "locale": "id",
  "timezone": "Asia/Jakarta", "content": { "...": "snapshot", "rsvp": { "enabled": true, "capacity": 50, "full": false } },
  "publishedAt": "2026-11-22T10:00:00+00:00" }
```

`rsvp.full` is added (true/false) only when the snapshot has a `capacity`. Headers:
`X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-cache`, `ETag` = a digest of the exact
response body (so ANY change guests would see — republish, RSVP filling up or freeing again —
gives a new tag; `If-None-Match` → 304), `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff`. 120 requests/min per IP. Unknown/unpublished → 404 `not_found`.
`timezone` is the zone **as published** (migration 0009): changing the draft's time zone
marks the invitation as having unpublished changes and reaches guests (dates, calendar links,
RSVP deadline) only after the next publish.

### RSVP submission

`POST /public/invitations/{slug}/rsvp` — no session, no cookies set, `Cache-Control: no-store`.

```ts
{ name: string /* 1..120 */; attendance: 'attending' | 'not_attending'; partySize?: number /* int 0..20, default 1 */
  email?: string /* ≤254 */; phone?: string /* digits, spaces, hyphens, optional +, ≤30 */
  sessionIds?: SafeId[] /* ≤20 */; answers?: Record<SafeId, string /* ≤1000 */ | boolean> /* ≤10 */
  message?: string /* ≤1000 */; guestLabel?: string /* ≤120, the ?to= name */; website?: string /* honeypot */ }
```

Validated against the **published** snapshot's RSVP config, in this order:

1. Rate limits (`RATE_LIMIT_BACKEND`: per process in development, shared in production): 10/min per client IP (own bucket), then 60/min per
   invitation slug → 429. Body > 16 KiB → 413. Behind a reverse proxy the client IP comes from
   `X-Forwarded-For` only when the proxy is listed in `FORWARDED_ALLOW_IPS` (see `infrastructure/nginx/README.md`).
2. Unknown/unpublished slug → 404.
3. RSVP not in the snapshot or disabled → 422 `rsvp_closed`; today **in the published time zone**
   after `deadline` → 422 `rsvp_closed` (the deadline day itself is open; an unreadable stored deadline
   also closes the RSVP).
4. Attending: `partySize` 1..`maxGuestsPerResponse` (default 20) → else 422 field `partySize`.
   Not attending: stored with `partySize: 0`.
   Guest text (`name`, `guestLabel`, `message`, answer values) is NFC-normalised and stripped of bidi
   controls (U+202A–202E, U+2066–2069) and zero-width characters (U+200B–200F); tabs are rejected, and line
   breaks only allowed in `message` and answer values.
5. `collectContact`: `email` → `email` required; `phone` → `phone` required; `email_or_phone` → one of
   them (422 field `email`). Contact details the form does not ask for are dropped, never stored.
6. `answers`: keys must be registration field ids (`answers.<id>`); required text fields non-empty,
   required checkboxes `true`; `select` value ∈ options; `email`/`phone` formats; text ≤200
   (textarea ≤1000) characters.
7. `sessionIds` (attending only): require `allowSessionChoice`; unique; each an `optional` published session.
8. Under a row lock on the invitation: 5000 replies → 409 `limit_reached`; attending people + `partySize`
   > `capacity` → 409 `capacity_reached`.

9. `website` non-empty (honeypot): every check above still applies (same errors as a real reply),
   then **201 with a decoy body and nothing stored**.

→ 201 `{ id, attendance, partySize, confirmationMessage, editToken, updatedAt: null }`.
`editToken` (43 URL-safe characters) is shown once; only its SHA-256 is stored. It lets THIS
guest read and replace THIS reply; replies are never matched by name or email.

### A guest's own reply

`GET /public/invitations/{slug}/rsvp/mine` and `PUT /public/invitations/{slug}/rsvp/mine`, with
header `X-RSVP-Token: <editToken>` (never in the URL). Same rate limits and body cap as a new
reply; `Cache-Control: no-store`.

- Unknown, malformed or foreign token (or a reply made before 0009) → 404 `rsvp_link_invalid`;
  unpublished invitation → 404 `not_found`.
- GET → 200 `{ id, name, attendance, partySize, email?, phone?, sessionIds, answers, message?, createdAt, updatedAt }`.
- PUT body = the submission above. It is validated exactly like a new reply against the
  CURRENT publication (deadline → 422 `rsvp_closed`, party size, contact, answers, sessions)
  and **replaces** the reply in place: totals and capacity count only the latest answer (the
  reply's own previous party is excluded from the capacity check, under the invitation row
  lock, so concurrent changes and new replies cannot overshoot). → 200 `{ id, attendance,
  partySize, confirmationMessage, updatedAt }`. 50 changes per reply → 409 `limit_reached`.
  A filled honeypot changes nothing and gets a decoy 200.

The guest page keeps the token on the device and offers a personal link `/i/<slug>#rsvp=<token>`
(fragment: never sent to the server). Sending a NEW reply (e.g. for someone else) is separate
and never changes the guest's own reply.

## RSVP replies (owner)

| Method | Path | Response |
|---|---|---|
| GET | `/invitations/{id}/rsvp-responses?limit=50&offset=0` | 200 `{ items, total, summary }` (limit 1..200) |
| GET | `/invitations/{id}/rsvp-responses.csv` | 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="rsvp-<slug or id>.csv"` |
| DELETE | `/invitations/{id}/rsvp-responses/{responseId}` | 204; 404 for unknown/foreign/malformed ids |

```ts
interface RsvpResponse { id; name; attendance; partySize; email?; phone?; sessionIds: string[]
                         answers: Record<string, string | boolean>; message?; guestLabel?; createdAt
                         updatedAt: string | null; editCount: number; possibleDuplicate: boolean }
summary: { responses; attending; notAttending; attendingPeople; capacity: number | null // live capacity while published, else draft
           possibleDuplicates: number }
```

Items are newest first. All three send `Cache-Control: no-store`. The CSV starts with a UTF-8 BOM;
`possibleDuplicate` flags replies that share a name (case/space-insensitive), an email or a
phone with another reply of the same invitation. They are flagged for the organizer and still
counted in every total; nothing is merged or deleted automatically.

columns: Submitted at, Updated at, Possible duplicate, Name, Attendance, Party size, Email, Phone, Sessions, Guest label, Message,
then one column per registration field (label) and any other answer keys. **Formula-injection safe:**
every cell starting with `= + - @ \t \r` is prefixed with `'`. Guest data is never logged.

## Legacy aliases

| Legacy | Behaviour |
|---|---|
| `GET /weddings/me` | the caller's most recently updated `wedding`-category invitation; 404 if none |
| `POST /weddings` `{ themeId?, locale? }` | creates a `wedding_ceremony` with the pre-2.0 defaults (no seeded sessions); no more `409 wedding_exists` |
| `/weddings/{id}` and every `/weddings/{id}/…` | the same handlers as `/invitations/{id}/…` (incl. `GET`/`DELETE /weddings/{id}` and RSVP routes) |
| `GET /public/weddings/{slug}` | same as `/public/invitations/{slug}` |

`InvitationRead` is a superset of the old `WeddingRead` (adds `category`, `variant`, `title`, `timezone`).
