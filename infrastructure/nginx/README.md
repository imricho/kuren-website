# Nginx (future)

Not used in local development — Vite's dev server proxies `/api` to FastAPI.

Planned role for the single-VPS production deployment (later workstream):

- Serve the built dashboard SPA (`frontend/dist`) with an SPA fallback to `index.html`.
- Reverse-proxy `/api/` to the FastAPI container (uvicorn).
- Serve published wedding sites as static files (or from R2 behind Cloudflare).
- Sit behind Cloudflare, which terminates public TLS and caches static assets.

`nginx.conf.example` is a starting sketch only; it is not wired into Docker Compose.

## Client IPs and rate limits (required for production)

The API rate-limits public endpoints per client IP (invitation pages 120/min, RSVP posts
10/min) and RSVP posts per invitation (60/min). Behind a proxy the socket peer is the proxy,
so without the setup below **every guest would share one bucket**.

1. nginx overwrites `X-Forwarded-For` with the client address (`$remote_addr`), never appending
   (see `nginx.conf.example`). Behind Cloudflare, `real_ip_header CF-Connecting-IP` with
   `set_real_ip_from` for Cloudflare's published ranges restores the visitor address first.
2. The backend runs uvicorn with `--proxy-headers` (Dockerfile / docker-compose.yml) and
   `FORWARDED_ALLOW_IPS` set to the address(es) nginx connects from, e.g.
   `FORWARDED_ALLOW_IPS=172.18.0.0/16` for nginx on the same Docker network, or
   `127.0.0.1` when nginx runs on the host and proxies to `127.0.0.1:8000`.
3. Never use `FORWARDED_ALLOW_IPS=*`: the entrypoint and the app both refuse to start with it.
   With `*`, any client could send its own `X-Forwarded-For` and pick its rate-limit key.

Check: after deploying, `docker compose logs backend` access lines must show guests'
addresses, not nginx's.
