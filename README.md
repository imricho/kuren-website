# Kuren — Wedding Website Platform

A template-based SaaS platform where couples create a wedding website by
choosing a theme, filling in predefined content, uploading photos, and
publishing a shareable link. It is intentionally **not** a general-purpose
site builder: fixed structure, predefined sections, theme-based styling.

> **Status:** Workstream 1 — Platform Foundation. This provides the app
> skeleton, authentication, database and Docker environment. Themes, content
> editing, publishing and RSVP come in later workstreams.

---

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, Vite 6, TypeScript, Vue Router 4, Pinia, Tailwind CSS v4, Vitest |
| Backend | Python 3.12, FastAPI, Pydantic v2 / pydantic-settings, SQLAlchemy 2.0, Alembic, Argon2 (argon2-cffi) |
| Database | PostgreSQL 17 |
| Dev environment | Docker, Docker Compose |
| Future | Nginx, Cloudflare (DNS/CDN/SSL), Cloudflare R2, single VPS |

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py            # DB session, current-user, CSRF origin check
│   │   │   └── v1/                # versioned API: router.py + routes/{health,auth,users}.py
│   │   ├── core/                  # config.py (env settings), security.py, errors.py
│   │   ├── db/                    # SQLAlchemy Base, engine & session
│   │   ├── models/                # ORM models: User, UserSession
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── services/              # business logic (auth_service, user_service)
│   │   └── main.py                # FastAPI app factory
│   ├── alembic/                   # migrations (versions/)
│   ├── tests/                     # pytest suite (runs against a real Postgres test DB)
│   ├── Dockerfile, entrypoint.sh  # entrypoint applies migrations on start
│   └── requirements*.txt
├── frontend/
│   ├── src/
│   │   ├── api/                   # fetch wrapper + typed API calls
│   │   ├── components/            # BrandMark, ui/ (BaseButton, TextField, FormAlert)
│   │   ├── composables/           # useForm (submit + API error mapping)
│   │   ├── layouts/               # AuthLayout (login/register), AppLayout (signed-in shell)
│   │   ├── pages/                 # Login, Register, Dashboard, Account, NotFound
│   │   ├── router/                # routes + auth guards
│   │   ├── stores/                # Pinia auth store
│   │   └── styles/main.css        # Tailwind + design tokens (@theme)
│   ├── Dockerfile
│   └── vite.config.ts             # dev proxy /api → backend
├── infrastructure/nginx/          # future production reverse-proxy sketch (unused locally)
├── docker-compose.yml
└── .env.example
```

## Architecture notes

- **Request flow (dev):** Browser → Vite (`:5173`) → `/api/*` proxied → FastAPI
  (`:8000`) → PostgreSQL. The dashboard and API share an origin, so cookies
  work without cross-site configuration.
- **Authentication:** server-side sessions. On login/register the API creates a
  random 256-bit token, stores only its SHA-256 hash in `user_sessions`, and
  sets it as an `HttpOnly; SameSite=Lax` cookie (`Secure` when
  `SESSION_COOKIE_SECURE=true`). Logout deletes the session row, so revocation
  is immediate. Passwords are hashed with Argon2id.
- **CSRF:** `SameSite=Lax` cookies, JSON-only request bodies, and an `Origin`
  allowlist check on state-changing requests (`CORS_ORIGINS`).
- **Layering:** route handlers are thin; business logic lives in `services/`;
  authentication (`get_current_user`) is a dependency separate from
  authorization decisions in routes/services.
- **Errors:** every error returns
  `{"error": {"code", "message", "details?"}}`. Unexpected exceptions are
  logged and returned as a generic 500 with no internals; validation errors
  never echo submitted values.

## Prerequisites

- Docker Desktop (or Docker Engine) with Docker Compose v2
- Optional, for running tools outside Docker: Node.js 22+, Python 3.12+

## Local development setup

```bash
cp .env.example .env
```

Edit `.env` and set `POSTGRES_PASSWORD` to a random value (e.g. `openssl rand -hex 24`).

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (dashboard) | http://localhost:5173 |
| Backend API | http://localhost:8000/api/v1 |
| API docs (Swagger, non-production only) | http://localhost:8000/api/docs |
| PostgreSQL | `127.0.0.1:5432` (credentials from `.env`) |

Both frontend and backend hot-reload on source changes. Stop with `Ctrl+C`, or:

```bash
docker compose down        # stop containers, keep data
docker compose down -v     # stop and DELETE the database + node_modules volumes
```

## Environment configuration

All configuration is read from environment variables (Compose loads `.env`
automatically). See `.env.example` for the full list.

| Variable | Purpose | Default |
|---|---|---|
| `ENVIRONMENT` | `development` / `test` / `production` (production disables API docs) | `development` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials (required) | — |
| `POSTGRES_HOST_PORT` | Host port for Postgres (localhost only) | `5432` |
| `BACKEND_HOST_PORT`, `FRONTEND_HOST_PORT` | Host ports | `8000`, `5173` |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API | `http://localhost:5173` |
| `SESSION_TTL_HOURS` | Session lifetime | `168` (7 days) |
| `SESSION_COOKIE_SECURE` | Send cookie only over HTTPS (set `true` in production) | `false` |

`.env` is git-ignored. Never commit real credentials.

## Database migrations

Migrations run automatically when the backend container starts
(`entrypoint.sh` → `alembic upgrade head`; disable with `RUN_MIGRATIONS=false`).
Manual commands:

```bash
docker compose exec backend alembic upgrade head          # apply all migrations
docker compose exec backend alembic current               # show current revision
docker compose exec backend alembic downgrade -1          # roll back one revision
docker compose exec backend alembic revision --autogenerate -m "describe change"
docker compose exec backend alembic check                 # verify models match migrations
```

After autogenerating, always review the new file in `backend/alembic/versions/`.

## Running tests

```bash
# Backend (uses an auto-created "<POSTGRES_DB>_test" database; dev data is untouched)
docker compose exec backend pytest

# Frontend
docker compose exec frontend npm test
docker compose exec frontend npm run typecheck
```

## API endpoints

All endpoints are under `/api/v1`.

| Method | Path | Auth | Description | Responses |
|---|---|---|---|---|
| GET | `/health` | — | API status + database connectivity | 200 `{"status":"ok","database":"ok"}`, 503 if DB down |
| POST | `/auth/register` | — | Create account and sign in. Body: `email`, `password` (8–128), `full_name` | 201 user + session cookie, 409 email taken, 422 invalid |
| POST | `/auth/login` | — | Body: `email`, `password` | 200 user + session cookie, 401 invalid credentials |
| POST | `/auth/logout` | cookie | Revoke the current session and clear the cookie (idempotent) | 204 |
| GET | `/users/me` | cookie | Current user's profile | 200, 401 |
| PATCH | `/users/me` | cookie | Update profile. Body: `full_name` | 200, 401, 422 |

Example with curl:

```bash
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-pass","full_name":"Your Name"}' \
  http://localhost:8000/api/v1/auth/register
curl -b jar.txt http://localhost:8000/api/v1/users/me
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `set POSTGRES_PASSWORD in .env` error | You haven't created `.env` — run `cp .env.example .env`. |
| `port is already allocated` | Change `POSTGRES_HOST_PORT` / `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` in `.env`. |
| Backend logs `password authentication failed` | The Postgres volume was initialised with a different password. Restore the old password in `.env`, or reset with `docker compose down -v` (deletes data). |
| Health returns 503 | DB not reachable: `docker compose ps` and `docker compose logs db`. |
| Frontend shows "Unable to reach the server" | Check `docker compose logs backend`; the Vite proxy forwards to `http://backend:8000`. |
| Frontend changes don't hot-reload | Restart the service: `docker compose restart frontend`. On some file systems polling is needed — set `CHOKIDAR_USEPOLLING=true` for the frontend service. |
| New npm dependency not found in container | `docker compose up --build frontend` and, if needed, `docker compose down -v` to refresh the `node_modules` volume. |
| Login works via curl but not in the browser | Use http://localhost:5173 (not 127.0.0.1) so the request `Origin` matches `CORS_ORIGINS`. |
