# Deploy readiness (invitation engine, migrations 0008 and 0009)

Status (2026-11-23): **ready for a staged deployment once the "Ops" items in §5 are done.**
The application now refuses insecure production settings, rate limits are shared across
workers, and every migration step below has been exercised against a seeded database. What
is left is infrastructure the repository cannot do for you: TLS, backups, monitoring and log
rotation on the real hosts.

## 1. Required environment (backend)

| Variable | Required | Default | Production value / notes |
| --- | --- | --- | --- |
| `ENVIRONMENT` | yes | `development` | `production` (disables `/api/docs`; turns on the checks below) |
| `POSTGRES_HOST`, `POSTGRES_PORT` | yes | `localhost`, `5432` | |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | none | Strong random password (`openssl rand -hex 24`) |
| `SESSION_COOKIE_SECURE` | yes | `false` | **`true`. Enforced:** with `ENVIRONMENT=production` the backend refuses to start otherwise. Development keeps `false` (plain HTTP on localhost). |
| `RATE_LIMIT_BACKEND` | yes | `memory` | **`database`. Enforced** in production. Counters live in `rate_limit_hits` (migration 0009), shared by every worker and replica; keys are SHA-256 hashed, old windows are pruned. |
| `SESSION_TTL_HOURS` | no | `168` | 1 to 2160 |
| `CORS_ORIGINS` | no | empty | Leave empty when nginx serves the SPA and `/api` on one origin; otherwise exact HTTPS origins, never `*`. |
| `FORWARDED_ALLOW_IPS` | **yes, behind a proxy** | `127.0.0.1` | The address/CIDR nginx connects from, as seen by the backend. `*` is refused. See `infrastructure/nginx/README.md`. |
| `MEDIA_ROOT` | no | `/app/media` | A persistent volume |
| `MAX_UPLOAD_BYTES`, `MAX_IMAGE_PIXELS` | no | 5 MB, 40 MP | Keep nginx `client_max_body_size` slightly above the upload cap |
| `MAX_ASSETS_PER_INVITATION` | no | `300` | Renamed from `MAX_ASSETS_PER_WEDDING` (the old name is ignored) |
| `MAX_REQUEST_BODY_BYTES`, `MAX_RSVP_BODY_BYTES` | no | 1 MiB, 16 KiB | The RSVP cap also covers `PUT …/rsvp/mine` |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | no | `120` | Per client IP |
| `RSVP_RATE_LIMIT_PER_MINUTE`, `RSVP_SLUG_RATE_LIMIT_PER_MINUTE` | no | `10`, `300` | Per client IP (new and changed replies) / per invitation (new replies only; reading your own reply uses the public-page limit) |
| `RUN_MIGRATIONS` | no | `true` | `false` on app containers once migrations run as a one-off job |

Frontend: the production build reads no runtime secrets (`VITE_*` are dev-server settings only).

## 2. Migration steps

### 0007 → 0008 (stop-the-world)
0008 renames every `wedding*` object to `invitation*` and adds category/variant/title/timezone
and RSVP replies. **Old code cannot run on 0008 and new code cannot run on 0007**, so stop the
old backend, back up, migrate once, start the new one:

1. Back up the database and the media volume (see §4).
2. Stop the old backend.
3. `docker compose run --rm -e RUN_MIGRATIONS=false backend alembic upgrade head`
4. Verify `alembic current` = head and `alembic check` reports no changes.
5. Start the new backend; check `GET /api/v1/health` = `{"status":"ok","database":"ok"}`.

### 0008 → 0009 (additive)
0009 only adds: RSVP edit-token hash / `updated_at` / `edit_count`, `invitation_publications.timezone`
(backfilled with each invitation's current time zone, which is what guests already saw, so
public pages do not change), the `rate_limit_hits` table, and relaxes the session time check
for multi-day sessions. No row is deleted or rewritten except that backfill.

Upgrade path: back up, then `alembic upgrade head`. The 0009 schema is compatible with the
previous (0008) code for reads, but deploy code and migration together anyway.

Existing RSVP replies get no edit token: they remain valid and visible to organizers, but
those guests cannot change them online (the organizer can delete a superseded reply).

## 3. Rollback

- **Preferred:** restore the pre-upgrade backup and redeploy the previous image.
- `alembic downgrade 0008` (from 0009): drops the edit tokens (guests lose their "change my
  reply" links; replies are KEPT), the published time zone (public pages fall back to the
  live time zone) and the rate-limit table. **Refuses (changes nothing)** while a multi-day
  session ends at an earlier clock time than it starts.
- `alembic downgrade 0007` (from 0008): refuses while any user owns more than one invitation
  or any invitation is not a wedding. When it does run it **drops every RSVP reply**; export
  replies (CSV) before considering it. Prefer restoring the backup.
- Never run a downgrade against production data without a fresh backup.

## 4. Backups, restore, monitoring, logs

**Backups (Ops).** Nightly `pg_dump -Fc "$DATABASE" > temuvibe-$(date +%F).dump` plus a
snapshot/tar of the `media_data` volume taken at the same time (asset rows reference files
by name). Keep 14 daily + 8 weekly; store off-host; encrypt (they contain guest PII: names,
contacts, messages).

**Restore drill (Ops, at least quarterly).**
```bash
createdb temuvibe_restore
pg_restore --no-owner -d temuvibe_restore temuvibe-YYYY-MM-DD.dump
# point a staging backend at it, run: alembic current && alembic check, then open a published /i/<slug>
```

**Health and monitoring.** The image has a Docker `HEALTHCHECK` on `GET /api/v1/health`
(503 when the database is down). Point an external uptime check at the same URL and at one
published `/i/<slug>`. Alert on: health ≠ 200 for 2 minutes, 5xx rate > 1 %, sustained 429s
(possible abuse or a mis-set `FORWARDED_ALLOW_IPS`), disk usage of the media volume > 80 %.

**Logs and privacy.**
- The app logs only exception type, method and path on errors; request bodies, guest names
  and query parameters are not logged (`hide_parameters=True` for SQL).
- Personal guest links now put the name in the URL fragment (`/i/<slug>#to=<name>`), which is
  never sent to the server. Older links with `?to=` still work; the nginx example logs `$uri`
  without the query string (`log_format temuvibe_privacy`), so those names stay out of logs.
- RSVP edit tokens travel in the `X-RSVP-Token` header (never in URLs) and are stored hashed.
- Slugs often contain the hosts' names; treat access logs as personal data. Rotate daily,
  keep 14 days, restrict access.

## 5. Production checklist

App (done in the repository):
- [x] `SESSION_COOKIE_SECURE=true` enforced when `ENVIRONMENT=production`.
- [x] Shared rate limits (`RATE_LIMIT_BACKEND=database`) enforced in production.
- [x] Docker `HEALTHCHECK`, non-root image, `*` refused for `FORWARDED_ALLOW_IPS`.
- [x] Guest names out of server logs (fragment links + nginx `log_format` example).

Ops (on the hosts):
- [ ] TLS in front of nginx; HTTP → HTTPS redirect; HSTS once stable.
- [ ] `ENVIRONMENT=production`, `SESSION_COOKIE_SECURE=true`, `RATE_LIMIT_BACKEND=database`.
- [ ] `FORWARDED_ALLOW_IPS` = nginx's address; nginx overwrites `X-Forwarded-For` (see example).
- [ ] Build the lean image: `--build-arg INSTALL_DEV=false` (the default build includes test tools for local development).
- [ ] Migrations as a one-off job; `RUN_MIGRATIONS=false` on app containers.
- [ ] Persistent, backed-up `media_data` volume; nightly DB + media backups; restore drill done.
- [ ] Uptime checks and alerts (§4); log rotation and retention (§4).
- [ ] Serve `frontend/dist` with long-cache `/assets/` (nginx example).
- [ ] Optional: compress the 2.27 MB landing PNG.
