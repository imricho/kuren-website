#!/bin/sh
set -e

# Reverse proxies whose X-Forwarded-For is trusted (read by uvicorn --proxy-headers and the app).
# Never "*": any client could then spoof its address and bypass the per-IP rate limits.
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
case "$FORWARDED_ALLOW_IPS" in
  *'*'*)
    echo "FORWARDED_ALLOW_IPS must list proxy addresses; '*' is not allowed." >&2
    exit 1
    ;;
esac

# Apply pending database migrations before starting the API.
# Disable with RUN_MIGRATIONS=false (e.g. when migrations run as a separate step).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  alembic upgrade head
fi

exec "$@"
