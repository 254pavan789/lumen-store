#!/bin/sh
# Container start-up (Render / any Docker host)
#   1. create or upgrade the tables, load sample data into an EMPTY database
#      (retries for up to 90 s while a serverless database wakes up)
#   2. start the Express server, which starts the Python engine
set -u
cd "$(dirname "$0")/.." || exit 1

echo "[deploy] preparing database ..."
if ! python3 engine/migrate.py --seed-if-empty --wait 90; then
  echo "[deploy] WARNING: database migration failed - the site will start, but API calls"
  echo "[deploy]          return 503 until DB_HOST / DB_USER / DB_PASSWORD are fixed."
fi

echo "[deploy] starting server on port ${PORT:-10000} ..."
exec node backend/server.js
