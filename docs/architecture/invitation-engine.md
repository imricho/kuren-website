# Temuvibe Invitation Engine — architecture & contract (v2.0)

Status: approved direction (2026-11-22). This is the coordination contract for the
multi-variant work. Backend and frontend build against it; change it here first.

Decisions (made by the product owner):
1. **Generalize weddings in place.** `weddings` becomes `invitations` (migration rename,
   reversible downgrade). Existing weddings become `category=wedding`,
   `variant=wedding_ceremony` with nothing lost. A user may own many invitations.
   The old `/api/v1/weddings/...` API keeps working as a compatibility alias.
2. **Real RSVP replies are stored** (party size, optional capacity, registration
   fields, optional session choice). Guest lists and QR check-in are out of scope.
3. **New Temuvibe template set** (4 schema-driven templates). The 49 existing
   themes keep working and are declared compatible with `wedding_*`, `engagement`
   and `anniversary` only.

Out of scope: feature flags, realtime config sync, admin toggles, subscription gating,
payments, ticketing, certificates, guest list management, QR check-in.

---

## 1. Taxonomy (stable ids — never rename)

| Category id | Variant id | Label (en) | Label (id) |
|---|---|---|---|
| `wedding` | `wedding_ceremony` | Wedding Ceremony | Akad / Pemberkatan |
| `wedding` | `wedding_reception` | Wedding Reception | Resepsi Pernikahan |
| `celebration` | `birthday` | Birthday | Ulang Tahun |
| `celebration` | `sweet_17` | Sweet 17 | Sweet Seventeen |
| `celebration` | `khitanan` | Khitanan | Khitanan |
| `celebration` | `aqiqah` | Aqiqah | Aqiqah |
| `celebration` | `engagement` | Engagement | Lamaran / Tunangan |
| `celebration` | `anniversary` | Anniversary | Anniversary |
| `celebration` | `graduation` | Graduation | Wisuda |
| `celebration` | `religious_celebration` | Religious Celebration | Perayaan Keagamaan |
| `gathering` | `family_reunion` | Family Reunion | Reuni Keluarga |
| `gathering` | `family_gathering` | Family Gathering | Kumpul Keluarga |
| `gathering` | `community_gathering` | Community Gathering | Acara Komunitas |
| `corporate` | `corporate_event` | Corporate Event | Acara Perusahaan |
| `corporate` | `company_celebration` | Company Celebration | Perayaan Perusahaan |
| `corporate` | `seminar` | Seminar | Seminar |
| `corporate` | `workshop` | Workshop | Workshop |

Both wedding variants support ceremony **and** reception as separate sessions in one
invitation; the variant only picks the preset sessions and the default emphasis.

**Single source of truth:** `backend/app/core/invitation_registry.json` (categories,
variants, per-variant section config, session presets, RSVP defaults). The backend
loads it; the frontend keeps a typed mirror in `frontend/src/features/invitation/registry.ts`
and a vitest parity test reads the JSON from disk and fails on any drift.

## 2. Sections (reusable building blocks)

All sections are optional unless the variant marks them `required`. Each optional
section has `enabled` (show/hide); values are kept while hidden (existing rule).

Existing sections (unchanged shape, now reused across variants):
`opening`, `holyRecite1`, `greeting`, `couple`, `countdown` (UI "Event date"),
`events` (UI "Sessions"), `story` (UI "Story / Timeline"), `gallery`, `rsvp`, `wishes`,
`amplopDigital` (UI "Gifts"), `holyRecite2`, `closing`.
`holyRecite1` doubles as the "Religious message" for non-wedding variants.
`opening.weddingDate` keeps its key (compat) and means "main event date" everywhere.

New sections, stored as new keys inside `universal_content` (camelCase JSON):

```ts
profiles: {           // celebrant / child / graduate / hosts / organizing committee
  enabled: boolean; title?: string;
  people: Array<{ id: string; role: ProfileRole; name: string; nickname?: string;
    image?: ImageAsset; description?: string; parents?: string; birthDate?: string /*YYYY-MM-DD*/ }>  // ≤ 20
}
// ProfileRole: 'celebrant' | 'child' | 'graduate' | 'host' | 'partner' | 'organizer'

milestone: {          // what is being celebrated
  enabled: boolean; title?: string;
  age?: number;            // birthday / sweet_17 (1..150)
  years?: number;          // anniversary (1..100)
  occasion?: string;       // religious_celebration, e.g. "Idul Fitri 1448 H" (≤120)
  institution?: string; program?: string; degree?: string;   // graduation (≤160 each)
  partyTheme?: string;     // birthday / sweet_17 (≤200)
  description?: string;    // ≤2000
}

organization: {       // corporate
  enabled: boolean; name?: string; tagline?: string; description?: string;
  logo?: ImageAsset; websiteUrl?: HttpsUrl;
}

agenda: {             // timed run-of-show
  enabled: boolean; title?: string;
  items: Array<{ id: string; time?: 'HH:MM'; endTime?: 'HH:MM'; title: string;
    description?: string; sessionId?: string; speakerIds?: string[] }>   // ≤ 50
}

speakers: {
  enabled: boolean; title?: string;
  people: Array<{ id: string; name: string; role?: string; organization?: string;
    image?: ImageAsset; bio?: string }>   // ≤ 30
}
```

Extensions to existing sections (all optional, backward compatible):
- `events[].extras.optional: boolean` — an optional session guests may pick (corporate).
- `events[].type` adds generic types: `party`, `celebration`, `session`, `talk`,
  `workshop`, `gathering`, `prayer`, `dinner` (DB check constraint updated).
- `rsvp` adds:
  `capacity?: number (1..100000)` — total attending people;
  `collectContact?: 'none' | 'email' | 'phone' | 'email_or_phone'` (default `none`);
  `allowSessionChoice?: boolean` — guests pick which optional sessions they attend;
  `registrationFields?: Array<{ id; label (≤80); type: 'text'|'textarea'|'email'|'phone'|'select'|'checkbox';
     required: boolean; options?: string[] (select only, ≤20, each ≤80) }>` (≤10).
  `maxGuestsPerResponse` already exists = party-size limit.

Invitation-level fields (columns, returned on the invitation record and public payload):
`category`, `variant`, `title` (internal name for the list, ≤120), `timezone`
(IANA name validated with zoneinfo, default `Asia/Jakarta`).

`contentVersion` becomes `"2.0"` on write; `"1.1"`/`"1.2"` remain readable.

### Per-variant section config (in the registry JSON)

For each variant: `sections` = ordered list of `{ id, required?, defaultEnabled, roles? , fields? }`.
`roles` limits `profiles.people[].role`; `fields` lists which `milestone` fields the
editor shows. Sections not listed are not offered by the editor for that variant and
are never rendered or published for it.

| Variant | Sections offered (★ required, ● on by default, ○ off by default) |
|---|---|
| wedding_ceremony / wedding_reception | the existing 13 (opening★ couple★ countdown★ events★ closing★, others as today) |
| birthday | opening★ profiles● [celebrant] milestone● [age, partyTheme] countdown★ events★ gallery○ rsvp● wishes○ amplopDigital○ closing★ |
| sweet_17 | as birthday; milestone.age defaults 17 |
| khitanan | opening★ holyRecite1○ greeting○ profiles● [child; parents shown] countdown★ events★ gallery○ rsvp● wishes○ amplopDigital○ closing★ |
| aqiqah | as khitanan (profiles [child], birthDate field) |
| engagement | opening★ greeting○ couple★ countdown★ events★ story○ gallery○ rsvp● wishes○ closing★ |
| anniversary | opening★ couple● profiles○ [partner, host] milestone● [years] countdown★ events★ story○ gallery○ rsvp● wishes○ closing★ |
| graduation | opening★ profiles● [graduate] milestone● [institution, program, degree] countdown★ events★ gallery○ rsvp● wishes○ closing★ |
| religious_celebration | opening★ holyRecite1○ greeting○ profiles● [host] milestone● [occasion] countdown★ events★ rsvp● wishes○ closing★ |
| family_reunion / family_gathering / community_gathering | opening★ greeting○ profiles● [host, organizer] countdown★ events★ agenda● gallery○ rsvp● closing★ (RSVP party size default 10) |
| corporate_event / company_celebration | opening★ organization● countdown★ events★ agenda● speakers○ gallery○ rsvp● closing★ |
| seminar / workshop | opening★ organization● countdown★ events★ agenda● speakers● rsvp● (registration: name + email + company) closing★ |

Session presets (seeded on create): wedding_ceremony → `akad` + `reception`;
wedding_reception → `reception`; birthday/sweet_17 → `party`; khitanan/aqiqah →
`ceremony` + `celebration`; engagement → `engagement`; graduation → `ceremony`;
religious_celebration → `celebration`; gatherings → `gathering`; corporate → `session`.

## 3. Data model (Postgres)

Migration `20261122_0008_invitations` (single revision, full downgrade):
- Rename tables: `weddings`→`invitations`, `wedding_publications`→`invitation_publications`,
  `wedding_assets`→`invitation_assets`, `wedding_events`→`invitation_sessions`,
  `wedding_story_entries`→`invitation_story_entries`, `wedding_gallery_images`→`invitation_gallery_images`.
  Rename FK columns `wedding_id`→`invitation_id`; rename constraints/indexes to match.
- `invitations`: drop UNIQUE on `owner_id` (keep an index on `(owner_id, updated_at)`);
  add `category` (varchar 20, check in list), `variant` (varchar 40, check in list),
  `title` (varchar 120 null), `timezone` (varchar 64, default `Asia/Jakarta`).
  Backfill: `category='wedding'`, `variant='wedding_ceremony'`.
  Check: (category, variant) pair must be valid (check constraint generated from the registry).
- `invitation_publications`: add `category`, `variant` (snapshot what was published).
- Session `type` check constraint extended with the generic types.
- New table `invitation_rsvp_responses`:
  `id uuid pk`, `invitation_id fk cascade`, `publication_id fk set null`,
  `name varchar(120) not null`, `attendance varchar(16) check in ('attending','not_attending')`,
  `party_size smallint not null check 1..20` (0 allowed when not attending → store 0; check `party_size >= 0`),
  `email varchar(254) null`, `phone varchar(40) null`, `session_ids jsonb default '[]'`,
  `answers jsonb default '{}'`, `message text null (≤1000)`, `guest_label varchar(120) null` (from `?to=`),
  `created_at timestamptz default now()`.
  Index `(invitation_id, created_at desc)`.
  Downgrade drops it. Max 5000 responses per invitation (409 `limit_reached`).

SQLAlchemy: `Invitation` model (keep `Wedding = Invitation` alias only if it eases the
transition; prefer renaming call sites). `schema_version` bumps to 2.

## 4. API contract

Base `/api/v1`. Auth = existing session cookie. Ownership failures → 404 (never 403).
Concurrency (`ETag`/`If-Match`, 409 `edit_conflict`) unchanged.

Registry:
- `GET /invitation-types` (public, cacheable): the registry JSON (categories, variants,
  sections, presets) + template compatibility (`templates: [{id, categories, variants?}]`).

Invitations:
- `GET /invitations` → `{ items: InvitationSummary[] }` newest-updated first.
  `InvitationSummary = { id, title, category, variant, themeId, status, slug,
  hasUnpublishedChanges, eventDate, updatedAt, publishedAt }`.
- `POST /invitations` `{ category, variant, themeId?, title?, locale?, timezone? }` → 201 `InvitationRead`.
  Validates pair + template compatibility (422 `template_incompatible`). Seeds the
  variant's defaults (section enabled flags, session presets, RSVP defaults). Max 50 per user (409 `limit_reached`).
- `GET /invitations/{id}` → `InvitationRead` = today's `WeddingRead` + `category, variant, title, timezone`.
- `PATCH /invitations/{id}` `{ title?, themeId?, locale?, timezone? }`. Category/variant are immutable.
- `DELETE /invitations/{id}` → 204 (cascades; removes media files best-effort).
- Everything that exists today under `/weddings/{id}/…` exists identically under
  `/invitations/{id}/…`: `content`, `preview`, `sections/{sectionId}` (now also
  `profiles`, `milestone`, `organization`, `agenda`, `speakers`), `story`, `events`,
  `gallery`, `publish`, `unpublish`, `assets`.
  Writing a section the variant does not offer → 422 `section_not_available`.
- RSVP (owner): `GET /invitations/{id}/rsvp-responses?limit&offset` →
  `{ items, total, summary: { responses, attending, notAttending, attendingPeople, capacity } }`;
  `GET /invitations/{id}/rsvp-responses.csv` (formula-injection safe: prefix `= + - @ \t \r` with `'`);
  `DELETE /invitations/{id}/rsvp-responses/{responseId}` → 204.

Legacy aliases (kept, tested): `/weddings/me` → the user's most recently updated
`wedding`-category invitation (404 if none); `POST /weddings` creates `wedding_ceremony`;
all `/weddings/{id}/…` routes route to the same handlers.

Public:
- `GET /public/invitations/{slug}` (and legacy `/public/weddings/{slug}`):
  `{ category, variant, themeId, locale, timezone, content, publishedAt }` — content is the
  allow-listed snapshot, including the new sections when enabled and offered by the variant.
  RSVP config in the snapshot excludes nothing secret but **never** includes responses or counts,
  except `rsvp.full: boolean` when a capacity is set and reached.
- `POST /public/invitations/{slug}/rsvp` `{ name, attendance, partySize, email?, phone?,
  sessionIds?, answers?, message?, guestLabel?, website }` (`website` = honeypot, must be empty).
  Validated against the **published** snapshot's RSVP config: RSVP enabled, before deadline
  (in the invitation timezone) → else 422 `rsvp_closed`; partySize ≤ maxGuestsPerResponse;
  required contact/fields present; select options valid; sessionIds ⊆ published optional sessions.
  Capacity checked under a row lock → 409 `capacity_reached`. Rate limit 10/min per IP
  (separate bucket). 201 `{ id, attendance, partySize, confirmationMessage }`. No cookies set.

## 5. Templates

`TemplateManifest` (frontend, `features/themes/core/types.ts`):
```ts
{ id; name; family; categories: CategoryId[]; variants?: VariantId[];  // omitted = all variants of those categories
  sections: SectionId[];            // sections the template can render
  theme: { colors: {...tokens}; typography: { display; body; script? } };
  media: { cover: 'required'|'optional'|'none'; gallery: boolean } }
```
- Existing 49 themes: generated manifests, `categories: ['wedding','celebration']`,
  `variants: ['wedding_ceremony','wedding_reception','engagement','anniversary']`, the 13 wedding sections.
- New family `temuvibe` with one schema-driven renderer and four presets:
  `temuvibe-elegant` (all categories; Deep Plum #241236 + Champagne Gold),
  `temuvibe-minimal` (all categories; ivory/plum), `temuvibe-festive`
  (celebration, gathering), `temuvibe-corporate` (corporate, gathering).
  They render every section above, in this canonical order:
  opening, holyRecite1, greeting, couple, profiles, organization, milestone, countdown,
  events, agenda, speakers, story, gallery, rsvp, wishes, amplopDigital, holyRecite2, closing.
- The backend mirrors compatibility in `invitation_registry.json` (`templates`) and the
  selectable theme list; the frontend parity test covers both.

## 6. Frontend

Routes: `/invitations` (list = dashboard), `/invitations/new` (wizard: category → variant →
template → name → create), `/invitations/:id/edit/:section`, `/invitations/:id/preview`,
`/invitations/:id/responses`. Legacy `/wedding/*` redirects to the user's latest wedding
invitation (or the wizard). `/i/:slug` serves every variant.
The split-screen editor, autosave, conflict handling and publish page are reused; the
section nav is driven by the variant's section config.

## 6a. Implemented deviations (backend, 2026-11-22)

- Optional sessions are a top-level `events[].optional` boolean (not `extras.optional`).
- `countdown.enabled` stays a timer-only toggle even where countdown is ★ (the date,
  `opening.weddingDate`, is what is required).
- `couple.enabled?` added; hiding a required couple → 422 on field `enabled` (anniversary may hide it).
- Anniversary seeds one `celebration` session; all corporate variants seed `session`.
  Legacy `POST /weddings` seeds no sessions (old editor behaviour); `/invitations` seeds presets.
- Registry JSON also has `sectionOrder`, `sessionTypes`, `profileRoles`, `milestoneFields`,
  milestone `defaults` (sweet_17 age 17), `legacyTemplates` (expanded in `/invitation-types`).
- Milestone `fields` filter what is published but are not enforced on write; profile roles are.
- `PUT /content` requires couple/story/gallery/rsvp only when offered; sending a non-offered one → 422 `section_not_available`.
- List ids (people, agenda items, speakers, registration fields) are optional on write; the server assigns them.
- Public `timezone` is the live invitation value; ETag becomes `"<id>-full"` once RSVP is full.
- RSVP: filled honeypot → decoy 201, nothing stored; unrequested contact fields are dropped;
  not-attending stored with party size 0; Origin CSRF check applies to the public POST.
- RSVP that is on but has no heading: guests see the default heading ("RSVP" / "RSVP Kehadiran",
  in the invitation's language) instead of the section being hidden; the publish checklist warns.
  (Before 2026-11-22 the section was dropped silently, which hid the form for the 15 variants
  whose RSVP starts on.)
- Downgrade of 0008 refuses if any user owns more than one invitation; it drops RSVP replies
  and the new columns.

## 7. Security notes

Guest data (RSVP names, contacts, answers) is owner-only, never in snapshots, never logged.
Public POST: honeypot, rate limit, strict body size (16 KB), extra=forbid, string limits,
no HTML rendering (text only). CSV export escapes formulas. Deleting an invitation deletes its replies.

## 8. Changes on 2026-11-23 (audit follow-up, migration 0009)

- **RSVP changes:** every new reply gets a private edit token (hash stored). The guest can
  read/replace their own reply (`/rsvp/mine`, `X-RSVP-Token` header); a change replaces the
  row, so totals/capacity never double-count. Possible duplicates are flagged, never merged.
- **Publish rule:** shown-but-empty optional sections block publishing on both client and
  server; the editor asks the server (`GET …/publish-check`) before saying "all clear" and
  re-words server issues from stable codes (Indonesian/English). Completion counts include
  every shown section. The RSVP heading is optional (default heading when empty).
- **Published time zone:** stored on each publication; public payload, calendar links and the
  RSVP deadline use it; the public ETag is a digest of the response.
- **Sessions:** `format` in_person/online/hybrid with `onlineUrl`/`onlineLabel`/
  `onlineInstructions`, and `endDate` for multi-day sessions (stored in session `extras`).
- **Calendar:** times converted from the published zone to UTC (DST-aware); a missing end time
  uses a disclosed 2-hour assumption; multi-day sessions without an end time are all-day.
- **Presets:** wedding_ceremony starts with one neutral ceremony; the wizard picks akad /
  pemberkatan / neutral and an optional reception (reception variant: optional ceremony);
  khitanan/aqiqah start with the celebration (procession optional); graduation can add a
  private celebration; company_celebration uses celebration wording. Existing invitations'
  sessions are never changed.
- **Personal guest links:** `#to=<name>` (fragment); `?to=` still works.

