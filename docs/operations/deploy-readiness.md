# Deploy readiness (invitation engine, migration 0008)

Status: **not yet production-ready**. The open items are in the checklist at the end. Verified
on 2026-11-22 against a fresh Postgres 17 and a 0007 database seeded with weddings. The
seed covered publications, assets, events, story and gallery rows.

## 1. Required environment (backend)

| Variable | Required | Default | Production value / notes |
| --- | --- | --- | --- |
| `ENVIRONMENT` | yes | `development` | `production` (disables `/api/docs` and `/api/openapi.json`) |
| `POSTGRES_HOST`, `POSTGRES_PORT` | yes | `localhost`, `5432` | |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | none | Strong random password (`openssl rand -hex 24`) |
| `SESSION_COOKIE_SECURE` | yes | `false` | **`true`**. The app does not enforce it, so with `false` session cookies also go out over plain HTTP. |
| `SESSION_TTL_HOURS` | no | `168` | 1 to 2160 |
| `CORS_ORIGINS` | no | empty | Leave empty when nginx serves the SPA and `/api` on the same origin. Otherwise list exact HTTPS origins and never `*` (credentials are allowed). |
| `FORWARDED_ALLOW_IPS` | **yes, behind a proxy** | `127.0.0.1` | The address or CIDR that nginx connects *from*, as seen by the backend, e.g. `172.18.0.0/16`. `*` is refused by both the entrypoint and the app. See `infrastructure/nginx/README.md`. |
| `MEDIA_ROOT` | no | `/app/media` | Must be a persistent volume |
| `MAX_UPLOAD_BYTES` | no | `5242880` | Keep nginx `client_max_body_size` slightly above this |
| `MAX_IMAGE_PIXELS` | no | `40000000` | Pillow decompression-bomb guard |
| `MAX_ASSETS_PER_INVITATION` | no | `300` | **Renamed from `MAX_ASSETS_PER_WEDDING`.** The old name is now silently ignored (`extra="ignore"`), so rename it in every `.env` or secret store. |
| `MAX_REQUEST_BODY_BYTES` | no | `1048576` | JSON body cap |
| `MAX_RSVP_BODY_BYTES` | no | `16384` | New. Body cap for `POST /public/invitations/{slug}/rsvp` |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | no | `120` | Per client IP, **per process** |
| `RSVP_RATE_LIMIT_PER_MINUTE` | no | `10` | New. Per client IP, per process |
| `RSVP_SLUG_RATE_LIMIT_PER_MINUTE` | no | `60` | New. Per invitation, per process |
| `RUN_MIGRATIONS` | no | `true` | Set to `false` when migrations run as a separate step (recommended, see section 2) |

Frontend: the production build reads no runtime secrets. The only `VITE_*` variables
(`VITE_API_PROXY_TARGET`, `VITE_USE_POLLING`) are dev-server settings. They are not
embedded in `dist/`, which a grep confirmed.

## 2. Migration steps (0007 to 0008)

0008 renames every `wedding*` table, column, constraint and index to `invitation*`. It also
adds the `category`, `variant`, `title` and `timezone` columns and creates
`invitation_rsvp_responses`. **Old code (≤0007) cannot run against an 0008 schema, and new code cannot run
against 0007**, so this release needs a short stop-the-world deploy rather than a rolling one.

1. **Back up** the database and the media volume:
   `pg_dump -Fc "$DB" > pre-0008.dump` and a tar or snapshot of the `media_data` volume.
2. Stop the old backend, so that no process still writes to the `weddings` tables.
3. Run the migration once, as a one-off job, rather than from every replica:
   `docker compose run --rm -e RUN_MIGRATIONS=false backend alembic upgrade head`
   (Leaving `RUN_MIGRATIONS=true` on a single backend container also works, because the
   entrypoint runs `alembic upgrade head` before `exec uvicorn`. With more than one
   replica, the replicas would race each other.)
4. Verify: `alembic current` returns `0008 (head)` and `alembic check` reports "No new upgrade operations detected."
   Every existing row is now `category='wedding'`, `variant='wedding_ceremony'`, `timezone='Asia/Jakarta'`,
   and `schema_version` stays `1`. Publications get the same category and variant.
5. Start the new backend. Check `GET /api/v1/health` (`{"status":"ok","database":"ok"}`) and
   check that the access log shows guest IPs rather than nginx's IP.

Verified results: upgrading from an empty database to 0008 works. Upgrading seeded 0007 data
to 0008 produced a schema identical to a fresh 0008 (`pg_dump --schema-only` diff showed 0
lines), with no leftover `wedding` names.

## 3. Rollback

- **Preferred:** restore the `pre-0008.dump` backup and redeploy the previous image. Data
  written after the upgrade is lost, but nothing is silently converted.
- **`alembic downgrade 0007`** works only while the data still fits the old schema. The
  migration **refuses to run and changes nothing** in either of these cases:
  - any user owns more than one invitation. The error reads "Cannot downgrade 0008: N user(s) own more than one invitation…".
  - any invitation has `category <> 'wedding'`. The error reads "…N invitation(s) are not weddings…".

  Delete or reassign those rows first. A downgrade that does succeed **drops all RSVP replies** and the
  category, variant, title and timezone columns. Session types unknown to 0007 (`party`, `session`, `talk`, …) become
  `other`. Verified: the downgraded schema matches the original 0007 schema exactly, and
  upgrading again reproduces a clean 0008.
- Roll back the code together with the schema, since the old image only works at 0007.

## 4. Production checklist

- [ ] TLS terminates in front of nginx (Cloudflare or nginx itself), and HTTP redirects to HTTPS.
- [ ] `SESSION_COOKIE_SECURE=true`. The cookie is already `HttpOnly` and `SameSite=Lax`.
- [ ] `ENVIRONMENT=production`. The API docs are then hidden.
- [ ] `CORS_ORIGINS` is empty (same origin) or lists exact HTTPS origins only.
- [ ] `FORWARDED_ALLOW_IPS` is set to nginx's address. nginx **overwrites** `X-Forwarded-For` with
      `$remote_addr` (see `infrastructure/nginx/nginx.conf.example`). Behind Cloudflare, configure
      `real_ip_header CF-Connecting-IP` together with the `set_real_ip_from` ranges.
- [ ] **One uvicorn process per deployment.** The rate limits are in memory and per process: with N
      workers or replicas a client gets N times the limit, and the counters reset on restart. Before
      scaling out, move the limits to Redis or to nginx `limit_req`.
- [ ] Migrations run as a one-off job (`RUN_MIGRATIONS=false` on the app containers) once there is more than one replica.
- [ ] The `media_data` volume is persistent and backed up together with the database, because the asset rows
      reference files by name. Verified: files survive a container recreate, and the volume is owned by uid 1000 (`app`).
- [ ] Database backups are scheduled, and a restore has been tested.
- [ ] Logs: the uvicorn access log records client IPs and paths, and public paths contain the invitation slug,
      which is often the couple's names. The SPA URL carries the guest name (`/i/<slug>?to=<guest>`), so the
      **nginx access log** for SPA routes contains guest names. Strip query strings from the
      nginx `log_format` and set a log retention period. The app's own error logs record only the exception type, method and path.
- [ ] Healthcheck: the backend has no Docker `HEALTHCHECK`. Add one that probes `/api/v1/health`, or rely on the orchestrator's probe.
- [ ] Use the lean image (`--build-arg INSTALL_DEV=false`). The default build installs pytest and httpx.
- [ ] Rename `MAX_ASSETS_PER_WEDDING` to `MAX_ASSETS_PER_INVITATION` in every environment.
- [ ] Frontend: serve `npm run build` output (`dist/`) with long-cache `/assets/` (see the nginx example).
