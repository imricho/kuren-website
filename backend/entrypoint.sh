#!/bin/sh
set -e

# Apply pending database migrations before starting the API.
# Disable with RUN_MIGRATIONS=false (e.g. when migrations run as a separate step).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  alembic upgrade head
fi

exec "$@"
