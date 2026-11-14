# Nginx (future)

Not used in local development — Vite's dev server proxies `/api` to FastAPI.

Planned role for the single-VPS production deployment (later workstream):

- Serve the built dashboard SPA (`frontend/dist`) with an SPA fallback to `index.html`.
- Reverse-proxy `/api/` to the FastAPI container (uvicorn).
- Serve published wedding sites as static files (or from R2 behind Cloudflare).
- Sit behind Cloudflare, which terminates public TLS and caches static assets.

`nginx.conf.example` is a starting sketch only; it is not wired into Docker Compose.
